// Patch merge parity with :core:model PatchMerge, through backend/core/contract/merge-vectors.json.
import { describe, expect, it } from 'vitest';
import { readCoreJson } from '../../src/node/contract-files.ts';
import { applyEventPatch, applyPatch, jsonEquals, overwrittenFields, revertTo } from '../../src/rules/merge.ts';
import type { Json, JsonObject } from '../../src/rules/merge.ts';

interface Vector {
  name: string;
  kind: 'apply' | 'applyToEvent' | 'overwritten' | 'revertTo';
  input: JsonObject;
  expected: Json;
}

interface Inputs {
  doc: JsonObject;
  patch: JsonObject;
  changedFields: string[];
  baseRev: number;
  revisions: { rev: number; authorId: string | null; fields: string[] }[];
  writerId: string;
  current: JsonObject;
  targetRev: number;
  later: { rev: number; inverse: JsonObject }[];
}

const file = readCoreJson<{ vectors: Vector[] }>('contract/merge-vectors.json');

describe('merge vectors', () => {
  it('cover every operation', () => {
    expect(new Set(file.vectors.map((v) => v.kind))).toEqual(new Set(['apply', 'applyToEvent', 'overwritten', 'revertTo']));
  });

  for (const v of file.vectors) {
    it(v.name, () => {
      const i = v.input as unknown as Inputs;
      let actual: unknown;
      switch (v.kind) {
        case 'apply':
          actual = applyPatch(i['doc'], i['patch']);
          break;
        case 'applyToEvent':
          actual = applyEventPatch(i['doc'], i['patch']);
          break;
        case 'overwritten':
          actual = overwrittenFields(
            i['changedFields'],
            i['baseRev'],
            i['revisions'],
            i['writerId'],
          );
          break;
        case 'revertTo':
          actual = revertTo(i['current'], i['targetRev'], i['later']);
          break;
      }
      expect(actual).toEqual(v.expected);
    });
  }
});

describe('merge helpers', () => {
  it('jsonEquals ignores key order and compares deeply', () => {
    expect(jsonEquals({ a: 1, b: [1, { c: null }] }, { b: [1, { c: null }], a: 1 })).toBe(true);
    expect(jsonEquals({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(jsonEquals({ a: 1, b: 2 }, { a: 1, c: 2 })).toBe(false);
    expect(jsonEquals([1, 2], [2, 1])).toBe(false);
    expect(jsonEquals([1], { 0: 1 })).toBe(false);
    expect(jsonEquals(null, {})).toBe(false);
    expect(jsonEquals('1', 1)).toBe(false);
  });

  it('applyPatch does not change its inputs', () => {
    const doc: JsonObject = { title: 'A', emoji: 'x' };
    const patch: JsonObject = { title: 'B', emoji: null };
    applyPatch(doc, patch);
    expect(doc).toEqual({ title: 'A', emoji: 'x' });
    expect(patch).toEqual({ title: 'B', emoji: null });
  });
});

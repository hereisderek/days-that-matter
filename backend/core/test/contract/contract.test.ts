import { describe, expect, it } from 'vitest';
import { ERROR_STATUS, FEATURES, LIMITS, PLANS, PLAN_LIMITS, planLimit } from '../../src/contract/index.ts';
import { schemaToTypeScript } from '../../src/contract/schema-to-ts.ts';
import type { SchemaDocument } from '../../src/contract/schema-to-ts.ts';
import { readFileSync } from 'node:fs';
import { API_TYPES_PATH, readCoreJson, renderApiTypes } from '../../src/node/contract-files.ts';

describe('generated contract', () => {
  it('src/contract/api.ts matches a fresh generation from api.schema.json', () => {
    expect(readFileSync(API_TYPES_PATH, 'utf8')).toBe(renderApiTypes());
  });

  it('error statuses come from the model', () => {
    expect(ERROR_STATUS.invalid_payload).toBe(400);
    expect(ERROR_STATUS.premium_required).toBe(402);
    expect(ERROR_STATUS.invite_full).toBe(410);
    expect(ERROR_STATUS.service_unavailable).toBe(503);
    const schema = readCoreJson<{ $defs: { ApiErrorCode: { enum: string[] } } }>('contract/api.schema.json');
    expect(Object.keys(ERROR_STATUS)).toEqual(schema.$defs.ApiErrorCode.enum);
  });

  it('the plan table has every plan and feature (docs/features/premium/SPEC.md)', () => {
    expect(PLANS).toEqual(['free', 'premium', 'premium_plus']);
    for (const plan of PLANS) expect(Object.keys(PLAN_LIMITS[plan])).toEqual([...FEATURES]);
    expect(planLimit('free', 'events')).toBe(10);
    expect(planLimit('free', 'animated_backdrop')).toBe(0);
    expect(planLimit('premium', 'spotify_events')).toBeNull();
    expect(planLimit('premium_plus', 'custom_audio')).toBe(20);
  });

  it('fixed limits match BACKEND.md section 11.2', () => {
    expect(LIMITS.JSON_BODY_MAX_BYTES).toBe(65_536);
    expect(LIMITS.EVENT_DOC_MAX_BYTES).toBe(16_384);
    expect(LIMITS.UPLOAD_MAX_BYTES).toBe(4_194_304);
    expect(LIMITS.REVISIONS_KEPT).toBe(200);
  });

  it('validation vectors are well formed (consumed by the TypeScript validation from task 3.6)', () => {
    const file = readCoreJson<{ vectors: { name: string; kind: string; expected: { valid: boolean; errors?: unknown[]; body?: { error: { code: string } } } }[] }>(
      'contract/validation-vectors.json',
    );
    const kinds = new Set(file.vectors.map((v) => v.kind));
    expect([...kinds].sort()).toEqual(
      ['eventDocSize', 'eventNew', 'eventPatch', 'inviteNew', 'invitePatch', 'linkNew', 'linkPatch', 'membershipPatch', 'memoNew', 'memoPatch'],
    );
    expect(new Set(file.vectors.map((v) => v.name)).size).toBe(file.vectors.length);
    for (const v of file.vectors.filter((x) => !x.expected.valid)) {
      expect(v.expected.errors?.length, v.name).toBeGreaterThan(0);
      expect(v.expected.body?.error.code, v.name).toBe('invalid_payload');
    }
  });
});

describe('schemaToTypeScript', () => {
  const doc: SchemaDocument = {
    $defs: {
      Kind: { type: 'string', enum: ['a', 'b'] },
      Item: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          n: { type: 'integer' },
          kind: { $ref: '#/$defs/Kind' },
          tags: { type: 'array', items: { anyOf: [{ type: 'string' }, { type: 'null' }] } },
          meta: { type: 'object' },
          counts: { type: 'object', additionalProperties: { type: 'number' } },
          any: {},
          at: { type: 'string', format: 'date-time' },
        },
        required: ['id'],
      },
      Shape: { oneOf: [{ $ref: '#/$defs/Item' }, { type: 'object', properties: { kind: { const: 'x' } }, required: ['kind'] }] },
    },
  };

  it('renders interfaces, unions and literals', () => {
    const ts = schemaToTypeScript(doc, '// header');
    expect(ts).toContain('export type Kind = "a" | "b";');
    expect(ts).toContain('export interface Item {\n  id: string;\n  n?: number;\n  kind?: Kind;\n  tags?: (string | null)[];');
    expect(ts).toContain('  meta?: Record<string, unknown>;\n  counts?: Record<string, number>;\n  any?: unknown;');
    expect(ts).toContain('  /** Format: date-time. */\n  at?: string;');
    expect(ts).toContain('export type Shape = Item | {\n  kind: "x";\n};');
    expect(ts.startsWith('// header\n')).toBe(true);
  });

  it('rejects shapes it does not know', () => {
    expect(() => schemaToTypeScript({ $defs: { A: { type: 'object', properties: { x: { $ref: '#/$defs/Missing' } } } } }, '')).toThrow(/Missing/);
    expect(() => schemaToTypeScript({ $defs: { A: { type: 'tuple' } } }, '')).toThrow(/Unsupported type/);
    expect(() => schemaToTypeScript({ $defs: { A: { minLength: 1 } as never } }, '')).toThrow(/keyword minLength/);
    expect(() => schemaToTypeScript({ $defs: { A: { $ref: 'other.json#/A' } } }, '')).toThrow(/Unsupported \$ref/);
    expect(() => schemaToTypeScript({ $defs: { A: { type: 'array' } } }, '')).toThrow(/without items/);
  });
});

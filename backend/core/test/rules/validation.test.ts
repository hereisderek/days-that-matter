// Validation parity with :core:model, through backend/core/contract/validation-vectors.json.
import { describe, expect, it } from 'vitest';
import { readCoreJson } from '../../src/node/contract-files.ts';
import type { Json, JsonObject } from '../../src/rules/merge.ts';
import {
  checkDocumentSize,
  formatInstant,
  invalidPayloadBody,
  parseInstant,
  spotifyUrl,
  validateEventPatch,
  validateInvitePatch,
  validateLinkPatch,
  validateMembershipPatch,
  validateMemoPatch,
  validateNewEvent,
  validateNewInvite,
  validateNewLink,
  validateNewMemo,
} from '../../src/rules/validation.ts';
import type { FieldError, Validated } from '../../src/rules/validation.ts';

type Expected =
  | { valid: true; value: Json }
  | { valid: false; errors: FieldError[]; body?: unknown };

interface Vector {
  name: string;
  kind: string;
  input: JsonObject;
  expected: Expected;
}

const file = readCoreJson<{ now: string; vectors: Vector[] }>('contract/validation-vectors.json');
const now = Date.parse(file.now);

const validators: Record<string, (input: JsonObject) => Validated<Json>> = {
  eventNew: validateNewEvent,
  eventPatch: validateEventPatch,
  memoNew: validateNewMemo,
  memoPatch: validateMemoPatch,
  linkNew: (i) => validateNewLink(i, now),
  linkPatch: (i) => validateLinkPatch(i, now),
  inviteNew: (i) => validateNewInvite(i, now),
  invitePatch: (i) => validateInvitePatch(i, now),
  membershipPatch: validateMembershipPatch,
  eventDocSize: (i) => {
    const e = checkDocumentSize(i);
    return e === null ? { valid: true, value: null } : { valid: false, errors: [e] };
  },
};

describe('validation vectors', () => {
  it('have a validator for every kind', () => {
    for (const kind of new Set(file.vectors.map((v) => v.kind))) expect(validators[kind], kind).toBeDefined();
    expect(file.vectors.length).toBeGreaterThan(100);
  });

  for (const v of file.vectors) {
    it(`${v.kind}: ${v.name}`, () => {
      const result = (validators[v.kind] as (input: JsonObject) => Validated<Json>)(structuredClone(v.input));
      if (v.expected.valid) {
        expect(result).toEqual({ valid: true, value: v.expected.value });
      } else {
        expect(result.valid).toBe(false);
        if (result.valid) return;
        expect(result.errors).toEqual(v.expected.errors);
        if (v.expected.body !== undefined) expect(invalidPayloadBody(result.errors)).toEqual(v.expected.body);
      }
    });
  }
});

describe('validation details beyond the vectors', () => {
  it('normalizes titles to NFC before counting', () => {
    const decomposed = 'Café';
    const r = validateEventPatch({ title: decomposed });
    expect(r).toEqual({ valid: true, value: { title: 'Café' } });
  });

  it('rejects lone surrogates', () => {
    expect(validateEventPatch({ title: 'a\ud800b' })).toEqual({ valid: false, errors: [{ field: 'title', reason: 'invalid unicode' }] });
  });

  it('parses and formats instants like Kotlin', () => {
    expect(parseInstant('2026-10-12T17:04:05+02:00')?.text).toBe('2026-10-12T15:04:05Z');
    expect(parseInstant('2026-10-12T15:04:05.120Z')?.text).toBe('2026-10-12T15:04:05.120Z');
    expect(parseInstant('2026-10-12T15:04:05.123456Z')?.text).toBe('2026-10-12T15:04:05.123456Z');
    expect(parseInstant('2026-10-12T15:04:05.1234567Z')?.text).toBe('2026-10-12T15:04:05.123456700Z');
    expect(parseInstant('2026-02-30T00:00:00Z')).toBeNull();
    expect(parseInstant('2026-10-12 15:04:05Z')).toBeNull();
    expect(parseInstant('2026-10-12T15:04:05')).toBeNull();
    expect(formatInstant(Date.parse('2026-10-12T15:04:05.500Z'))).toBe('2026-10-12T15:04:05.500Z');
  });

  it('keeps the Spotify link form', () => {
    expect(spotifyUrl('https://open.spotify.com/intl-de/album/37i9dQZF1DXcBWIGoYBM5M/?si=1#x')).toBe(
      'https://open.spotify.com/intl-de/album/37i9dQZF1DXcBWIGoYBM5M',
    );
    expect(spotifyUrl('https://open.spotify.com/show/37i9dQZF1DXcBWIGoYBM5M')).toBeNull();
  });
});

// Store conformance suite (task 3.4, TESTING_STRATEGY.md section 5.3). Runnable against any Store:
// each case gets a fresh, empty store from the factory and throws on the first broken expectation.
// It has no test framework dependency, so every variant can run it from its own test runner, and a
// run can be checked to fail (the negative test runs it against a deliberately broken store).
import { revertTo } from '../rules/merge.ts';
import type { JsonObject } from '../rules/merge.ts';
import type { EventRecord, PatchOutcome, Store } from '../ports/store.ts';

export interface ConformanceCase {
  readonly name: string;
  run(store: Store): Promise<void>;
}

export interface ConformanceResult {
  readonly name: string;
  readonly passed: boolean;
  readonly error: string | null;
}

class ConformanceFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConformanceFailure';
  }
}

function check(condition: boolean, message: string): asserts condition {
  if (!condition) throw new ConformanceFailure(message);
}

function same(actual: unknown, expected: unknown, what: string): void {
  const a = canonical(actual);
  const e = canonical(expected);
  check(a === e, `${what}: expected ${e}, got ${a}`);
}

/** JSON with sorted keys, so object key order does not matter. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v !== null && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
}

const T0 = 1_791_817_445; // 2026-10-12T15:04:05Z
const OWNER = 'acct-owner';
const EDITOR = 'acct-editor';
const OTHER = 'acct-other';
const EVENT = '0b8f3c1e-6d0a-4a51-9f61-2f1b3f6d9a10';
const THEME: JsonObject = { paletteId: 'violet', cardStyle: 'glass', typography: 'modern' };
const DOC: JsonObject = { title: 'Our wedding', targetDate: '2027-06-12', theme: THEME, pinnedAt: '2026-10-01T08:00:00Z' };

async function withEvent(store: Store, doc: JsonObject = DOC): Promise<EventRecord> {
  await store.createAccount({ id: OWNER, displayName: 'Owner', now: T0 });
  const r = await store.createEvent({ id: EVENT, ownerId: OWNER, doc, now: T0 });
  check(r.status === 'created', `createEvent: expected created, got ${r.status}`);
  return r.event;
}

async function patch(store: Store, authorId: string, baseRev: number, fields: JsonObject, now = T0 + 60): Promise<PatchOutcome> {
  return store.applyPatch({ eventId: EVENT, authorId, baseRev, patch: fields, now });
}

function ok(outcome: PatchOutcome): Extract<PatchOutcome, { status: 'ok' }> {
  check(outcome.status === 'ok', `applyPatch: expected ok, got ${outcome.status}`);
  return outcome;
}

export const storeConformanceCases: readonly ConformanceCase[] = [
  {
    name: 'account: create stores the defaults',
    async run(store) {
      const r = await store.createAccount({ id: OWNER, displayName: 'Mum', now: T0 });
      same(r.status, 'created', 'status');
      const expected = {
        id: OWNER, displayName: 'Mum', plan: 'free', planExpiresAt: null, audioBlocked: false, mediaBytes: 0, mediaFiles: 0,
        lastActiveAt: T0, inactiveNotice1At: null, inactiveNotice2At: null, createdAt: T0,
      };
      same(r.account, expected, 'returned account');
      same(await store.getAccount(OWNER), expected, 'stored account');
    },
  },
  {
    name: 'account: creating an existing id returns it unchanged',
    async run(store) {
      await store.createAccount({ id: OWNER, displayName: 'Mum', now: T0 });
      const again = await store.createAccount({ id: OWNER, displayName: 'Someone else', now: T0 + 5 });
      same(again.status, 'exists', 'status');
      same(again.account.displayName, 'Mum', 'display name');
      same(again.account.createdAt, T0, 'created at');
    },
  },
  {
    name: 'account: unknown id reads as null',
    async run(store) {
      same(await store.getAccount('nobody'), null, 'account');
    },
  },
  {
    name: 'event: create starts at rev 1 with the document as given',
    async run(store) {
      const created = await withEvent(store);
      const expected = {
        id: EVENT, ownerId: OWNER, rev: 1, doc: DOC, audioKind: null, audioSetBy: null, audioMediaId: null, childSeq: 0,
        childPurgedSeq: 0, updatedAt: T0, deletedAt: null,
      };
      same(created, expected, 'returned event');
      same(await store.getEvent(EVENT), expected, 'stored event');
      same(await store.listRevisions(EVENT, { limit: 10 }), [], 'revisions');
    },
  },
  {
    name: 'event: repeating a create with the same owner returns the current document',
    async run(store) {
      await withEvent(store);
      ok(await patch(store, OWNER, 1, { title: 'Changed' }));
      const again = await store.createEvent({ id: EVENT, ownerId: OWNER, doc: DOC, now: T0 + 120 });
      check(again.status === 'exists', `status: expected exists, got ${again.status}`);
      same(again.event.rev, 2, 'rev');
      same(again.event.doc['title'], 'Changed', 'title');
    },
  },
  {
    name: 'event: an id owned by another account is a conflict and stays unchanged',
    async run(store) {
      await withEvent(store);
      const r = await store.createEvent({ id: EVENT, ownerId: OTHER, doc: { ...DOC, title: 'Hijack' }, now: T0 + 1 });
      same(r.status, 'conflict', 'status');
      const stored = await store.getEvent(EVENT);
      same(stored?.ownerId, OWNER, 'owner');
      same(stored?.doc['title'], 'Our wedding', 'title');
    },
  },
  {
    name: 'event: unknown id reads as null',
    async run(store) {
      same(await store.getEvent('missing'), null, 'event');
    },
  },
  {
    name: 'patch: bumps the rev and appends the revision',
    async run(store) {
      await withEvent(store);
      const r = ok(await patch(store, EDITOR, 1, { title: 'Our wedding day', emoji: '💍' }, T0 + 30));
      same(r.event.rev, 2, 'rev');
      same(r.event.updatedAt, T0 + 30, 'updated at');
      same(r.event.doc, { ...DOC, title: 'Our wedding day', emoji: '💍' }, 'document');
      same(r.applied, { title: 'Our wedding day', emoji: '💍' }, 'applied');
      same(r.overwritten, [], 'overwritten');
      same(await store.getEvent(EVENT), r.event, 'stored event');
      same(
        await store.listRevisions(EVENT, { limit: 10 }),
        [{
          eventId: EVENT, rev: 2, authorId: EDITOR, createdAt: T0 + 30, patch: { title: 'Our wedding day', emoji: '💍' },
          inverse: { title: 'Our wedding', emoji: null }, overwrote: [], restoredFrom: null,
        }],
        'revisions',
      );
    },
  },
  {
    name: 'patch: null clears a field and the inverse restores it',
    async run(store) {
      await withEvent(store);
      const r = ok(await patch(store, OWNER, 1, { pinnedAt: null }));
      check(!('pinnedAt' in r.event.doc), 'pinnedAt should be absent after clearing');
      const [revision] = await store.listRevisions(EVENT, { limit: 1 });
      same(revision?.inverse, { pinnedAt: '2026-10-01T08:00:00Z' }, 'inverse');
    },
  },
  {
    name: 'patch: a patch that changes nothing writes no revision',
    async run(store) {
      await withEvent(store);
      const r = ok(await patch(store, OWNER, 1, { title: 'Our wedding', emoji: null }));
      same(r.event.rev, 1, 'rev');
      same(r.applied, {}, 'applied');
      same((await store.getEvent(EVENT))?.rev, 1, 'stored rev');
      same(await store.listRevisions(EVENT, { limit: 10 }), [], 'revisions');
    },
  },
  {
    name: 'patch: reports fields that replaced a newer change by someone else',
    async run(store) {
      await withEvent(store);
      ok(await patch(store, EDITOR, 1, { targetTime: '16:30:00' }));
      ok(await patch(store, OWNER, 2, { title: 'Mine' }));
      const r = ok(await patch(store, OWNER, 1, { targetTime: '17:00:00', title: 'Mine again', emoji: '🎉' }));
      same(r.overwritten, ['targetTime'], 'overwritten');
      const [latest] = await store.listRevisions(EVENT, { limit: 1 });
      same(latest?.overwrote, ['targetTime'], 'revision overwrote');
      const late = ok(await patch(store, EDITOR, 4, { targetTime: '18:00:00' }));
      same(late.overwritten, [], 'nothing newer than the base');
    },
  },
  {
    name: 'patch: archiving clears the pin and the inverse restores it',
    async run(store) {
      await withEvent(store);
      const r = ok(await patch(store, OWNER, 1, { archivedAt: '2026-10-12T15:04:05Z' }));
      same(r.applied, { archivedAt: '2026-10-12T15:04:05Z', pinnedAt: null }, 'applied');
      check(!('pinnedAt' in r.event.doc), 'pinnedAt should be cleared');
      const [revision] = await store.listRevisions(EVENT, { limit: 1 });
      same(revision?.inverse, { archivedAt: null, pinnedAt: '2026-10-01T08:00:00Z' }, 'inverse');
    },
  },
  {
    name: 'patch: audio columns follow the audio field and its setter',
    async run(store) {
      await withEvent(store, { ...DOC, audio: { kind: 'library', trackId: 'calm-lofi' } });
      same((await store.getEvent(EVENT))?.audioSetBy, OWNER, 'setter at create');
      const spotify = { kind: 'spotify', url: 'https://open.spotify.com/track/37i9dQZF1DXcBWIGoYBM5M' };
      let e = ok(await patch(store, EDITOR, 1, { audio: spotify })).event;
      same([e.audioKind, e.audioSetBy, e.audioMediaId], ['spotify', EDITOR, null], 'spotify');
      e = ok(await patch(store, OWNER, 2, { title: 'Other field' })).event;
      same([e.audioKind, e.audioSetBy], ['spotify', EDITOR], 'unchanged by another field');
      e = ok(await patch(store, OWNER, 3, { audio: { kind: 'custom', mediaId: 'Qm7aaaaaaaaaaaaaaaaaaa', title: 'Dance' } })).event;
      same([e.audioKind, e.audioSetBy, e.audioMediaId], ['custom', OWNER, 'Qm7aaaaaaaaaaaaaaaaaaa'], 'custom');
      e = ok(await patch(store, OWNER, 4, { audio: null })).event;
      same([e.audioKind, e.audioSetBy, e.audioMediaId], [null, null, null], 'cleared');
      same(await store.getEvent(EVENT), e, 'stored');
    },
  },
  {
    name: 'patch: unknown and deleted events are refused',
    async run(store) {
      same((await patch(store, OWNER, 1, { title: 'x' })).status, 'not_found', 'unknown');
      await withEvent(store);
      check(await store.deleteEvent(EVENT, T0 + 10), 'delete should succeed');
      same((await patch(store, OWNER, 1, { title: 'x' })).status, 'deleted', 'deleted');
      same((await store.getEvent(EVENT))?.rev, 1, 'rev unchanged');
    },
  },
  {
    name: 'patch: concurrent writers lose nothing',
    async run(store) {
      await withEvent(store);
      const fields = Array.from({ length: 10 }, (_, i) => `field${i}`);
      const outcomes = await Promise.all(fields.map((f, i) => patch(store, `writer-${i}`, 1, { [f === 'field0' ? 'title' : 'notes']: f })));
      for (const o of outcomes) ok(o);
      const event = await store.getEvent(EVENT);
      same(event?.rev, 11, 'final rev');
      const revisions = await store.listRevisions(EVENT, { limit: 50 });
      same(revisions.map((r) => r.rev), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2], 'revision numbers');
      same(new Set(revisions.map((r) => r.authorId)).size, 10, 'one revision per writer');
      const original = revertTo(event?.doc ?? {}, 1, revisions);
      same(original, DOC, 'reverting every revision gives the original document');
    },
  },
  {
    name: 'delete: tombstones once and keeps the document',
    async run(store) {
      await withEvent(store);
      same(await store.deleteEvent('missing', T0), false, 'unknown');
      same(await store.deleteEvent(EVENT, T0 + 10), true, 'first delete');
      same(await store.deleteEvent(EVENT, T0 + 20), false, 'second delete');
      const event = await store.getEvent(EVENT);
      same([event?.deletedAt, event?.updatedAt, event?.doc['title']], [T0 + 10, T0 + 10, 'Our wedding'], 'tombstone');
      const again = await store.createEvent({ id: EVENT, ownerId: OWNER, doc: DOC, now: T0 + 30 });
      check(again.status === 'exists', `create after delete: expected exists, got ${again.status}`);
      same(again.event.deletedAt, T0 + 10, 'create does not revive');
    },
  },
  {
    name: 'revisions: newest first, paged with before and limit',
    async run(store) {
      await withEvent(store);
      for (let rev = 1; rev <= 5; rev++) ok(await patch(store, OWNER, rev, { title: `T${rev}` }, T0 + rev));
      same((await store.listRevisions(EVENT, { limit: 2 })).map((r) => r.rev), [6, 5], 'first page');
      same((await store.listRevisions(EVENT, { before: 5, limit: 2 })).map((r) => r.rev), [4, 3], 'second page');
      same((await store.listRevisions(EVENT, { before: 3, limit: 10 })).map((r) => r.rev), [2], 'last page');
      same(await store.listRevisions('missing', { limit: 10 }), [], 'unknown event');
    },
  },
  {
    name: 'isolation: records returned to callers are copies',
    async run(store) {
      const created = await withEvent(store);
      created.doc['title'] = 'mutated';
      const read = await store.getEvent(EVENT);
      (read?.doc['theme'] as JsonObject)['paletteId'] = 'mutated';
      const input: JsonObject = { theme: { ...THEME, cardStyle: 'solid' } };
      ok(await patch(store, OWNER, 1, input));
      (input['theme'] as JsonObject)['cardStyle'] = 'mutated';
      const [revision] = await store.listRevisions(EVENT, { limit: 1 });
      (revision?.patch['theme'] as JsonObject)['typography'] = 'mutated';
      same((await store.getEvent(EVENT))?.doc, { ...DOC, theme: { ...THEME, cardStyle: 'solid' } }, 'stored document');
      same((await store.listRevisions(EVENT, { limit: 1 }))[0]?.patch, { theme: { ...THEME, cardStyle: 'solid' } }, 'stored patch');
    },
  },
];

/** Runs every case, each against a fresh store, and reports all results instead of stopping at the first failure. */
export async function runStoreConformance(newStore: () => Promise<Store>): Promise<ConformanceResult[]> {
  const results: ConformanceResult[] = [];
  for (const c of storeConformanceCases) {
    try {
      await c.run(await newStore());
      results.push({ name: c.name, passed: true, error: null });
    } catch (e) {
      results.push({ name: c.name, passed: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return results;
}

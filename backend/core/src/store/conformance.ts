// Store conformance suite (task 3.4, TESTING_STRATEGY.md section 5.3). Runnable against any Store:
// each case gets a fresh, empty store from the factory and throws on the first broken expectation.
// It has no test framework dependency, so every variant can run it from its own test runner, and a
// run can be checked to fail (the negative test runs it against a deliberately broken store).
import { revertTo } from '../rules/merge.ts';
import type { JsonObject } from '../rules/merge.ts';
import type {
  CreateInviteOutcome,
  CreateLinkOutcome,
  EventRecord,
  IdentityInput,
  InviteRecord,
  JoinInput,
  LinkRecord,
  MemoRecord,
  NewInvite,
  NewLink,
  PatchOutcome,
  PutMemoOutcome,
  Store,
} from '../ports/store.ts';

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

const DAY = 86_400;
const MEMO = '5c1f0000-0000-4000-8000-000000000001';
const MEMO_DOC: JsonObject = { content: 'Booked the venue today.', milestoneTag: 'Day 100', createdAt: '2026-10-12T15:04:05Z' };

function google(subject: string, email: string | null = null, emailVerified = email !== null): IdentityInput {
  return { provider: 'google', subject, email, emailVerified };
}

function emailIdentity(email: string): IdentityInput {
  return { provider: 'email', subject: email, email, emailVerified: true };
}

async function signIn(store: Store, identity: IdentityInput, newId: string, now = T0) {
  return store.signIn({ identity, newAccount: { id: newId, displayName: `Name of ${newId}`, now } });
}

async function memo(store: Store, id = MEMO, doc: JsonObject = MEMO_DOC, now = T0 + 10): Promise<MemoRecord> {
  const r = await store.putMemo({ eventId: EVENT, memoId: id, authorId: OWNER, doc, now, maxMemos: 500 });
  check(r.status === 'created', `putMemo: expected created, got ${r.status}`);
  return (r as Extract<PutMemoOutcome, { status: 'created' }>).memo;
}

function memoId(n: number): string {
  return `5c1f0000-0000-4000-8000-${String(n).padStart(12, '0')}`;
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
  // ---- History (task 3.7) ----
  {
    name: 'revisions: a restore records the rev it brought back',
    async run(store) {
      await withEvent(store);
      ok(await patch(store, OWNER, 1, { title: 'T2' }));
      const restored = ok(await store.applyPatch({ eventId: EVENT, authorId: EDITOR, baseRev: 2, patch: { title: 'Our wedding' }, now: T0 + 90, restoredFrom: 1 }));
      same(restored.event.rev, 3, 'rev');
      const [latest, earlier] = await store.listRevisions(EVENT, { limit: 2 });
      same(latest?.restoredFrom, 1, 'restore marker');
      same(latest?.authorId, EDITOR, 'author');
      same(latest?.inverse, { title: 'T2' }, 'inverse');
      same(earlier?.restoredFrom, null, 'plain patch');
    },
  },
  {
    name: 'revisions: pruning keeps the newest ones in the same write',
    async run(store) {
      await withEvent(store);
      for (let rev = 1; rev <= 4; rev++) ok(await patch(store, OWNER, rev, { title: `T${rev}` }, T0 + rev));
      same((await store.listRevisions(EVENT, { limit: 10 })).map((r) => r.rev), [5, 4, 3, 2], 'kept without a limit');
      const pruned = ok(await store.applyPatch({ eventId: EVENT, authorId: OWNER, baseRev: 5, patch: { title: 'T5' }, now: T0 + 9, keepRevisions: 3 }));
      same(pruned.event.rev, 6, 'rev');
      same((await store.listRevisions(EVENT, { limit: 10 })).map((r) => r.rev), [6, 5, 4], 'newest 3 kept');
      ok(await store.applyPatch({ eventId: EVENT, authorId: OWNER, baseRev: 6, patch: { title: 'T6' }, now: T0 + 10, keepRevisions: 3 }));
      same((await store.listRevisions(EVENT, { limit: 10 })).map((r) => r.rev), [7, 6, 5], 'oldest dropped on the next write');
      ok(await store.applyPatch({ eventId: EVENT, authorId: OWNER, baseRev: 7, patch: { title: 'T6' }, now: T0 + 11, keepRevisions: 1 }));
      same((await store.listRevisions(EVENT, { limit: 10 })).map((r) => r.rev), [7, 6, 5], 'a patch that changes nothing prunes nothing');
    },
  },
  {
    name: 'accounts: display names of the ids that exist',
    async run(store) {
      await store.createAccount({ id: OWNER, displayName: 'Mum', now: T0 });
      await store.createAccount({ id: EDITOR, displayName: 'Dad', now: T0 });
      const names = await store.displayNames([OWNER, EDITOR, OTHER, OWNER]);
      same([...names.entries()].sort(), [[EDITOR, 'Dad'], [OWNER, 'Mum']], 'names');
      same((await store.displayNames([])).size, 0, 'no ids');
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
  // ---- Accounts (task 3.5) ----
  {
    name: 'sign-in: a new identity creates an account with it',
    async run(store) {
      const r = await signIn(store, google('g-1', 'mum@example.com'), 'acct-1');
      same([r.status, r.account.id, r.account.displayName, r.account.createdAt], ['created', 'acct-1', 'Name of acct-1', T0], 'outcome');
      same(
        await store.listIdentities('acct-1'),
        [{ provider: 'google', subject: 'g-1', email: 'mum@example.com', emailVerified: true, accountId: 'acct-1', createdAt: T0 }],
        'identities',
      );
    },
  },
  {
    name: 'sign-in: a known identity signs in to its account',
    async run(store) {
      await signIn(store, google('g-1'), 'acct-1');
      const again = await signIn(store, google('g-1'), 'acct-2', T0 + 5);
      same([again.status, again.account.id], ['existing', 'acct-1'], 'outcome');
      same(await store.getAccount('acct-2'), null, 'no second account');
    },
  },
  {
    name: 'sign-in: a verified email joins the account with that verified email',
    async run(store) {
      await signIn(store, emailIdentity('mum@example.com'), 'acct-1');
      const linked = await signIn(store, google('g-1', 'mum@example.com'), 'acct-2', T0 + 5);
      same([linked.status, linked.account.id], ['linked', 'acct-1'], 'linked');
      same((await store.listIdentities('acct-1')).map((i) => i.provider), ['email', 'google'], 'both identities');
      const unverified = await signIn(store, { provider: 'apple', subject: 'a-1', email: 'mum@example.com', emailVerified: false }, 'acct-3', T0 + 6);
      same([unverified.status, unverified.account.id], ['created', 'acct-3'], 'an unverified email does not link');
    },
  },
  {
    name: 'sign-in: concurrent first sign-ins of one identity end in one account',
    async run(store) {
      const outcomes = await Promise.all([1, 2, 3, 4].map((n) => signIn(store, google('g-1'), `acct-${n}`)));
      same(new Set(outcomes.map((o) => o.account.id)).size, 1, 'one account');
      same(outcomes.filter((o) => o.status === 'created').length, 1, 'created once');
      const winner = outcomes[0]?.account.id as string;
      for (const n of [1, 2, 3, 4]) {
        if (`acct-${n}` !== winner) same(await store.getAccount(`acct-${n}`), null, `no orphan acct-${n}`);
      }
    },
  },
  {
    name: 'identities: adding is idempotent and refuses another account\'s identity',
    async run(store) {
      await signIn(store, google('g-1'), 'acct-1');
      await signIn(store, google('g-2'), 'acct-2');
      same(await store.addIdentity({ accountId: 'acct-1', identity: emailIdentity('mum@example.com'), now: T0 + 1 }), 'added', 'added');
      same(await store.addIdentity({ accountId: 'acct-1', identity: emailIdentity('mum@example.com'), now: T0 + 2 }), 'exists', 'again');
      same(await store.addIdentity({ accountId: 'acct-1', identity: google('g-2'), now: T0 + 3 }), 'conflict', 'other account');
      same((await store.listIdentities('acct-1')).map((i) => [i.provider, i.createdAt]), [['google', T0], ['email', T0 + 1]], 'oldest first');
      same(await store.listIdentities('nobody'), [], 'unknown account');
    },
  },
  {
    name: 'account: the display name changes',
    async run(store) {
      await store.createAccount({ id: OWNER, displayName: 'Owner', now: T0 });
      same((await store.updateDisplayName(OWNER, 'Mum'))?.displayName, 'Mum', 'returned');
      same((await store.getAccount(OWNER))?.displayName, 'Mum', 'stored');
      same(await store.updateDisplayName('nobody', 'x'), null, 'unknown');
    },
  },
  {
    name: 'email codes: every attempt counts, up to the limit, and a code signs in once',
    async run(store) {
      await store.putEmailCode({ emailHash: 'h1', codeMac: 'mac-1', expiresAt: T0 + 600 });
      for (let i = 1; i <= 5; i++) same(await store.takeEmailCodeAttempt('h1', T0, 5), 'mac-1', `attempt ${i}`);
      same(await store.takeEmailCodeAttempt('h1', T0, 5), null, 'sixth attempt');
      await store.putEmailCode({ emailHash: 'h1', codeMac: 'mac-2', expiresAt: T0 + 600 });
      same(await store.takeEmailCodeAttempt('h1', T0, 5), 'mac-2', 'a new code resets the attempts');
      same(await store.consumeEmailCode('h1', 'mac-1'), false, 'an old MAC does not consume');
      same(await store.consumeEmailCode('h1', 'mac-2'), true, 'consumed');
      same(await store.consumeEmailCode('h1', 'mac-2'), false, 'only once');
      same(await store.takeEmailCodeAttempt('h1', T0, 5), null, 'gone');
      same(await store.takeEmailCodeAttempt('unknown', T0, 5), null, 'unknown');
    },
  },
  {
    name: 'email codes: a code expires',
    async run(store) {
      await store.putEmailCode({ emailHash: 'h1', codeMac: 'mac-1', expiresAt: T0 + 600 });
      same(await store.takeEmailCodeAttempt('h1', T0 + 599, 5), 'mac-1', 'just before');
      same(await store.takeEmailCodeAttempt('h1', T0 + 600, 5), null, 'at expiry');
    },
  },
  {
    name: 'email codes: parallel guesses stay within the attempt limit',
    async run(store) {
      await store.putEmailCode({ emailHash: 'h1', codeMac: 'mac-1', expiresAt: T0 + 600 });
      const tries = await Promise.all(Array.from({ length: 12 }, () => store.takeEmailCodeAttempt('h1', T0, 5)));
      same(tries.filter((t) => t !== null).length, 5, 'granted attempts');
    },
  },
  {
    name: 'sessions: create, read, record use and end',
    async run(store) {
      await store.createAccount({ id: OWNER, displayName: 'Owner', now: T0 });
      await store.createSession({ tokenHash: 't1', accountId: OWNER, createdAt: T0, lastUsedAt: T0 });
      await store.createSession({ tokenHash: 't2', accountId: OWNER, createdAt: T0, lastUsedAt: T0 });
      same(await store.getSession('t1'), { tokenHash: 't1', accountId: OWNER, createdAt: T0, lastUsedAt: T0 }, 'read');
      await store.markActive('t1', OWNER, T0 + DAY);
      same((await store.getSession('t1'))?.lastUsedAt, T0 + DAY, 'session use');
      same((await store.getAccount(OWNER))?.lastActiveAt, T0 + DAY, 'account activity');
      same(await store.deleteSession('t1'), true, 'ended');
      same(await store.deleteSession('t1'), false, 'already ended');
      same(await store.getSession('t1'), null, 'gone');
      same((await store.getSession('t2'))?.accountId, OWNER, 'the other session stays');
    },
  },
  {
    name: 'usage: owned events and Spotify events by setter',
    async run(store) {
      await withEvent(store, { ...DOC, audio: { kind: 'spotify', url: 'https://open.spotify.com/track/37i9dQZF1DXcBWIGoYBM5M' } });
      await store.createEvent({ id: 'e2', ownerId: OWNER, doc: DOC, now: T0 });
      await store.createEvent({ id: 'e3', ownerId: OWNER, doc: DOC, now: T0 });
      await store.deleteEvent('e3', T0 + 1);
      same(await store.usage(OWNER), { events: 2, photos: 0, animatedBackdrop: 0, customAudio: 0, spotifyEvents: 1 }, 'owner');
      ok(await store.applyPatch({ eventId: EVENT, authorId: EDITOR, baseRev: 1, patch: { audio: { kind: 'spotify', url: 'https://open.spotify.com/album/37i9dQZF1DXcBWIGoYBM5M' } }, now: T0 + 2 }));
      same((await store.usage(OWNER)).spotifyEvents, 0, 'counted for the setter');
      same((await store.usage(EDITOR)).spotifyEvents, 1, 'the editor set it');
    },
  },
  {
    name: 'account deletion: owned events, memberships and sign-in data go; history keeps the change',
    async run(store) {
      await withEvent(store);
      await store.createAccount({ id: EDITOR, displayName: 'Editor', now: T0 });
      await store.createAccount({ id: OTHER, displayName: 'Other', now: T0 });
      await store.putMember({ eventId: EVENT, accountId: EDITOR, role: 'editor', inviteId: null, now: T0 });
      await store.createEvent({ id: 'theirs', ownerId: EDITOR, doc: DOC, now: T0 });
      await store.putMember({ eventId: 'theirs', accountId: OWNER, role: 'editor', inviteId: null, now: T0 });
      ok(await store.applyPatch({ eventId: 'theirs', authorId: OWNER, baseRev: 1, patch: { title: 'By the owner' }, now: T0 + 1 }));
      ok(await patch(store, OWNER, 1, { title: 'Owned change' }));
      await memo(store);
      await store.addIdentity({ accountId: OWNER, identity: google('g-1'), now: T0 });
      await store.createSession({ tokenHash: 't1', accountId: OWNER, createdAt: T0, lastUsedAt: T0 });
      await store.createSession({ tokenHash: 't2', accountId: EDITOR, createdAt: T0, lastUsedAt: T0 });

      const deleted = await store.deleteAccount(OWNER, T0 + 100);
      same(deleted, { ownedEventIds: [EVENT], memberEventIds: ['theirs'], media: [] }, 'deletion');
      same(await store.getAccount(OWNER), null, 'account');
      const event = await store.getEvent(EVENT);
      same([event?.deletedAt, event?.doc], [T0 + 100, {}], 'owned event is an empty tombstone');
      same(await store.listRevisions(EVENT, { limit: 10 }), [], 'owned revisions');
      same(await store.getMemo(MEMO), null, 'memos');
      same(await store.getMember(EVENT, EDITOR), null, 'members of owned events');
      same(await store.manifest(EDITOR), [{ id: 'theirs', rev: 2, role: 'owner', childSeq: 0 }], 'the editor no longer has the event');
      same(await store.getMember('theirs', OWNER), null, 'own membership');
      same((await store.listRevisions('theirs', { limit: 1 }))[0]?.authorId, null, 'authored revision kept without author');
      same([await store.getSession('t1'), (await store.getSession('t2'))?.accountId], [null, EDITOR], 'sessions');
      same(await store.listIdentities(OWNER), [], 'identities');
      same((await signIn(store, google('g-1'), 'acct-new')).status, 'created', 'the identity is free again');
      same(await store.deleteAccount(OWNER, T0 + 200), null, 'unknown account');
    },
  },

  // ---- Sync (task 3.6) ----
  {
    name: 'event: create refuses past the owned-event limit; deleted events do not count',
    async run(store) {
      for (let i = 0; i < 2; i++) same((await store.createEvent({ id: `e${i}`, ownerId: OWNER, doc: DOC, now: T0, maxOwned: 2 })).status, 'created', `e${i}`);
      same((await store.createEvent({ id: 'e2', ownerId: OWNER, doc: DOC, now: T0, maxOwned: 2 })).status, 'limit', 'third');
      same(await store.getEvent('e2'), null, 'nothing written');
      same((await store.createEvent({ id: 'e0', ownerId: OWNER, doc: DOC, now: T0, maxOwned: 2 })).status, 'exists', 'repeat at the limit');
      await store.deleteEvent('e0', T0 + 1);
      same((await store.createEvent({ id: 'e2', ownerId: OWNER, doc: DOC, now: T0 + 2, maxOwned: 2 })).status, 'created', 'after a delete');
      same((await store.createEvent({ id: 'x', ownerId: OTHER, doc: DOC, now: T0, maxOwned: 2 })).status, 'created', 'per owner');
    },
  },
  {
    name: 'event: a first sign-in upload passes the limit up to its own cap',
    async run(store) {
      const create = (id: string, firstUpload?: { since: number; max: number }) =>
        store.createEvent({ id, ownerId: OWNER, doc: DOC, now: T0 + 10, maxOwned: 1, ...(firstUpload ? { firstUpload } : {}) });
      same((await create('e0')).status, 'created', 'within the limit');
      same((await create('e1')).status, 'limit', 'over the limit');
      same((await create('e1', { since: T0, max: 2 })).status, 'created', 'first upload 1');
      same((await create('e2', { since: T0, max: 2 })).status, 'created', 'first upload 2');
      same((await create('e3', { since: T0, max: 2 })).status, 'limit', 'cap reached');
      same((await create('e3', { since: T0 + 11, max: 2 })).status, 'created', 'a later session has its own cap');
    },
  },
  {
    name: 'patch: a merged document over the size limit is refused without a write',
    async run(store) {
      await withEvent(store);
      const r = await store.applyPatch({ eventId: EVENT, authorId: OWNER, baseRev: 1, patch: { notes: 'x'.repeat(400) }, now: T0 + 1, maxDocBytes: 300 });
      same(r.status, 'too_large', 'status');
      same((await store.getEvent(EVENT))?.rev, 1, 'rev');
      same(await store.listRevisions(EVENT, { limit: 10 }), [], 'revisions');
      same((await store.applyPatch({ eventId: EVENT, authorId: OWNER, baseRev: 1, patch: { notes: 'short' }, now: T0 + 1, maxDocBytes: 300 })).status, 'ok', 'within');
    },
  },
  {
    name: 'manifest: owned and shared events with roles, by id, without deleted or removed ones',
    async run(store) {
      await withEvent(store);
      await store.createAccount({ id: EDITOR, displayName: 'Editor', now: T0 });
      for (const id of ['a-viewer', 'b-editor', 'c-removed', 'd-deleted']) await store.createEvent({ id, ownerId: OTHER, doc: DOC, now: T0 });
      await store.putMember({ eventId: 'a-viewer', accountId: OWNER, role: 'viewer', inviteId: null, now: T0 });
      await store.putMember({ eventId: 'b-editor', accountId: OWNER, role: 'editor', inviteId: 'inv', now: T0 });
      await store.putMember({ eventId: 'c-removed', accountId: OWNER, role: 'removed', inviteId: null, now: T0 });
      await store.putMember({ eventId: 'd-deleted', accountId: OWNER, role: 'editor', inviteId: null, now: T0 });
      await store.deleteEvent('d-deleted', T0 + 1);
      await memo(store);
      await store.putMemo({ eventId: 'b-editor', memoId: memoId(9), authorId: OTHER, doc: MEMO_DOC, now: T0, maxMemos: 500 });
      same(
        await store.manifest(OWNER),
        [
          { id: EVENT, rev: 1, role: 'owner', childSeq: 1 },
          { id: 'a-viewer', rev: 1, role: 'viewer', childSeq: 0 },
          { id: 'b-editor', rev: 1, role: 'editor', childSeq: 0 },
        ].sort((x, y) => (x.id < y.id ? -1 : 1)),
        'manifest',
      );
      await store.deleteEvent(EVENT, T0 + 2);
      same((await store.manifest(OWNER)).map((m) => m.id), ['a-viewer', 'b-editor'], 'after deleting the owned event');
      same(await store.manifest('nobody'), [], 'unknown account');
    },
  },
  {
    name: 'members: putMember adds and changes a membership',
    async run(store) {
      await withEvent(store);
      await store.putMember({ eventId: EVENT, accountId: EDITOR, role: 'viewer', inviteId: 'inv-1', now: T0 });
      await store.putMember({ eventId: EVENT, accountId: EDITOR, role: 'editor', inviteId: null, now: T0 + 5 });
      same(
        await store.getMember(EVENT, EDITOR),
        { eventId: EVENT, accountId: EDITOR, role: 'editor', inviteId: 'inv-1', archivedAt: null, reminders: null, createdAt: T0 },
        'member',
      );
      same(await store.getMember(EVENT, OTHER), null, 'not a member');
    },
  },
  {
    name: 'readEvents: each event with the reader\'s role, membership and the people on it',
    async run(store) {
      await withEvent(store);
      await store.createAccount({ id: EDITOR, displayName: 'Mum', now: T0 });
      await store.createAccount({ id: OTHER, displayName: 'Dad', now: T0 });
      await store.putMember({ eventId: EVENT, accountId: EDITOR, role: 'editor', inviteId: null, now: T0 + 1 });
      await store.putMember({ eventId: EVENT, accountId: OTHER, role: 'viewer', inviteId: null, now: T0 + 2 });
      await store.putMember({ eventId: EVENT, accountId: 'acct-removed', role: 'removed', inviteId: null, now: T0 + 3 });
      const [own] = await store.readEvents(OWNER, [EVENT, EVENT, 'missing']);
      same([own?.role, own?.membership, own?.people, own?.event.id], ['owner', null, [], EVENT], 'owner');
      const [mine] = await store.readEvents(EDITOR, [EVENT]);
      same([mine?.role, mine?.membership?.role, mine?.event.doc['title']], ['editor', 'editor', 'Our wedding'], 'editor');
      same(mine?.people, [{ name: 'Owner', role: 'owner' }, { name: 'Mum', role: 'editor' }, { name: 'Dad', role: 'viewer' }], 'people');
      same(await store.readEvents('acct-removed', [EVENT]), [], 'removed member');
      same(await store.readEvents('stranger', [EVENT]), [], 'stranger');
      same(await store.readEvents(OWNER, []), [], 'no ids');
      await store.deleteEvent(EVENT, T0 + 9);
      same((await store.readEvents(OWNER, [EVENT]))[0]?.event.deletedAt, T0 + 9, 'deleted events are returned for the caller to answer');
    },
  },
  {
    name: 'memos: create bumps the child sequence and repeating it is safe',
    async run(store) {
      await withEvent(store);
      const first = await memo(store);
      same(first, { id: MEMO, eventId: EVENT, authorId: OWNER, seq: 1, doc: MEMO_DOC, updatedAt: T0 + 10, deletedAt: null }, 'memo');
      same((await store.getEvent(EVENT))?.childSeq, 1, 'child seq');
      same((await store.getEvent(EVENT))?.rev, 1, 'rev unchanged');
      const again = await store.putMemo({ eventId: EVENT, memoId: MEMO, authorId: OWNER, doc: { ...MEMO_DOC, content: 'x' }, now: T0 + 20, maxMemos: 500 });
      same(again, { status: 'exists', memo: first }, 'repeat');
      same((await store.getEvent(EVENT))?.childSeq, 1, 'no bump on repeat');
      await store.createEvent({ id: 'other', ownerId: OWNER, doc: DOC, now: T0 });
      same((await store.putMemo({ eventId: 'other', memoId: MEMO, authorId: OWNER, doc: MEMO_DOC, now: T0, maxMemos: 500 })).status, 'conflict', 'id on another event');
      same((await store.putMemo({ eventId: 'missing', memoId: memoId(2), authorId: OWNER, doc: MEMO_DOC, now: T0, maxMemos: 500 })).status, 'event_missing', 'unknown event');
      same(await store.getMemo(MEMO), first, 'stored');
      same(await store.getMemo('missing'), null, 'unknown memo');
    },
  },
  {
    name: 'memos: an event takes at most maxMemos live memos',
    async run(store) {
      await withEvent(store);
      await memo(store, memoId(1));
      await memo(store, memoId(2));
      same((await store.putMemo({ eventId: EVENT, memoId: memoId(3), authorId: OWNER, doc: MEMO_DOC, now: T0, maxMemos: 2 })).status, 'limit', 'limit');
      ok(await patch(store, OWNER, 1, { title: 'unrelated' }));
      await store.deleteMemo(EVENT, memoId(1), T0 + 30);
      same((await store.putMemo({ eventId: EVENT, memoId: memoId(3), authorId: OWNER, doc: MEMO_DOC, now: T0, maxMemos: 2 })).status, 'created', 'after a delete');
      await store.deleteEvent(EVENT, T0 + 40);
      same((await store.putMemo({ eventId: EVENT, memoId: memoId(4), authorId: OWNER, doc: MEMO_DOC, now: T0, maxMemos: 2 })).status, 'event_missing', 'deleted event');
    },
  },
  {
    name: 'memos: patch merges fields, delete leaves a tombstone, each with a new seq',
    async run(store) {
      await withEvent(store);
      await memo(store);
      const p = await store.patchMemo({ eventId: EVENT, memoId: MEMO, patch: { content: 'Edited', milestoneTag: null }, now: T0 + 20 });
      same(p, { status: 'ok', changed: true, memo: { id: MEMO, eventId: EVENT, authorId: OWNER, seq: 2, doc: { content: 'Edited', createdAt: MEMO_DOC['createdAt'] as string }, updatedAt: T0 + 20, deletedAt: null } }, 'patched');
      const same1 = await store.patchMemo({ eventId: EVENT, memoId: MEMO, patch: { content: 'Edited' }, now: T0 + 30 });
      same([same1.status, same1.status === 'ok' && same1.changed, same1.status === 'ok' && same1.memo.seq], ['ok', false, 2], 'no change keeps the seq');
      const d = await store.deleteMemo(EVENT, MEMO, T0 + 40);
      same(d.status === 'ok' ? [d.memo.seq, d.memo.doc, d.memo.deletedAt] : d.status, [3, {}, T0 + 40], 'tombstone');
      same((await store.getEvent(EVENT))?.childSeq, 3, 'child seq');
      same((await store.patchMemo({ eventId: EVENT, memoId: MEMO, patch: { content: 'x' }, now: T0 + 50 })).status, 'not_found', 'patch a tombstone');
      same((await store.deleteMemo(EVENT, MEMO, T0 + 50)).status, 'not_found', 'delete twice');
      same((await store.deleteMemo('other', MEMO, T0 + 50)).status, 'not_found', 'wrong event');
    },
  },
  {
    name: 'children: changes after a seq, live memos, and purged tombstones',
    async run(store) {
      await withEvent(store);
      for (let i = 1; i <= 3; i++) await memo(store, memoId(i), { ...MEMO_DOC, content: `m${i}` }, T0 + i);
      await store.deleteMemo(EVENT, memoId(2), T0 + 10);
      const page = await store.listChildren(EVENT, 1);
      same(page?.memos.map((m) => [m.id, m.seq, m.deletedAt !== null]), [[memoId(3), 3, false], [memoId(2), 4, true]], 'after 1');
      same([page?.seq, page?.purgedSeq], [4, 0], 'seq');
      same((await store.listMemos(EVENT)).map((m) => m.id), [memoId(1), memoId(3)], 'live memos');
      same(await store.listChildren('missing', 0), null, 'unknown event');
      same(await store.purgeMemoTombstones(T0 + 10, 100), 0, 'not old enough');
      same(await store.purgeMemoTombstones(T0 + 11, 100), 1, 'purged');
      same(await store.getMemo(memoId(2)), null, 'tombstone gone');
      const after = await store.listChildren(EVENT, 0);
      same([after?.purgedSeq, after?.seq, after?.memos.map((m) => m.id)], [4, 4, [memoId(1), memoId(3)]], 'purged seq raised');
    },
  },
  {
    name: 'memos: concurrent writes on one event each get their own seq',
    async run(store) {
      await withEvent(store);
      await Promise.all(Array.from({ length: 8 }, (_, i) => memo(store, memoId(i + 1))));
      const seqs = (await store.listMemos(EVENT)).map((m) => m.seq).sort((a, b) => a - b);
      same(seqs, [1, 2, 3, 4, 5, 6, 7, 8], 'seqs');
      same((await store.getEvent(EVENT))?.childSeq, 8, 'child seq');
    },
  },
  // ---- Sharing (task 3.8) ----
  {
    name: 'links: create, read by id and token, list the active ones oldest first',
    async run(store) {
      await withEvent(store);
      const a = created(await store.createLink(newLink(1, { label: 'Instagram', now: T0 + 1 })));
      same(a, { id: linkId(1), token: token(1), eventId: EVENT, label: 'Instagram', createdAt: T0 + 1, expiresAt: null, revokedAt: null }, 'created');
      created(await store.createLink(newLink(2, { expiresAt: T0 + 5 * DAY })));
      created(await store.createLink(newLink(3, { expiresAt: T0 + 10 })));
      same(await store.getLink(linkId(1)), a, 'by id');
      same(await store.getLinkByToken(token(1)), a, 'by token');
      same(await store.getLink('missing'), null, 'unknown id');
      same(await store.getLinkByToken(token(9)), null, 'unknown token');
      same((await store.listLinks(EVENT, T0 + 10)).map((l) => l.id), [linkId(2), linkId(1)], 'expired one left out');
      same(await store.listLinks('other-event', T0), [], 'other event');
    },
  },
  {
    name: 'links: at most maxActive active ones; revoked and expired ones do not count',
    async run(store) {
      await withEvent(store);
      created(await store.createLink(newLink(1, { maxActive: 2 })));
      created(await store.createLink(newLink(2, { maxActive: 2, expiresAt: T0 + 10 })));
      same((await store.createLink(newLink(3, { maxActive: 2 }))).status, 'limit', 'third');
      same(await store.getLink(linkId(3)), null, 'nothing written');
      same((await store.createLink(newLink(3, { maxActive: 2, now: T0 + 10 }))).status, 'created', 'after one expired');
      same(await store.revokeLink(linkId(1), T0 + 11), true, 'revoke');
      same((await store.createLink(newLink(4, { maxActive: 2, now: T0 + 12 }))).status, 'created', 'after one was revoked');
    },
  },
  {
    name: 'links: a taken id or token writes nothing',
    async run(store) {
      await withEvent(store);
      created(await store.createLink(newLink(1)));
      same((await store.createLink({ ...newLink(2), token: token(1) })).status, 'taken', 'token');
      same((await store.createLink({ ...newLink(2), id: linkId(1) })).status, 'taken', 'id');
      same((await store.listLinks(EVENT, T0)).length, 1, 'links');
    },
  },
  {
    name: 'links: changes apply only while active, and revoking is permanent',
    async run(store) {
      await withEvent(store);
      created(await store.createLink(newLink(1, { label: 'Old', expiresAt: T0 + 100 })));
      same(await store.updateLink(linkId(1), { label: 'New' }, T0 + 1), { ...(await store.getLink(linkId(1))), label: 'New' }, 'label');
      const never = await store.updateLink(linkId(1), { expiresAt: null }, T0 + 2);
      same([never?.label, never?.expiresAt], ['New', null], 'expiry cleared, label kept');
      same(await store.updateLink(linkId(1), { label: null }, T0 + 3).then((l) => l?.label), null, 'label cleared');
      same(await store.updateLink('missing', { label: 'x' }, T0), null, 'unknown');
      created(await store.createLink(newLink(2, { expiresAt: T0 + 10 })));
      same((await store.updateLink(linkId(2), { expiresAt: null }, T0 + 10))?.expiresAt, T0 + 10, 'expired link unchanged');
      same(await store.revokeLink(linkId(1), T0 + 20), true, 'revoke');
      same(await store.revokeLink(linkId(1), T0 + 21), false, 'revoke again');
      same(await store.revokeLink('missing', T0), false, 'revoke unknown');
      const revoked = await store.updateLink(linkId(1), { label: 'Back' }, T0 + 22);
      same([revoked?.label, revoked?.revokedAt], [null, T0 + 20], 'revoked link unchanged');
    },
  },
  {
    name: 'invites: create, read by id and hash, list the active ones; full ones count against the limit',
    async run(store) {
      await withEvent(store);
      const a = createdInvite(await store.createInvite(newInvite(1, { role: 'editor', maxUses: 5, expiresAt: T0 + 30 * DAY })));
      same(a, {
        id: inviteId(1), tokenHash: hash(1), tokenEnc: `enc-${1}`, eventId: EVENT, role: 'editor', maxUses: 5, useCount: 0, createdAt: T0,
        expiresAt: T0 + 30 * DAY, revokedAt: null,
      }, 'created');
      same(await store.getInvite(inviteId(1)), a, 'by id');
      same(await store.getInviteByHash(hash(1)), a, 'by hash');
      same(await store.getInviteByHash(hash(9)), null, 'unknown hash');
      await store.createAccount({ id: OTHER, displayName: 'Other', now: T0 });
      createdInvite(await store.createInvite(newInvite(2, { maxUses: 1, maxActive: 2 })));
      same((await store.joinInvite(join(2, OTHER))).status, 'joined', 'fills invite 2');
      same((await store.createInvite(newInvite(3, { maxActive: 2 }))).status, 'limit', 'full invite still counts');
      same((await store.createInvite({ ...newInvite(3), tokenHash: hash(1) })).status, 'taken', 'taken hash');
      same((await store.listInvites(EVENT, T0)).map((i) => i.id), [inviteId(1), inviteId(2)], 'listed');
      same(await store.revokeInvite(inviteId(2), T0 + 1), true, 'revoke');
      same(await store.revokeInvite(inviteId(2), T0 + 2), false, 'revoke again');
      same((await store.listInvites(EVENT, T0 + 3)).map((i) => i.id), [inviteId(1)], 'revoked left out');
    },
  },
  {
    name: 'invites: changes apply only while active',
    async run(store) {
      await withEvent(store);
      createdInvite(await store.createInvite(newInvite(1, { expiresAt: T0 + 5 * DAY })));
      const changed = await store.updateInvite(inviteId(1), { role: 'editor', maxUses: null, expiresAt: null }, T0 + 1);
      same([changed?.role, changed?.maxUses, changed?.expiresAt], ['editor', null, null], 'changed');
      same((await store.updateInvite(inviteId(1), { maxUses: 10 }, T0 + 2))?.role, 'editor', 'other fields kept');
      same(await store.updateInvite('missing', { maxUses: 1 }, T0), null, 'unknown');
      createdInvite(await store.createInvite(newInvite(2, { expiresAt: T0 + 10 })));
      same((await store.updateInvite(inviteId(2), { expiresAt: null }, T0 + 10))?.expiresAt, T0 + 10, 'expired invite unchanged');
      await store.revokeInvite(inviteId(1), T0 + 3);
      same((await store.updateInvite(inviteId(1), { maxUses: 2 }, T0 + 4))?.maxUses, 10, 'revoked invite unchanged');
    },
  },
  {
    name: 'join: adds a member with the invite role and takes one use',
    async run(store) {
      await withEvent(store);
      await store.createAccount({ id: EDITOR, displayName: 'Editor', now: T0 });
      createdInvite(await store.createInvite(newInvite(1, { role: 'editor', maxUses: 5 })));
      const r = await store.joinInvite(join(1, EDITOR, T0 + 7));
      check(r.status === 'joined', `join: expected joined, got ${r.status}`);
      same(r.invite.useCount, 1, 'returned use count');
      same(r.member, { eventId: EVENT, accountId: EDITOR, role: 'editor', inviteId: inviteId(1), archivedAt: null, reminders: null, createdAt: T0 + 7 }, 'member');
      same((await store.getInvite(inviteId(1)))?.useCount, 1, 'stored use count');
      same(await store.getMember(EVENT, EDITOR), r.member, 'stored member');
      same((await store.manifest(EDITOR)).map((m) => [m.id, m.role]), [[EVENT, 'editor']], 'manifest');
      same(await store.joinInvite(join(9, EDITOR)), { status: 'not_found' }, 'unknown hash');
    },
  },
  {
    name: 'join: owners and members take no use; removed members cannot rejoin',
    async run(store) {
      await withEvent(store);
      await store.createAccount({ id: EDITOR, displayName: 'Editor', now: T0 });
      createdInvite(await store.createInvite(newInvite(1, { maxUses: null })));
      same((await store.joinInvite(join(1, OWNER))).status, 'owner', 'owner');
      same((await store.joinInvite(join(1, EDITOR))).status, 'joined', 'first join');
      same((await store.joinInvite(join(1, EDITOR))).status, 'member', 'second join');
      same((await store.getInvite(inviteId(1)))?.useCount, 1, 'one use');
      same(await store.removeMember(EVENT, EDITOR), true, 'removed');
      same((await store.joinInvite(join(1, EDITOR))).status, 'removed', 'removed member');
      same((await store.getMember(EVENT, EDITOR))?.role, 'removed', 'still blocked');
      same((await store.getInvite(inviteId(1)))?.useCount, 1, 'no use taken');
    },
  },
  {
    name: 'join: revoked, expired and full invites and deleted events refuse without a write',
    async run(store) {
      await withEvent(store);
      for (const id of [EDITOR, OTHER]) await store.createAccount({ id, displayName: id, now: T0 });
      createdInvite(await store.createInvite(newInvite(1)));
      createdInvite(await store.createInvite(newInvite(2, { expiresAt: T0 + 10 })));
      createdInvite(await store.createInvite(newInvite(3, { maxUses: 1 })));
      createdInvite(await store.createInvite(newInvite(4)));
      await store.revokeInvite(inviteId(1), T0 + 1);
      same((await store.joinInvite(join(1, OTHER, T0 + 2))).status, 'revoked', 'revoked');
      same((await store.joinInvite(join(2, OTHER, T0 + 10))).status, 'expired', 'expired');
      same((await store.joinInvite(join(3, EDITOR))).status, 'joined', 'last use');
      same((await store.joinInvite(join(3, OTHER))).status, 'full', 'full');
      await store.deleteEvent(EVENT, T0 + 20);
      same((await store.joinInvite(join(4, OTHER, T0 + 21))).status, 'deleted', 'deleted event');
      same(await store.getMember(EVENT, OTHER), null, 'no member written');
      same((await store.getInvite(inviteId(3)))?.useCount, 1, 'uses');
    },
  },
  {
    name: 'join: concurrent joins never pass the use count or the member limit',
    async run(store) {
      await withEvent(store);
      const people = Array.from({ length: 8 }, (_, i) => `acct-${i}`);
      for (const id of people) await store.createAccount({ id, displayName: id, now: T0 });
      createdInvite(await store.createInvite(newInvite(1, { maxUses: 3 })));
      createdInvite(await store.createInvite(newInvite(2, { maxUses: null })));
      const first = await Promise.all(people.map((id) => store.joinInvite(join(1, id))));
      same(first.filter((r) => r.status === 'joined').length, 3, 'joined through the 3-use invite');
      same(first.filter((r) => r.status === 'full').length, 5, 'told it is full');
      same((await store.getInvite(inviteId(1)))?.useCount, 3, 'use count');
      const second = await Promise.all(people.map((id) => store.joinInvite({ ...join(2, id), maxMembers: 5 })));
      same(second.filter((r) => r.status === 'joined').length, 2, 'joined up to the member limit');
      same(second.filter((r) => r.status === 'members_limit').length, 3, 'refused at the limit');
      same((await store.listMembers(EVENT)).length, 5, 'members');
      same((await store.getInvite(inviteId(2)))?.useCount, 2, 'uses of the unlimited invite');
    },
  },
  {
    name: 'members: list with names, change roles, remove, leave and allow again',
    async run(store) {
      await withEvent(store);
      await store.createAccount({ id: EDITOR, displayName: 'Mum', now: T0 });
      await store.createAccount({ id: OTHER, displayName: 'Dad', now: T0 });
      createdInvite(await store.createInvite(newInvite(1, { maxUses: null })));
      await store.joinInvite(join(1, EDITOR, T0 + 1));
      await store.joinInvite(join(1, OTHER, T0 + 2));
      same(await store.listMembers(EVENT), [
        { accountId: EDITOR, name: 'Mum', role: 'viewer', inviteId: inviteId(1), createdAt: T0 + 1 },
        { accountId: OTHER, name: 'Dad', role: 'viewer', inviteId: inviteId(1), createdAt: T0 + 2 },
      ], 'listed');
      same(await store.setMemberRole(EVENT, EDITOR, 'editor'), true, 'role change');
      same((await store.getMember(EVENT, EDITOR))?.role, 'editor', 'stored role');
      same(await store.setMemberRole(EVENT, OWNER, 'editor'), false, 'owner is no member');
      same(await store.removeMember(EVENT, OTHER), true, 'remove');
      same(await store.removeMember(EVENT, OTHER), false, 'remove again');
      same(await store.setMemberRole(EVENT, OTHER, 'editor'), false, 'removed role stays');
      same((await store.listMembers(EVENT)).map((m) => [m.accountId, m.role]), [[EDITOR, 'editor'], [OTHER, 'removed']], 'removed listed');
      same((await store.manifest(OTHER)).length, 0, 'removed member has no event');
      same(await store.deleteMember(EVENT, OTHER, 'active'), false, 'a removed member cannot leave the block');
      same(await store.deleteMember(EVENT, EDITOR, 'removed'), false, 'allow again needs a block');
      same(await store.deleteMember(EVENT, EDITOR, 'active'), true, 'leave');
      same(await store.deleteMember(EVENT, OTHER, 'removed'), true, 'allow again');
      same(await store.listMembers(EVENT), [], 'nobody left');
      same((await store.joinInvite(join(1, OTHER, T0 + 3))).status, 'joined', 'rejoins once allowed');
    },
  },
  {
    name: 'account deletion: invites of owned events go, links stay for their 410',
    async run(store) {
      await withEvent(store);
      created(await store.createLink(newLink(1)));
      createdInvite(await store.createInvite(newInvite(1)));
      await store.deleteAccount(OWNER, T0 + 5);
      same(await store.getInvite(inviteId(1)), null, 'invite');
      same((await store.getLinkByToken(token(1)))?.eventId, EVENT, 'link');
      same((await store.getEvent(EVENT))?.deletedAt, T0 + 5, 'event tombstone');
    },
  },
];

// ---- Sharing fixtures ----

const linkId = (n: number): string => `11111111-0000-4000-8000-${String(n).padStart(12, '0')}`;
const inviteId = (n: number): string => `22222222-0000-4000-8000-${String(n).padStart(12, '0')}`;
const token = (n: number): string => `tok${String(n).padStart(19, '0')}`;
const hash = (n: number): string => `hash-${n}`;

function newLink(n: number, o: Partial<{ label: string | null; expiresAt: number | null; now: number; maxActive: number }> = {}): NewLink {
  return { id: linkId(n), token: token(n), eventId: EVENT, label: o.label ?? null, expiresAt: o.expiresAt ?? null, now: o.now ?? T0, maxActive: o.maxActive ?? 10 };
}

function newInvite(
  n: number,
  o: Partial<{ role: 'viewer' | 'editor'; maxUses: number | null; expiresAt: number | null; now: number; maxActive: number }> = {},
): NewInvite {
  return {
    id: inviteId(n), tokenHash: hash(n), tokenEnc: `enc-${n}`, eventId: EVENT, role: o.role ?? 'viewer',
    maxUses: o.maxUses === undefined ? 1 : o.maxUses, expiresAt: o.expiresAt ?? null, now: o.now ?? T0, maxActive: o.maxActive ?? 20,
  };
}

function join(n: number, accountId: string, now = T0): JoinInput {
  return { tokenHash: hash(n), accountId, now, maxMembers: 100 };
}

function created(outcome: CreateLinkOutcome): LinkRecord {
  check(outcome.status === 'created', `createLink: expected created, got ${outcome.status}`);
  return outcome.link;
}

function createdInvite(outcome: CreateInviteOutcome): InviteRecord {
  check(outcome.status === 'created', `createInvite: expected created, got ${outcome.status}`);
  return outcome.invite;
}

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

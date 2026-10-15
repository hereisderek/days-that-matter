// Scenarios of openspec/changes/pluggable-backend-live-sharing/specs/event-sync/spec.md that the
// backend core serves, one test per scenario, named after it, against MemoryStore and SqlStore. The
// first sign-in upload scenarios of the accounts and premium specs live here too, since they are
// sync writes. App-only scenarios are listed in test/spec-coverage.test.ts.
import { beforeEach, describe, expect, it } from 'vitest';
import { resetImportRateLimitsForTesting } from '../../src/http/sync.ts';
import { MemoryStore } from '../../src/fakes/memory-store.ts';
import { openSqliteStore } from '../../src/node/node-sqlite-driver.ts';
import { pollHub } from '../../src/ports/live.ts';
import type { Store } from '../../src/ports/store.ts';
import { testApi } from '../support/api.ts';
import type { Api } from '../support/api.ts';

const THEME = { paletteId: 'violet', cardStyle: 'glass', typography: 'modern' };
const DOC = { title: 'Our wedding', targetDate: '2027-06-12', theme: THEME };
const uuid = (n: number): string => `0b8f3c1e-6d0a-4a51-9f61-${String(n).padStart(12, '0')}`;
const memoUuid = (n: number): string => `5c1f0000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const DAY_MS = 86_400_000;

type Manifest = { events: { id: string; rev: number; role: string; childSeq: number }[] };
type Children = { memos: { id: string; seq: number; deleted: boolean; content?: string }[]; seq: number; reset: boolean };
type ErrorBody = { error: { code: string; message: string; details: unknown } };

const stores: Record<string, () => Promise<Store>> = {
  MemoryStore: async () => new MemoryStore(),
  SqlStore: async () => (await openSqliteStore()).store,
};

/** Owner and editor of one shared event. */
async function shared(api: Api) {
  const owner = await api.google('owner-sub', undefined, 'Owner');
  const editor = await api.google('editor-sub', undefined, 'Editor');
  expect((await api.call('PUT', `events/${uuid(1)}`, { token: owner.token, body: { ...DOC, notes: 'Book the photographer', categoryId: 'family' } })).status).toBe(201);
  await api.ports.store.putMember({ eventId: uuid(1), accountId: editor.accountId, role: 'editor', inviteId: null, now: 0 });
  return { owner, editor };
}

for (const [storeName, newStore] of Object.entries(stores)) {
  describe(`event-sync scenarios (${storeName})`, () => {
    beforeEach(() => {
      resetImportRateLimitsForTesting();
    });

    const api = async (): Promise<Api> => testApi({ store: await newStore() });

    it('Second device', async () => {
      const a = await api();
      const phone = await a.google('owner-sub');
      for (const n of [1, 2]) await a.call('PUT', `events/${uuid(n)}`, { token: phone.token, body: { ...DOC, title: `Day ${n}` } });
      await a.call('PUT', `events/${uuid(1)}/memos/${memoUuid(1)}`, { token: phone.token, body: { content: 'First memo', createdAt: '2026-10-12T15:04:05Z' } });

      const tablet = await a.google('owner-sub');
      const manifest = await a.call<Manifest>('GET', 'sync', { token: tablet.token });
      expect(manifest.body.events).toEqual([
        { id: uuid(1), rev: 1, role: 'owner', childSeq: 1 },
        { id: uuid(2), rev: 1, role: 'owner', childSeq: 0 },
      ]);
      const fetched = await a.call<{ events: { title: string }[] }>('POST', 'events/fetch', { token: tablet.token, body: { ids: manifest.body.events.map((e) => e.id) } });
      expect(fetched.body.events.map((e) => e.title)).toEqual(['Day 1', 'Day 2']);
      const memos = await a.call<Children>('GET', `events/${uuid(1)}/children?after=0`, { token: tablet.token });
      expect(memos.body).toEqual({
        memos: [{ id: memoUuid(1), seq: 1, deleted: false, content: 'First memo', createdAt: '2026-10-12T15:04:05Z', updatedAt: '2026-10-12T15:04:05Z' }],
        seq: 1,
        reset: false,
      });
    });

    it('User taps Sync', async () => {
      // The Sync button runs the same manifest request; an idle sync is one 304.
      const a = await api();
      const { token } = await a.google('owner-sub');
      await a.call('PUT', `events/${uuid(1)}`, { token, body: DOC });
      const first = await a.call('GET', 'sync', { token });
      const etag = first.headers.get('ETag') as string;
      expect([first.status, etag]).toEqual([200, expect.stringMatching(/^"[0-9a-f]{32}"$/)]);
      const idle = await a.call('GET', 'sync', { token, headers: { 'If-None-Match': etag } });
      expect([idle.status, idle.body, idle.headers.get('ETag')]).toEqual([304, null, etag]);
      await a.call('PATCH', `events/${uuid(1)}`, { token, body: { baseRev: 1, patch: { title: 'Changed' } } });
      expect((await a.call('GET', 'sync', { token, headers: { 'If-None-Match': etag } })).status).toBe(200);
    });

    it('Different fields', async () => {
      const a = await api();
      const { owner, editor } = await shared(a);
      // Both edited rev 1 offline; the editor's date arrives first, then the owner's title.
      expect((await a.call('PATCH', `events/${uuid(1)}`, { token: editor.token, body: { baseRev: 1, patch: { targetDate: '2027-06-13' } } })).status).toBe(200);
      const r = await a.call<{ event: { title: string; targetDate: string; rev: number }; overwritten: string[] }>('PATCH', `events/${uuid(1)}`, {
        token: owner.token, body: { baseRev: 1, patch: { title: 'Our wedding day' } },
      });
      expect([r.body.event.title, r.body.event.targetDate, r.body.event.rev, r.body.overwritten]).toEqual(['Our wedding day', '2027-06-13', 3, []]);
    });

    it('Same field', async () => {
      const a = await api();
      const { owner, editor } = await shared(a);
      await a.call('PATCH', `events/${uuid(1)}`, { token: owner.token, body: { baseRev: 1, patch: { targetTime: '16:00:00' } } });
      expect((await a.call('PATCH', `events/${uuid(1)}`, { token: editor.token, body: { baseRev: 2, patch: { targetTime: '18:00:00' } } })).status).toBe(200);
      // The owner's older offline edit (made at rev 2) arrives last.
      const r = await a.call<{ event: { targetTime: string }; overwritten: string[] }>('PATCH', `events/${uuid(1)}`, {
        token: owner.token, body: { baseRev: 2, patch: { targetTime: '17:00:00' } },
      });
      expect([r.status, r.body.event.targetTime, r.body.overwritten]).toEqual([200, '17:00:00', ['targetTime']]);
      const history = await a.ports.store.listRevisions(uuid(1), { limit: 10 });
      expect(history.map((h) => [h.authorId, h.patch['targetTime'], h.inverse['targetTime'], h.overwrote])).toEqual([
        [owner.accountId, '17:00:00', '18:00:00', ['targetTime']],
        [editor.accountId, '18:00:00', '16:00:00', []],
        [owner.accountId, '16:00:00', null, []],
      ]);
    });

    it('Editor syncs an event with notes and memos', async () => {
      const a = await api();
      const { owner, editor } = await shared(a);
      await a.call('PUT', `events/${uuid(1)}/memos/${memoUuid(1)}`, { token: owner.token, body: { content: 'Private', createdAt: '2026-10-12T15:04:05Z' } });
      const manifest = await a.call<Manifest>('GET', 'sync', { token: editor.token });
      expect(manifest.body.events).toEqual([{ id: uuid(1), rev: 1, role: 'editor', childSeq: 0 }]);
      const fetched = await a.call<{ events: Record<string, unknown>[] }>('POST', 'events/fetch', { token: editor.token, body: { ids: [uuid(1)] } });
      const doc = fetched.body.events[0] as Record<string, unknown>;
      expect(doc).toEqual({
        id: uuid(1), rev: 1, role: 'editor', title: 'Our wedding', targetDate: '2027-06-12', theme: THEME, updatedAt: '2026-10-12T15:04:05Z',
        members: [{ name: 'Owner', role: 'owner' }, { name: 'Editor', role: 'editor' }], archived: false,
      });
      for (const field of ['notes', 'categoryId', 'pinnedAt', 'archivedAt']) expect(doc).not.toHaveProperty(field);
      const memos = await a.call<ErrorBody>('GET', `events/${uuid(1)}/children?after=0`, { token: editor.token });
      expect([memos.status, memos.body.error.code]).toEqual([403, 'forbidden']);
      const write = await a.call<ErrorBody>('PATCH', `events/${uuid(1)}`, { token: editor.token, body: { baseRev: 1, patch: { notes: 'mine' } } });
      expect([write.status, write.body.error.code]).toEqual([403, 'field_not_allowed']);
    });

    it('Memo deleted on another device', async () => {
      const a = await api();
      const phone = await a.google('owner-sub');
      const tablet = await a.google('owner-sub');
      await a.call('PUT', `events/${uuid(1)}`, { token: phone.token, body: DOC });
      await a.call('PUT', `events/${uuid(1)}/memos/${memoUuid(1)}`, { token: phone.token, body: { content: 'Gone soon', createdAt: '2026-10-12T15:04:05Z' } });
      const before = await a.call<Children>('GET', `events/${uuid(1)}/children?after=0`, { token: tablet.token });
      expect(before.body.seq).toBe(1);
      expect((await a.call('DELETE', `events/${uuid(1)}/memos/${memoUuid(1)}`, { token: phone.token })).status).toBe(204);
      const after = await a.call<Children>('GET', `events/${uuid(1)}/children?after=${before.body.seq}`, { token: tablet.token });
      expect(after.body).toEqual({ memos: [{ id: memoUuid(1), seq: 2, deleted: true }], seq: 2, reset: false });
      expect((await a.call<Manifest>('GET', 'sync', { token: tablet.token })).body.events[0]?.childSeq).toBe(2);
    });

    it('Device offline for two months', async () => {
      const a = await api();
      const phone = await a.google('owner-sub');
      const tablet = await a.google('owner-sub');
      await a.call('PUT', `events/${uuid(1)}`, { token: phone.token, body: DOC });
      for (const n of [1, 2, 3]) {
        await a.call('PUT', `events/${uuid(1)}/memos/${memoUuid(n)}`, { token: phone.token, body: { content: `Memo ${n}`, createdAt: '2026-10-12T15:04:05Z' } });
      }
      const lastSync = (await a.call<Children>('GET', `events/${uuid(1)}/children?after=0`, { token: tablet.token })).body.seq;
      await a.call('DELETE', `events/${uuid(1)}/memos/${memoUuid(1)}`, { token: phone.token });
      await a.call('PATCH', `events/${uuid(1)}/memos/${memoUuid(2)}`, { token: phone.token, body: { patch: { content: 'Edited' } } });
      a.ports.clock.advance(60 * DAY_MS);
      // The daily job removes tombstones older than 30 days.
      expect(await a.ports.store.purgeMemoTombstones(Math.floor(a.ports.clock.nowMs() / 1000) - 30 * 86_400, 500)).toBe(1);
      const tabletAgain = await a.google('owner-sub');
      const r = await a.call<Children>('GET', `events/${uuid(1)}/children?after=${lastSync}`, { token: tabletAgain.token });
      expect(r.body.reset).toBe(true);
      expect(r.body.memos.map((m) => [m.id, m.content])).toEqual([[memoUuid(3), 'Memo 3'], [memoUuid(2), 'Edited']]);
      expect(r.body.seq).toBe(5);
      const caughtUp = await a.call<Children>('GET', `events/${uuid(1)}/children?after=${r.body.seq}`, { token: tabletAgain.token });
      expect([caughtUp.body.reset, caughtUp.body.memos]).toEqual([false, []]);
    });

    it('Title too long', async () => {
      const a = await api();
      const { token } = await a.google('owner-sub');
      const r = await a.call('PUT', `events/${uuid(1)}`, { token, body: { ...DOC, title: 'a'.repeat(101) } });
      expect([r.status, r.body]).toEqual([400, { error: { code: 'invalid_payload', message: 'title: must be 1 to 100 characters', details: { field: 'title' } } }]);
      await a.call('PUT', `events/${uuid(1)}`, { token, body: DOC });
      const p = await a.call('PATCH', `events/${uuid(1)}`, { token, body: { baseRev: 1, patch: { title: 'a'.repeat(101) } } });
      expect([p.status, (p.body as ErrorBody).error.details]).toEqual([400, { field: 'title' }]);
    });

    it('Owner deletes a shared event', async () => {
      const a = await api();
      const { owner, editor } = await shared(a);
      const editor2 = await a.google('editor2-sub');
      await a.ports.store.putMember({ eventId: uuid(1), accountId: editor2.accountId, role: 'editor', inviteId: null, now: 0 });
      expect((await a.call('DELETE', `events/${uuid(1)}`, { token: owner.token })).status).toBe(204);
      for (const e of [editor, editor2]) {
        expect((await a.call<Manifest>('GET', 'sync', { token: e.token })).body.events).toEqual([]);
        const r = await a.call<ErrorBody>('GET', `events/${uuid(1)}`, { token: e.token });
        expect([r.status, r.body.error.code]).toEqual([410, 'deleted']);
      }
      // Its links answer for a tombstone ("no longer available", task 3.9).
      expect((await a.ports.store.getEvent(uuid(1)))?.deletedAt).not.toBeNull();
      expect(a.ports.live.published).toContainEqual({ eventId: uuid(1), message: { type: 'access' } });
    });

    it('Owner watches an editor\'s change', async () => {
      const a = await api();
      const { owner, editor } = await shared(a);
      const open = await a.call('GET', `events/${uuid(1)}`, { token: owner.token });
      await a.call('PATCH', `events/${uuid(1)}`, { token: editor.token, body: { baseRev: 1, patch: { title: 'New title' } } });
      // ws mode: a change notice without data; the owner's screen refetches.
      expect(a.ports.live.published).toContainEqual({ eventId: uuid(1), message: { type: 'rev', rev: 2 } });
      const refetch = await a.call<{ title: string }>('GET', `events/${uuid(1)}`, { token: owner.token, headers: { 'If-None-Match': open.headers.get('ETag') as string } });
      expect([refetch.status, refetch.body.title]).toEqual([200, 'New title']);
      const idle = await a.call('GET', `events/${uuid(1)}`, { token: owner.token, headers: { 'If-None-Match': refetch.headers.get('ETag') as string } });
      expect(idle.status).toBe(304);
      // poll mode publishes nothing; the conditional GET above is how the app sees the change.
      const polled = await testApi({ store: await newStore(), live: pollHub });
      const p = await shared(polled);
      await polled.call('PATCH', `events/${uuid(1)}`, { token: p.editor.token, body: { baseRev: 1, patch: { title: 'Polled' } } });
      expect((await polled.call<{ title: string }>('GET', `events/${uuid(1)}`, { token: p.owner.token })).body.title).toBe('Polled');
    });

    it('Offline events in one request', async () => {
      const a = await api();
      const { token } = await a.google('owner-sub');
      const events = Array.from({ length: 12 }, (_, i) => ({
        id: uuid(i + 1),
        title: `Event ${i + 1}`,
        targetDate: '2027-06-12',
        theme: THEME,
      }));
      const r = await a.call<{ results: { id: string; status: string; error?: { code: string } }[] }>('POST', 'events/batch', {
        token,
        body: { events },
      });
      expect(r.status).toBe(200);
      expect(r.body.results).toHaveLength(12);
      expect(r.body.results.slice(0, 10).every((res, i) => res.id === uuid(i + 1) && res.status === 'created')).toBe(true);
      expect(r.body.results.slice(10).every((res, i) => res.id === uuid(i + 11) && res.status === 'error' && res.error?.code === 'premium_required')).toBe(true);
      for (let i = 1; i <= 10; i++) {
        expect(await a.ports.store.getEvent(uuid(i))).not.toBeNull();
      }
      for (let i = 11; i <= 12; i++) {
        expect(await a.ports.store.getEvent(uuid(i))).toBeNull();
      }
    });

    it('Response lost', async () => {
      const a = await api();
      const { token } = await a.google('owner-sub');
      const events = Array.from({ length: 5 }, (_, i) => ({
        id: uuid(i + 1),
        title: `Event ${i + 1}`,
        targetDate: '2027-06-12',
        theme: THEME,
      }));
      const first = await a.call<{ results: { id: string; status: string }[] }>('POST', 'events/batch', {
        token,
        body: { events },
      });
      expect(first.status).toBe(200);
      expect(first.body.results.every((res) => res.status === 'created')).toBe(true);

      // Repeat request
      const repeat = await a.call<{ results: { id: string; status: string }[] }>('POST', 'events/batch', {
        token,
        body: { events },
      });
      expect(repeat.status).toBe(200);
      expect(repeat.body.results).toHaveLength(5);
      expect(repeat.body.results.every((res) => res.status === 'exists')).toBe(true);
      const manifest = await a.call<Manifest>('GET', 'sync', { token });
      expect(manifest.body.events).toHaveLength(5);
    });

    it('Import above the limit', async () => {
      const a = await api();
      const { token } = await a.google('owner-sub');
      const initialEvents = Array.from({ length: 20 }, (_, i) => ({
        id: uuid(i + 1),
        title: `Event ${i + 1}`,
        targetDate: '2027-06-12',
        theme: THEME,
      }));
      const r1 = await a.call<{ imported: { id: string; unstoredFields: string[] }[] }>('POST', 'events/import', {
        token,
        body: { events: initialEvents },
      });
      expect(r1.status).toBe(200);
      expect(r1.body.imported).toHaveLength(20);

      // Import 5 more local events
      const localEvents = Array.from({ length: 5 }, (_, i) => ({
        id: uuid(i + 21),
        title: `Local Event ${i + 1}`,
        targetDate: '2027-06-12',
        theme: THEME,
      }));
      const r2 = await a.call<{ imported: { id: string; unstoredFields: string[] }[] }>('POST', 'events/import', {
        token,
        body: { events: localEvents },
      });
      expect(r2.status).toBe(200);
      expect(r2.body.imported.map((item) => item.id)).toEqual(localEvents.map((e) => e.id));
      expect(r2.body.imported.every((item) => item.unstoredFields.length === 0)).toBe(true);

      const manifest = await a.call<Manifest>('GET', 'sync', { token });
      expect(manifest.body.events).toHaveLength(25);
    });

    it('Import with an unknown field', async () => {
      const a = await api();
      const { token } = await a.google('owner-sub');
      const events = [
        {
          id: uuid(1),
          title: 'Valid Event',
          targetDate: '2027-06-12',
          theme: THEME,
          unknownField: 'unexpected',
        },
      ];
      const r = await a.call<ErrorBody>('POST', 'events/import', {
        token,
        body: { events },
      });
      expect(r.status).toBe(400);
      expect(r.body.error.code).toBe('invalid_payload');
      expect((r.body.error.details as Record<string, unknown>)?.['field']).toBe('unknownField');
      expect(await a.ports.store.getEvent(uuid(1))).toBeNull();
    });

    it('One invalid event fails the import', async () => {
      const a = await api();
      const { token } = await a.google('owner-sub');
      const events = Array.from({ length: 10 }, (_, i) => ({
        id: uuid(i + 1),
        title: i === 4 ? '' : `Event ${i + 1}`,
        targetDate: '2027-06-12',
        theme: THEME,
      }));
      const r = await a.call<ErrorBody>('POST', 'events/import', {
        token,
        body: { events },
      });
      expect(r.status).toBe(400);
      expect(r.body.error.code).toBe('invalid_payload');
      expect((r.body.error.details as Record<string, unknown>)?.['field']).toBe('title');
      expect((r.body.error.details as Record<string, unknown>)?.['eventId']).toBe(uuid(5));
      for (let i = 1; i <= 10; i++) {
        expect(await a.ports.store.getEvent(uuid(i))).toBeNull();
      }
    });

    it('Repeat an import', async () => {
      const a = await api();
      const { token } = await a.google('owner-sub');
      const events = Array.from({ length: 3 }, (_, i) => ({
        id: uuid(i + 1),
        title: `Event ${i + 1}`,
        targetDate: '2027-06-12',
        theme: THEME,
        memos: [
          { id: memoUuid(i + 1), content: `Memo ${i + 1}`, createdAt: '2026-10-15T12:00:00Z' },
        ],
      }));
      const first = await a.call<{ imported: { id: string }[] }>('POST', 'events/import', {
        token,
        body: { events },
      });
      expect(first.status).toBe(200);
      expect(first.body.imported.map((e) => e.id)).toEqual(events.map((e) => e.id));

      const repeat = await a.call<{ imported: { id: string }[] }>('POST', 'events/import', {
        token,
        body: { events },
      });
      expect(repeat.status).toBe(200);
      expect(repeat.body.imported.map((e) => e.id)).toEqual(events.map((e) => e.id));
      const manifest = await a.call<Manifest>('GET', 'sync', { token });
      expect(manifest.body.events).toHaveLength(3);
    });

    it('Create above the limit without an import', async () => {
      const a = await api();
      const { token } = await a.google('owner-sub');
      const events = Array.from({ length: 20 }, (_, i) => ({
        id: uuid(i + 1),
        title: `Event ${i + 1}`,
        targetDate: '2027-06-12',
        theme: THEME,
      }));
      expect((await a.call('POST', 'events/import', { token, body: { events } })).status).toBe(200);

      const r = await a.call<ErrorBody>('PUT', `events/${uuid(21)}`, {
        token,
        body: DOC,
      });
      expect(r.status).toBe(402);
      expect(r.body.error.code).toBe('premium_required');
      expect((r.body.error.details as Record<string, unknown>)?.['feature']).toBe('events');
      expect(await a.ports.store.getEvent(uuid(21))).toBeNull();
    });
  });
}

// Scenarios of openspec/changes/pluggable-backend-live-sharing/specs/event-history/spec.md, one test
// per scenario, named after it, against MemoryStore and SqlStore. App-only parts (the history screen)
// are task 7.6; test/spec-coverage.test.ts checks that every scenario is here or assigned.
import { describe, expect, it } from 'vitest';
import { testApi } from '../support/api.ts';
import type { Api } from '../support/api.ts';
import { THEME, patchAs, pick, sharedEvent, stores, uuid } from '../support/events.ts';
import type { ErrorBody } from '../support/events.ts';

type Change = { field: string; from: unknown; to: unknown };
type Revision = { rev: number; author: { name: string } | null; at: string; changes: Change[]; overwrote: string[]; restoredFrom: number | null };
type Page = { revisions: Revision[]; next: number | null };
type EventBody = Record<string, unknown> & { rev: number };

const SHARED = ['title', 'emoji', 'targetDate', 'targetTime', 'timeZone', 'unitMode', 'recurrence', 'theme', 'backdrop', 'audio'];
/** The shared fields of a document; `unitMode` and `recurrence` read as their defaults while absent. */
const sharedOf = (doc: Record<string, unknown>): Record<string, unknown> => ({
  unitMode: 'auto',
  recurrence: { type: 'none' },
  ...Object.fromEntries(SHARED.filter((f) => f in doc).map((f) => [f, doc[f]])),
});

for (const [storeName, newStore] of Object.entries(stores)) {
  describe(`event-history scenarios (${storeName})`, () => {
    const api = async (): Promise<Api> => testApi({ store: await newStore() });

    it('Two fields in one save', async () => {
      const a = await api();
      const { owner, people } = await sharedEvent(a);
      const theme = { ...THEME, cardStyle: 'solid' };
      const rev = await patchAs(a, pick(people, 'Editor').token, { targetDate: '2027-07-01', theme });

      for (const reader of [owner, pick(people, 'Editor')]) {
        const page = await a.call<Page>('GET', `events/${uuid(1)}/revisions`, { token: reader.token });
        expect(page.status).toBe(200);
        expect(page.body.revisions).toHaveLength(1);
        expect(page.body.revisions[0]).toEqual({
          rev,
          author: { name: 'Editor' },
          at: '2026-10-12T15:04:05Z',
          changes: [
            { field: 'targetDate', from: '2027-06-12', to: '2027-07-01' },
            { field: 'theme', from: THEME, to: theme },
          ],
          overwrote: [],
          restoredFrom: null,
        });
      }
    });

    it('Viewer', async () => {
      const a = await api();
      const { owner, people } = await sharedEvent(a, { Viewer: 'viewer' });
      await patchAs(a, owner.token, { title: 'Our wedding day' });
      const viewer = pick(people, 'Viewer');
      const list = await a.call<ErrorBody>('GET', `events/${uuid(1)}/revisions`, { token: viewer.token });
      expect(list.status).toBe(403);
      expect(list.body.error.code).toBe('forbidden');
      const restore = await a.call<ErrorBody>('POST', `events/${uuid(1)}/restore`, { token: viewer.token, body: { rev: 1 } });
      expect(restore.status).toBe(403);
      expect(restore.body.error.code).toBe('forbidden');
      expect((await a.call<EventBody>('GET', `events/${uuid(1)}`, { token: owner.token })).body['title']).toBe('Our wedding day');
    });

    it('Owner edits notes', async () => {
      const a = await api();
      const { owner, people } = await sharedEvent(a);
      const titleRev = await patchAs(a, owner.token, { title: 'Our wedding day' });
      const notesRev = await patchAs(a, owner.token, { notes: 'Call the florist' });

      const mine = await a.call<Page>('GET', `events/${uuid(1)}/revisions`, { token: owner.token });
      expect(mine.body.revisions.map((r) => r.rev)).toEqual([notesRev, titleRev]);
      expect(mine.body.revisions[0]?.changes).toEqual([{ field: 'notes', from: 'Book the photographer', to: 'Call the florist' }]);

      const theirs = await a.call<Page>('GET', `events/${uuid(1)}/revisions`, { token: pick(people, 'Editor').token });
      expect(theirs.body.revisions.map((r) => r.rev)).toEqual([titleRev]);
      expect(JSON.stringify(theirs.body)).not.toContain('florist');
      expect(JSON.stringify(theirs.body)).not.toContain('photographer');
    });

    it('Restore an earlier revision', async () => {
      const a = await api();
      const { owner, people } = await sharedEvent(a);
      const editor = pick(people, 'Editor');
      const snapshots = new Map<number, Record<string, unknown>>();
      const snap = async (): Promise<void> => {
        const e = await a.call<EventBody>('GET', `events/${uuid(1)}`, { token: owner.token });
        snapshots.set(e.body.rev, e.body);
      };
      await snap();
      const steps: [string, Record<string, unknown>][] = [
        ['owner', { title: 'Wedding' }],
        ['editor', { emoji: '💍', targetTime: '16:30:00' }],
        ['owner', { theme: { ...THEME, cardStyle: 'solid' } }],
        ['editor', { title: 'Our big day', timeZone: 'Europe/Paris' }],
        ['owner', { notes: 'Owner-only, after rev 4' }],
        ['editor', { emoji: null, unitMode: 'weeks' }],
        ['owner', { targetDate: '2027-07-01' }],
        ['editor', { recurrence: { type: 'yearly', originalYear: 2027 } }],
      ];
      for (const [who, patch] of steps) {
        await patchAs(a, who === 'owner' ? owner.token : editor.token, patch);
        await snap();
      }
      expect(Math.max(...snapshots.keys())).toBe(9);

      const restored = await a.call<{ event: EventBody; overwritten: string[] }>('POST', `events/${uuid(1)}/restore`, { token: editor.token, body: { rev: 4 } });
      expect(restored.status).toBe(200);
      expect(restored.body.event.rev).toBe(10);

      const now = await a.call<EventBody>('GET', `events/${uuid(1)}`, { token: owner.token });
      expect(sharedOf(now.body)).toEqual(sharedOf(snapshots.get(4) ?? {}));
      expect(now.body['notes']).toBe('Owner-only, after rev 4');

      const page = await a.call<Page>('GET', `events/${uuid(1)}/revisions`, { token: owner.token });
      expect(page.body.revisions.map((r) => r.rev)).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2]);
      expect(page.body.revisions[0]).toMatchObject({ rev: 10, author: { name: 'Editor' }, restoredFrom: 4 });
      expect(page.body.revisions.slice(1).every((r) => r.restoredFrom === null)).toBe(true);
    });

    it('Event with 250 revisions', async () => {
      const a = await api();
      const { owner, people } = await sharedEvent(a);
      let rev = 1;
      while (rev < 250) {
        const r = await a.call<{ event: { rev: number } }>('PATCH', `events/${uuid(1)}`, { token: owner.token, body: { baseRev: rev, patch: { title: `Day ${rev + 1}` } } });
        rev = r.body.event.rev;
      }
      for (const reader of [owner, pick(people, 'Editor')]) {
        const seen: number[] = [];
        let before: number | null = null;
        do {
          const query: string = before === null ? '' : `?before=${before}`;
          const page: { body: Page } = await a.call<Page>('GET', `events/${uuid(1)}/revisions${query}`, { token: reader.token });
          seen.push(...page.body.revisions.map((r) => r.rev));
          before = page.body.next;
        } while (before !== null);
        expect(seen).toEqual(Array.from({ length: 200 }, (_, i) => 250 - i));
      }
      const pruned = await a.call<ErrorBody>('POST', `events/${uuid(1)}/restore`, { token: owner.token, body: { rev: 10 } });
      expect(pruned.status).toBe(400);
      expect(pruned.body.error.details).toEqual({ field: 'rev' });
      const oldest = await a.call<{ event: EventBody }>('POST', `events/${uuid(1)}/restore`, { token: owner.token, body: { rev: 51 } });
      expect(oldest.status).toBe(200);
      expect(oldest.body.event['title']).toBe('Day 51');
    });
  });
}

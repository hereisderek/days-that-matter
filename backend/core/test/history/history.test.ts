// History handlers beyond the spec scenarios: paging, what editors see, restore rules and errors.
import { describe, expect, it } from 'vitest';
import { testApi } from '../support/api.ts';
import { DOC, THEME, patchAs, pick, sharedEvent, uuid } from '../support/events.ts';
import type { ErrorBody } from '../support/events.ts';

type Revision = { rev: number; author: { name: string } | null; changes: { field: string; from: unknown; to: unknown }[]; overwrote: string[]; restoredFrom: number | null };
type Page = { revisions: Revision[]; next: number | null };
const revisions = `events/${uuid(1)}/revisions`;
const restore = `events/${uuid(1)}/restore`;

describe('history pages', () => {
  it('pages newest first with before, limit and next', async () => {
    const a = await testApi();
    const { owner } = await sharedEvent(a, {});
    for (let i = 2; i <= 7; i++) await patchAs(a, owner.token, { title: `T${i}` });
    const first = await a.call<Page>('GET', `${revisions}?limit=4`, { token: owner.token });
    expect(first.body.revisions.map((r) => r.rev)).toEqual([7, 6, 5, 4]);
    expect(first.body.next).toBe(4);
    const second = await a.call<Page>('GET', `${revisions}?limit=4&before=4`, { token: owner.token });
    expect(second.body.revisions.map((r) => r.rev)).toEqual([3, 2]);
    expect(second.body.next).toBeNull();
    const exact = await a.call<Page>('GET', `${revisions}?limit=6`, { token: owner.token });
    expect(exact.body.next).toBeNull();
    expect(first.headers.get('Cache-Control')).toBe('no-store');
  });

  it('rejects a limit outside 1 to 50 and a before that is not a whole number', async () => {
    const a = await testApi();
    const { owner } = await sharedEvent(a, {});
    for (const q of ['limit=0', 'limit=51', 'limit=x', 'before=0', 'before=-1', 'before=1.5']) {
      const r = await a.call<ErrorBody>('GET', `${revisions}?${q}`, { token: owner.token });
      expect(r.status, q).toBe(400);
      expect(r.body.error.code).toBe('invalid_payload');
    }
  });

  it('editors get full pages across owner-only revisions', async () => {
    const a = await testApi();
    const { owner, people } = await sharedEvent(a);
    for (let i = 0; i < 60; i++) await patchAs(a, owner.token, { notes: `note ${i}` });
    const shared: number[] = [];
    for (let i = 0; i < 3; i++) shared.push(await patchAs(a, owner.token, { title: `T${i}` }));
    for (let i = 60; i < 120; i++) await patchAs(a, owner.token, { notes: `note ${i}` });
    const first = await a.call<Page>('GET', `${revisions}?limit=2`, { token: pick(people, 'Editor').token });
    expect(first.body.revisions.map((r) => r.rev)).toEqual([shared[2], shared[1]]);
    expect(first.body.next).toBe(shared[1]);
    const second = await a.call<Page>('GET', `${revisions}?limit=2&before=${first.body.next}`, { token: pick(people, 'Editor').token });
    expect(second.body.revisions.map((r) => r.rev)).toEqual([shared[0]]);
    expect(second.body.next).toBeNull();
  });

  it('editors see only the shared changes of a mixed revision, overwritten fields included', async () => {
    const a = await testApi();
    const { owner, people } = await sharedEvent(a);
    const editor = pick(people, 'Editor');
    await patchAs(a, editor.token, { title: 'Editor title' });
    // The owner writes from rev 1, so the title replaces the editor's newer change.
    const r = await a.call<{ overwritten: string[] }>('PATCH', `events/${uuid(1)}`, { token: owner.token, body: { baseRev: 1, patch: { title: 'Owner title', notes: 'secret' } } });
    expect(r.body.overwritten).toEqual(['title']);
    const mine = await a.call<Page>('GET', revisions, { token: owner.token });
    expect(mine.body.revisions[0]?.changes.map((c) => c.field)).toEqual(['title', 'notes']);
    const theirs = await a.call<Page>('GET', revisions, { token: editor.token });
    expect(theirs.body.revisions[0]).toMatchObject({ changes: [{ field: 'title', from: 'Editor title', to: 'Owner title' }], overwrote: ['title'] });
    expect(JSON.stringify(theirs.body)).not.toContain('secret');
  });

  it('shows no author once the author deleted their account', async () => {
    const a = await testApi();
    const { owner, people } = await sharedEvent(a);
    await patchAs(a, pick(people, 'Editor').token, { title: 'By the editor' });
    expect((await a.call('DELETE', 'me', { token: pick(people, 'Editor').token })).status).toBe(204);
    const page = await a.call<Page>('GET', revisions, { token: owner.token });
    expect(page.body.revisions[0]).toMatchObject({ author: null, changes: [{ field: 'title' }] });
  });

  it('answers 401 without a session, 404 for unknown ids, 403 for others and 410 once deleted', async () => {
    const a = await testApi();
    const { owner } = await sharedEvent(a, {});
    const stranger = await a.google('stranger-sub');
    expect((await a.call('GET', revisions)).status).toBe(401);
    expect((await a.call('GET', `events/${uuid(9)}/revisions`, { token: owner.token })).status).toBe(404);
    expect((await a.call('GET', 'events/not-a-uuid/revisions', { token: owner.token })).status).toBe(404);
    expect((await a.call('GET', revisions, { token: stranger.token })).status).toBe(403);
    expect((await a.call('POST', restore, { token: stranger.token, body: { rev: 1 } })).status).toBe(403);
    await a.call('DELETE', `events/${uuid(1)}`, { token: owner.token });
    expect((await a.call<ErrorBody>('GET', revisions, { token: owner.token })).body.error.code).toBe('deleted');
    expect((await a.call<ErrorBody>('POST', restore, { token: owner.token, body: { rev: 1 } })).body.error.code).toBe('deleted');
  });
});

describe('restore', () => {
  it('brings back shared fields only, also for the owner, and publishes the new rev', async () => {
    const a = await testApi();
    const { owner } = await sharedEvent(a, {});
    await patchAs(a, owner.token, { title: 'Changed', notes: 'Changed notes', categoryId: 'family' });
    const r = await a.call<{ event: Record<string, unknown>; overwritten: string[] }>('POST', restore, { token: owner.token, body: { rev: 1 } });
    expect(r.status).toBe(200);
    expect(r.body.event).toMatchObject({ rev: 3, title: DOC.title, notes: 'Changed notes', categoryId: 'family' });
    expect(r.body.overwritten).toEqual([]);
    expect(a.ports.live.published.at(-1)).toEqual({ eventId: uuid(1), message: { type: 'rev', rev: 3 } });
  });

  it('writes no revision when the shared fields already match', async () => {
    const a = await testApi();
    const { owner } = await sharedEvent(a, {});
    await patchAs(a, owner.token, { notes: 'Only notes changed' });
    for (const rev of [1, 2]) {
      const r = await a.call<{ event: { rev: number } }>('POST', restore, { token: owner.token, body: { rev } });
      expect(r.status).toBe(200);
      expect(r.body.event.rev).toBe(2);
    }
    expect((await a.call<Page>('GET', revisions, { token: owner.token })).body.revisions.map((x) => x.rev)).toEqual([2]);
  });

  it('refuses a rev that is not in history and malformed bodies', async () => {
    const a = await testApi();
    const { owner } = await sharedEvent(a, {});
    await patchAs(a, owner.token, { title: 'Two' });
    for (const body of [{ rev: 3 }, { rev: 0 }, { rev: 1.5 }, { rev: '1' }, {}, { rev: 1, extra: true }]) {
      const r = await a.call<ErrorBody>('POST', restore, { token: owner.token, body });
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(r.body.error.code).toBe('invalid_payload');
    }
  });

  it('validates the restored values like any patch', async () => {
    const a = await testApi();
    const { owner } = await sharedEvent(a, {});
    // A value that the rules no longer accept, written straight to the store.
    await a.ports.store.applyPatch({ eventId: uuid(1), authorId: owner.accountId, baseRev: 1, patch: { theme: { ...THEME, paletteId: 'NOT VALID' } }, now: 1 });
    await patchAs(a, owner.token, { theme: THEME });
    const r = await a.call<ErrorBody>('POST', restore, { token: owner.token, body: { rev: 2 } });
    expect(r.status).toBe(400);
    expect(r.body.error.details).toEqual({ field: 'theme.paletteId' });
  });
});

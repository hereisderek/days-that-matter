// Sync routes beyond the spec scenarios: status codes, roles, validation and limits (task 3.6).
import { describe, expect, it } from 'vitest';
import { MemoryStore } from '../../src/fakes/memory-store.ts';
import { limitError } from '../../src/http/sync.ts';
import type { PutMemoInput, PutMemoOutcome } from '../../src/ports/store.ts';
import { testApi } from '../support/api.ts';
import type { Api } from '../support/api.ts';

const THEME = { paletteId: 'violet', cardStyle: 'glass', typography: 'modern' };
const DOC = { title: 'Our wedding', targetDate: '2027-06-12', theme: THEME };
const E1 = '0b8f3c1e-6d0a-4a51-9f61-000000000001';
const E2 = '0b8f3c1e-6d0a-4a51-9f61-000000000002';
const M1 = '5c1f0000-0000-4000-8000-000000000001';
const MEMO = { content: 'Booked the venue today.', milestoneTag: 'Day 100', createdAt: '2026-10-12T17:04:05+02:00' };

type ErrorBody = { error: { code: string; message: string; details: unknown } };
const err = (r: { status: number; body: unknown }) => [r.status, (r.body as ErrorBody).error.code];

async function people(a: Api) {
  const owner = await a.google('owner-sub', undefined, 'Owner');
  const editor = await a.google('editor-sub', undefined, 'Editor');
  const viewer = await a.google('viewer-sub', undefined, 'Viewer');
  const stranger = await a.google('stranger-sub');
  await a.call('PUT', `events/${E1}`, { token: owner.token, body: { ...DOC, notes: 'n', pinnedAt: '2026-10-01T08:00:00Z' } });
  await a.ports.store.putMember({ eventId: E1, accountId: editor.accountId, role: 'editor', inviteId: null, now: 0 });
  await a.ports.store.putMember({ eventId: E1, accountId: viewer.accountId, role: 'viewer', inviteId: null, now: 1 });
  return { owner, editor, viewer, stranger };
}

describe('create', () => {
  it('stores the normalized document without nulls and answers with the owner view', async () => {
    const a = await testApi();
    const { token } = await a.google('s');
    const r = await a.call('PUT', `events/${E1}`, { token, body: { ...DOC, title: '  Our wedding ', emoji: null, archivedAt: '2026-10-12T17:04:05+02:00' } });
    expect([r.status, r.body]).toEqual([201, { id: E1, rev: 1, role: 'owner', ...DOC, archivedAt: '2026-10-12T15:04:05Z', updatedAt: '2026-10-12T15:04:05Z' }]);
    expect((await a.ports.store.getEvent(E1))?.doc).toEqual({ ...DOC, archivedAt: '2026-10-12T15:04:05Z' });
  });

  it('repeating a create returns the current document; other ids and owners are refused', async () => {
    const a = await testApi();
    const owner = await a.google('s');
    const other = await a.google('t');
    await a.call('PUT', `events/${E1}`, { token: owner.token, body: DOC });
    await a.call('PATCH', `events/${E1}`, { token: owner.token, body: { baseRev: 1, patch: { title: 'Changed' } } });
    const again = await a.call<{ rev: number; title: string }>('PUT', `events/${E1}`, { token: owner.token, body: DOC });
    expect([again.status, again.body.rev, again.body.title]).toEqual([200, 2, 'Changed']);
    expect(err(await a.call('PUT', `events/${E1}`, { token: other.token, body: DOC }))).toEqual([409, 'conflict']);
    expect(err(await a.call('PUT', `events/${E1.toUpperCase()}`, { token: owner.token, body: DOC }))).toEqual([400, 'invalid_payload']);
    expect(err(await a.call('PUT', 'events/not-a-uuid', { token: owner.token, body: DOC }))).toEqual([400, 'invalid_payload']);
    await a.call('DELETE', `events/${E1}`, { token: owner.token });
    expect(err(await a.call('PUT', `events/${E1}`, { token: owner.token, body: DOC }))).toEqual([410, 'deleted']);
  });

  it('refuses a document over 16 KB and bodies that are not JSON objects', async () => {
    const a = await testApi();
    const { token } = await a.google('s');
    const big = await a.call('PUT', `events/${E1}`, { token, body: { ...DOC, title: '😀'.repeat(100), notes: '😀'.repeat(4000) } });
    expect([big.status, big.body]).toEqual([400, { error: { code: 'invalid_payload', message: '(body): event document exceeds 16384 bytes', details: { field: '' } } }]);
    expect(err(await a.call('PUT', `events/${E1}`, { token, body: '[1]' }))).toEqual([400, 'invalid_payload']);
    expect(err(await a.call('PUT', `events/${E1}`, { token, body: DOC, headers: { 'Content-Type': 'text/plain' } }))).toEqual([415, 'unsupported_media_type']);
  });
});

describe('read', () => {
  it('projects by role and never shows owner-only fields to members', async () => {
    const a = await testApi();
    const { owner, viewer, stranger } = await people(a);
    const own = await a.call<Record<string, unknown>>('GET', `events/${E1}`, { token: owner.token });
    expect(own.body).toMatchObject({ role: 'owner', notes: 'n', pinnedAt: '2026-10-01T08:00:00Z' });
    expect(own.body).not.toHaveProperty('members');
    const view = await a.call<Record<string, unknown>>('GET', `events/${E1}`, { token: viewer.token });
    expect(view.body).toEqual({
      id: E1, rev: 1, role: 'viewer', ...DOC, updatedAt: '2026-10-12T15:04:05Z', archived: false,
      members: [{ name: 'Owner', role: 'owner' }, { name: 'Editor', role: 'editor' }, { name: 'Viewer', role: 'viewer' }],
    });
    expect(err(await a.call('GET', `events/${E1}`, { token: stranger.token }))).toEqual([403, 'forbidden']);
    expect(err(await a.call('GET', `events/${E2}`, { token: owner.token }))).toEqual([404, 'not_found']);
    expect(err(await a.call('GET', 'events/not-a-uuid', { token: owner.token }))).toEqual([404, 'not_found']);
  });

  it('shows members their own reminders and archive', async () => {
    const store = new MemoryStore();
    const a = await testApi({ store });
    const { viewer } = await people(a);
    const original = store.readEvents.bind(store);
    store.readEvents = async (accountId, ids) =>
      (await original(accountId, ids)).map((r) =>
        r.membership ? { ...r, membership: { ...r.membership, archivedAt: 5, reminders: { daysBefore: [1], time: '09:00' } } } : r,
      );
    const view = await a.call<Record<string, unknown>>('GET', `events/${E1}`, { token: viewer.token });
    expect([view.body['archived'], view.body['reminders']]).toEqual([true, { daysBefore: [1], time: '09:00' }]);
  });

  it('fetch returns readable, live events by id and checks the body', async () => {
    const a = await testApi();
    const { owner, editor, stranger } = await people(a);
    await a.call('PUT', `events/${E2}`, { token: owner.token, body: DOC });
    await a.call('DELETE', `events/${E2}`, { token: owner.token });
    const r = await a.call<{ events: { id: string; role: string }[] }>('POST', 'events/fetch', { token: editor.token, body: { ids: [E1, E2, 'x', E1] } });
    expect(r.body.events.map((e) => [e.id, e.role])).toEqual([[E1, 'editor']]);
    expect((await a.call<{ events: unknown[] }>('POST', 'events/fetch', { token: owner.token, body: { ids: [E1, E2] } })).body.events).toHaveLength(1);
    expect((await a.call<{ events: unknown[] }>('POST', 'events/fetch', { token: stranger.token, body: { ids: [E1] } })).body.events).toEqual([]);
    for (const body of [{}, { ids: 'x' }, { ids: [1] }, { ids: Array.from({ length: 101 }, () => E1) }, { ids: [], more: 1 }]) {
      expect(err(await a.call('POST', 'events/fetch', { token: owner.token, body })), JSON.stringify(body).slice(0, 40)).toEqual([400, 'invalid_payload']);
    }
    expect((await a.call<{ events: unknown[] }>('POST', 'events/fetch', { token: owner.token, body: { ids: [] } })).body.events).toEqual([]);
  });
});

describe('patch', () => {
  it('checks roles: viewers write nothing, editors only shared fields', async () => {
    const a = await testApi();
    const { owner, editor, viewer, stranger } = await people(a);
    expect(err(await a.call('PATCH', `events/${E1}`, { token: viewer.token, body: { baseRev: 1, patch: { title: 'x' } } }))).toEqual([403, 'forbidden']);
    expect(err(await a.call('PATCH', `events/${E1}`, { token: stranger.token, body: { baseRev: 1, patch: { title: 'x' } } }))).toEqual([403, 'forbidden']);
    for (const field of ['notes', 'pinnedAt', 'categoryId', 'archivedAt', 'reminders']) {
      expect(err(await a.call('PATCH', `events/${E1}`, { token: editor.token, body: { baseRev: 1, patch: { [field]: null } } })), field).toEqual([403, 'field_not_allowed']);
    }
    const ok = await a.call<{ event: Record<string, unknown> }>('PATCH', `events/${E1}`, { token: editor.token, body: { baseRev: 1, patch: { emoji: '💍' } } });
    expect(ok.body.event).toMatchObject({ role: 'editor', emoji: '💍', rev: 2 });
    expect(ok.body.event).not.toHaveProperty('notes');
    const archived = await a.call<{ event: Record<string, unknown> }>('PATCH', `events/${E1}`, { token: owner.token, body: { baseRev: 2, patch: { archivedAt: '2026-10-12T15:04:05Z' } } });
    expect(archived.body.event).not.toHaveProperty('pinnedAt');
  });

  it('a patch that changes nothing keeps the rev and sends no notice', async () => {
    const a = await testApi();
    const { owner } = await people(a);
    const r = await a.call<{ event: { rev: number }; overwritten: string[] }>('PATCH', `events/${E1}`, { token: owner.token, body: { baseRev: 1, patch: { title: 'Our wedding' } } });
    expect([r.body.event.rev, r.body.overwritten]).toEqual([1, []]);
    expect(a.ports.live.published).toEqual([]);
  });

  it('checks the body and the merged size', async () => {
    const a = await testApi();
    const { owner } = await people(a);
    for (const body of [{ patch: {} }, { baseRev: -1, patch: {} }, { baseRev: 1.5, patch: {} }, { baseRev: '1', patch: {} }, { baseRev: 1 }, { baseRev: 1, patch: [] }, { baseRev: 1, patch: {}, x: 1 }, { baseRev: 1, patch: { id: 'x' } }]) {
      expect(err(await a.call('PATCH', `events/${E1}`, { token: owner.token, body })), JSON.stringify(body)).toEqual([400, 'invalid_payload']);
    }
    await a.call('PATCH', `events/${E1}`, { token: owner.token, body: { baseRev: 1, patch: { notes: '😀'.repeat(4000) } } });
    const big = await a.call('PATCH', `events/${E1}`, { token: owner.token, body: { baseRev: 2, patch: { title: '😀'.repeat(100), emoji: '😀' } } });
    expect(big.body).toEqual({ error: { code: 'invalid_payload', message: '(body): event document exceeds 16384 bytes', details: { field: '' } } });
    expect((await a.ports.store.getEvent(E1))?.rev).toBe(2);
  });

  it('unknown and deleted events', async () => {
    const a = await testApi();
    const { owner } = await people(a);
    expect(err(await a.call('PATCH', `events/${E2}`, { token: owner.token, body: { baseRev: 1, patch: {} } }))).toEqual([404, 'not_found']);
    await a.call('DELETE', `events/${E1}`, { token: owner.token });
    expect(err(await a.call('PATCH', `events/${E1}`, { token: owner.token, body: { baseRev: 1, patch: { title: 'x' } } }))).toEqual([410, 'deleted']);
  });
});

describe('delete', () => {
  it('owner only; repeating is fine', async () => {
    const a = await testApi();
    const { owner, editor } = await people(a);
    expect(err(await a.call('DELETE', `events/${E1}`, { token: editor.token }))).toEqual([403, 'forbidden']);
    expect((await a.call('DELETE', `events/${E1}`, { token: owner.token })).status).toBe(204);
    expect((await a.call('DELETE', `events/${E1}`, { token: owner.token })).status).toBe(204);
    expect(a.ports.live.published.filter((p) => p.message.type === 'access')).toHaveLength(1);
    expect(err(await a.call('DELETE', `events/${E2}`, { token: owner.token }))).toEqual([404, 'not_found']);
  });
});

describe('memos', () => {
  it('create, repeat, patch and delete with notices to the owner', async () => {
    const a = await testApi();
    const { owner } = await people(a);
    const created = await a.call('PUT', `events/${E1}/memos/${M1}`, { token: owner.token, body: MEMO });
    expect([created.status, created.body]).toEqual([201, {
      id: M1, eventId: E1, seq: 1, content: MEMO.content, milestoneTag: 'Day 100', createdAt: '2026-10-12T15:04:05Z', updatedAt: '2026-10-12T15:04:05Z',
    }]);
    expect((await a.call('PUT', `events/${E1}/memos/${M1}`, { token: owner.token, body: { ...MEMO, content: 'other' } })).status).toBe(200);
    const patched = await a.call<{ seq: number; milestoneTag?: string; content: string }>('PATCH', `events/${E1}/memos/${M1}`, { token: owner.token, body: { patch: { content: 'Edited', milestoneTag: null } } });
    expect([patched.status, patched.body.seq, patched.body.content, 'milestoneTag' in patched.body]).toEqual([200, 2, 'Edited', false]);
    const same = await a.call<{ seq: number }>('PATCH', `events/${E1}/memos/${M1}`, { token: owner.token, body: { patch: { content: 'Edited' } } });
    expect(same.body.seq).toBe(2);
    expect((await a.call('DELETE', `events/${E1}/memos/${M1}`, { token: owner.token })).status).toBe(204);
    expect((await a.call('DELETE', `events/${E1}/memos/${M1}`, { token: owner.token })).status).toBe(204);
    expect(a.ports.live.published.map((p) => p.message)).toEqual([{ type: 'children', seq: 1 }, { type: 'children', seq: 2 }, { type: 'children', seq: 3 }]);
    expect(err(await a.call('PUT', `events/${E1}/memos/${M1}`, { token: owner.token, body: MEMO }))).toEqual([410, 'deleted']);
    expect(err(await a.call('PATCH', `events/${E1}/memos/${M1}`, { token: owner.token, body: { patch: { content: 'x' } } }))).toEqual([404, 'not_found']);
  });

  it('owner only, valid bodies, known ids', async () => {
    const a = await testApi();
    const { owner, editor } = await people(a);
    await a.call('PUT', `events/${E2}`, { token: owner.token, body: DOC });
    expect(err(await a.call('PUT', `events/${E1}/memos/${M1}`, { token: editor.token, body: MEMO }))).toEqual([403, 'forbidden']);
    expect(err(await a.call('PUT', `events/${E1}/memos/${M1}`, { token: owner.token, body: { content: '' , createdAt: MEMO.createdAt } }))).toEqual([400, 'invalid_payload']);
    expect(err(await a.call('PUT', `events/${E1}/memos/not-a-uuid`, { token: owner.token, body: MEMO }))).toEqual([404, 'not_found']);
    await a.call('PUT', `events/${E1}/memos/${M1}`, { token: owner.token, body: MEMO });
    expect(err(await a.call('PUT', `events/${E2}/memos/${M1}`, { token: owner.token, body: MEMO }))).toEqual([409, 'conflict']);
    expect(err(await a.call('DELETE', `events/${E2}/memos/${M1}`, { token: owner.token }))).toEqual([404, 'not_found']);
    for (const body of [{}, { patch: [] }, { patch: { content: null } }, { patch: {}, x: 1 }]) {
      expect(err(await a.call('PATCH', `events/${E1}/memos/${M1}`, { token: owner.token, body })), JSON.stringify(body)).toEqual([400, 'invalid_payload']);
    }
  });

  it('an event full of memos answers 429 quota_exceeded', async () => {
    class FullStore extends MemoryStore {
      override async putMemo(_input: PutMemoInput): Promise<PutMemoOutcome> {
        return { status: 'limit' };
      }
    }
    const a = await testApi({ store: new FullStore() });
    const { owner } = await people(a);
    const r = await a.call<ErrorBody>('PUT', `events/${E1}/memos/${M1}`, { token: owner.token, body: MEMO });
    expect([r.status, r.body.error.details]).toEqual([429, { limit: 'memos_per_event' }]);
  });

  it('children checks after and the event', async () => {
    const a = await testApi();
    const { owner } = await people(a);
    for (const after of ['-1', 'x', '1.5', '9'.repeat(16)]) {
      expect(err(await a.call('GET', `events/${E1}/children?after=${after}`, { token: owner.token })), after).toEqual([400, 'invalid_payload']);
    }
    expect((await a.call('GET', `events/${E1}/children`, { token: owner.token })).body).toEqual({ memos: [], seq: 0, reset: false });
    await a.call('DELETE', `events/${E1}`, { token: owner.token });
    expect(err(await a.call('GET', `events/${E1}/children?after=0`, { token: owner.token }))).toEqual([410, 'deleted']);
  });
});

describe('limits', () => {
  it('402 when a higher plan allows more, 429 when none does', () => {
    expect(limitError('events', 'free').body().error).toEqual({ code: 'premium_required', message: 'Your plan does not include this', details: { feature: 'events' } });
    expect(limitError('events', 'premium').body().error).toEqual({ code: 'quota_exceeded', message: 'Limit reached', details: { feature: 'events' } });
    expect(limitError('custom_audio', 'free').status).toBe(402);
    expect(limitError('custom_audio', 'premium_plus').status).toBe(429);
  });
});

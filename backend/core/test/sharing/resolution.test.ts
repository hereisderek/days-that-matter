// Task 3.9: link resolution. Unknown, malformed and purged tokens give byte-identical responses apart
// from the request id; token formats are checked before any store access; the public link view, the
// invite state and the member view answer `304` to a matching `If-None-Match`.
import { describe, expect, it } from 'vitest';
import { openSqliteStore } from '../../src/node/node-sqlite-driver.ts';
import type { Store } from '../../src/ports/store.ts';
import type { CoreRequest, CoreResponse } from '../../src/http/types.ts';
import { MemoryStore } from '../../src/fakes/memory-store.ts';
import { request, text } from '../helpers.ts';
import { testApi } from '../support/api.ts';
import type { Api } from '../support/api.ts';
import { DAY_MS, pick, sharedEvent, uuid } from '../support/events.ts';
import type { Person } from '../support/events.ts';

const tokenOf = (url: string): string => url.slice(url.lastIndexOf('/') + 1);

/** Status, headers without the request id, and the exact body bytes. */
async function bytes(res: CoreResponse): Promise<{ status: number; headers: [string, string][]; body: string }> {
  if (res.kind !== 'http') throw new Error('expected an HTTP response');
  return { status: res.status, headers: [...res.headers.entries()].filter(([k]) => k !== 'x-request-id'), body: await text(res) };
}

function get(path: string, token?: string, headers: Record<string, string> = {}): CoreRequest {
  return request('GET', path, { headers: { ...headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
}

/** Well-formed tokens nobody issued, and malformed ones of every kind. */
const UNKNOWN = ['AAAAAAAAAAAAAAAAAAAAAA', 'zzzzzzzzzzzzzzzzzzzzz_', '0123456789-_abcdefghij'];
const MALFORMED = ['short', 'AAAAAAAAAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAA*', 'AAAAAAAAAAAAAAAAAAAA%2F', '%E2%82%AC'.repeat(3), 'AAAAAAAAAAAAAAAAAAAA%20A'];

async function sqlApi() {
  const { driver, store } = await openSqliteStore();
  return { a: await testApi({ store }), driver };
}

describe('identical not-found responses (byte comparison)', () => {
  it('public links: unknown, malformed and purged tokens', async () => {
    const { a, driver } = await sqlApi();
    const { owner } = await sharedEvent(a, {});
    const purged = tokenOf((await a.call<{ url: string }>('POST', `events/${uuid(1)}/links`, { token: owner.token, body: {} })).body.url);
    expect((await a.call('GET', `links/${purged}`)).status).toBe(200);
    // The daily job's purge removes the row (task 3.13); here it is done by hand.
    await driver.batch([{ sql: 'DELETE FROM links WHERE token = ?', args: [purged] }]);

    const reference = await bytes(await a.app.handle(get(`/api/v1/links/${UNKNOWN[0]}`)));
    expect(reference.status).toBe(404);
    expect(reference.body).toBe('{"error":{"code":"not_found","message":"Not found","details":null}}');
    for (const t of [...UNKNOWN, ...MALFORMED, purged]) {
      expect(await bytes(await a.app.handle(get(`/api/v1/links/${t}`))), t).toEqual(reference);
    }
  });

  it('invites: unknown, malformed and purged tokens, for the state and for joining', async () => {
    const { a, driver } = await sqlApi();
    const { owner } = await sharedEvent(a, {});
    const purged = tokenOf((await a.call<{ url: string }>('POST', `events/${uuid(1)}/invites`, { token: owner.token, body: { role: 'viewer' } })).body.url);
    await driver.batch([{ sql: 'DELETE FROM invites WHERE event_id = ?', args: [uuid(1)] }]);
    const guest = await a.google('guest-sub');

    const state = await bytes(await a.app.handle(get(`/api/v1/invites/${UNKNOWN[0]}`, guest.token)));
    const join = await bytes(await a.app.handle(request('POST', `/api/v1/invites/${UNKNOWN[0]}/join`, { headers: { Authorization: `Bearer ${guest.token}` } })));
    expect([state.status, join.status]).toEqual([404, 404]);
    expect(join).toEqual(state);
    for (const t of [...UNKNOWN, ...MALFORMED, purged]) {
      expect(await bytes(await a.app.handle(get(`/api/v1/invites/${t}`, guest.token))), t).toEqual(state);
      expect(await bytes(await a.app.handle(request('POST', `/api/v1/invites/${t}/join`, { headers: { Authorization: `Bearer ${guest.token}` } }))), t).toEqual(state);
    }
  });

  it('member links: unknown, malformed and purged event ids', async () => {
    const { a, driver } = await sqlApi();
    const owner = await a.google('owner-sub');
    await a.call('PUT', `events/${uuid(2)}`, { token: owner.token, body: { title: 'Gone', targetDate: '2027-01-01', theme: { paletteId: 'violet', cardStyle: 'glass', typography: 'modern' } } });
    await driver.batch([{ sql: 'DELETE FROM events WHERE id = ?', args: [uuid(2)] }]);
    const reference = await bytes(await a.app.handle(get(`/api/v1/events/${uuid(9)}`, owner.token)));
    expect(reference.status).toBe(404);
    for (const id of [uuid(8), 'not-a-uuid', uuid(9).toUpperCase(), uuid(2)]) {
      expect(await bytes(await a.app.handle(get(`/api/v1/events/${id}`, owner.token))), id).toEqual(reference);
    }
  });

  it('revoked and expired links answer 410 with the same bytes for every token in that state', async () => {
    const a = await testApi();
    const { owner } = await sharedEvent(a, {});
    const make = async (body: Record<string, unknown>) =>
      (await a.call<{ id: string; url: string }>('POST', `events/${uuid(1)}/links`, { token: owner.token, body })).body;
    const revoked = [await make({}), await make({ label: 'Other' })];
    for (const l of revoked) await a.call('DELETE', `links/${l.id}`, { token: owner.token });
    const soon = new Date(a.ports.clock.nowMs() + DAY_MS).toISOString();
    const expired = [await make({ expiresAt: soon }), await make({ label: 'Later', expiresAt: soon })];
    a.ports.clock.advance(DAY_MS);
    for (const [group, code] of [[revoked, 'revoked'], [expired, 'expired']] as const) {
      const [first, second] = await Promise.all(group.map(async (l) => bytes(await a.app.handle(get(`/api/v1/links/${tokenOf(l.url)}`)))));
      expect(first?.status).toBe(410);
      expect(JSON.parse(first?.body ?? '{}').error.code).toBe(code);
      expect(second).toEqual(first);
    }
  });
});

describe('token formats are checked before any store access', () => {
  /** A store that counts every call. */
  function counting(): { store: Store; calls: () => number } {
    let n = 0;
    const inner = new MemoryStore();
    const store = new Proxy(inner, {
      get(target, prop, receiver) {
        const value: unknown = Reflect.get(target, prop, receiver);
        if (typeof value !== 'function') return value;
        return (...args: unknown[]) => {
          n++;
          return (value as (...a: unknown[]) => unknown).apply(target, args);
        };
      },
    }) as Store;
    return { store, calls: () => n };
  }

  it('reads nothing for a malformed public link or invite token', async () => {
    const { store, calls } = counting();
    const a = await testApi({ store });
    const guest = await a.google('guest-sub');
    for (const t of MALFORMED) {
      const before = calls();
      expect((await a.app.handle(get(`/api/v1/links/${t}`))).kind).toBe('http');
      await a.app.handle(get(`/api/v1/invites/${t}`, guest.token));
      await a.app.handle(request('POST', `/api/v1/invites/${t}/join`, { headers: { Authorization: `Bearer ${guest.token}` } }));
      expect(calls(), t).toBe(before);
    }
    const before = calls();
    await a.app.handle(get(`/api/v1/links/${UNKNOWN[0]}`));
    expect(calls()).toBeGreaterThan(before);
  });
});

describe('ETag and 304', () => {
  async function linkSetup(): Promise<{ a: Api; owner: Person; path: string }> {
    const a = await testApi();
    const { owner } = await sharedEvent(a, {});
    const url = (await a.call<{ url: string }>('POST', `events/${uuid(1)}/links`, { token: owner.token, body: {} })).body.url;
    return { a, owner, path: `/api/v1/links/${tokenOf(url)}` };
  }

  it('public link view: 304 while the event is unchanged, also as server time moves on', async () => {
    const { a, owner, path } = await linkSetup();
    const first = await a.app.handle(get(path));
    if (first.kind !== 'http') throw new Error('http');
    const etag = first.headers.get('ETag') as string;
    expect(etag).toMatch(/^"[0-9a-f]{32}"$/);
    expect(first.headers.get('Cache-Control')).toBe('no-cache');
    a.ports.clock.advance(60_000);
    const again = await a.app.handle(get(path, undefined, { 'If-None-Match': etag }));
    expect(await bytes(again)).toEqual({ status: 304, headers: expect.arrayContaining([['etag', etag]]), body: '' });
    expect((await a.app.handle(get(path, undefined, { 'If-None-Match': `"other", ${etag}` }))).kind === 'http').toBe(true);
    await a.call('PATCH', `events/${uuid(1)}`, { token: owner.token, body: { baseRev: 1, patch: { title: 'New title' } } });
    const changed = await a.app.handle(get(path, undefined, { 'If-None-Match': etag }));
    if (changed.kind !== 'http') throw new Error('http');
    expect(changed.status).toBe(200);
    expect(changed.headers.get('ETag')).not.toBe(etag);
    expect(JSON.parse(await text(changed)).event.title).toBe('New title');
  });

  it('a revoked link answers 410 even to a matching If-None-Match', async () => {
    const { a, owner, path } = await linkSetup();
    const first = await a.app.handle(get(path));
    const etag = first.kind === 'http' ? (first.headers.get('ETag') as string) : '';
    const [l] = (await a.call<{ links: { id: string }[] }>('GET', `events/${uuid(1)}/sharing`, { token: owner.token })).body.links;
    await a.call('DELETE', `links/${l?.id}`, { token: owner.token });
    expect((await bytes(await a.app.handle(get(path, undefined, { 'If-None-Match': etag })))).status).toBe(410);
  });

  it('invite state: 304 until the state changes', async () => {
    const a = await testApi();
    const { owner } = await sharedEvent(a, {});
    const url = (await a.call<{ url: string }>('POST', `events/${uuid(1)}/invites`, { token: owner.token, body: { role: 'viewer' } })).body.url;
    const path = `/api/v1/invites/${tokenOf(url)}`;
    const guest = await a.google('guest-sub');
    const first = await a.app.handle(get(path, guest.token));
    const etag = first.kind === 'http' ? (first.headers.get('ETag') as string) : '';
    expect(first.kind === 'http' && first.headers.get('Cache-Control')).toBe('private, no-cache');
    expect((await bytes(await a.app.handle(get(path, guest.token, { 'If-None-Match': etag })))).status).toBe(304);
    await a.call('POST', `invites/${tokenOf(url)}/join`, { token: guest.token });
    const member = await bytes(await a.app.handle(get(path, guest.token, { 'If-None-Match': etag })));
    expect(member.status).toBe(200);
    expect(JSON.parse(member.body).state).toBe('member');
  });

  it('member view: 304 while unchanged, 403 once removed', async () => {
    const a = await testApi();
    const { owner, people } = await sharedEvent(a, { Viewer: 'viewer' });
    const viewer = pick(people, 'Viewer');
    const path = `/api/v1/events/${uuid(1)}`;
    const first = await a.app.handle(get(path, viewer.token));
    const etag = first.kind === 'http' ? (first.headers.get('ETag') as string) : '';
    expect((await bytes(await a.app.handle(get(path, viewer.token, { 'If-None-Match': etag })))).status).toBe(304);
    await a.call('DELETE', `events/${uuid(1)}/members/${viewer.accountId}`, { token: owner.token });
    expect((await bytes(await a.app.handle(get(path, viewer.token, { 'If-None-Match': etag })))).status).toBe(403);
  });
});

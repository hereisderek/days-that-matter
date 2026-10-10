import { env } from 'cloudflare:workers';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { INSTALL, auth, body, call, create, countingDb, freshIp, reqIdStripped, sha, validPayload } from './helpers';

const err = async (res: Response) => (await res.json<{ error: { code: string; details: unknown } }>()).error;
afterEach(() => vi.useRealTimers());

describe('POST /shares', () => {
  it('returns 201 with contract fields and headers', async () => {
    const res = await call('POST', '/api/v1/shares', { body: body({ expiresInDays: 365 }), headers: { 'X-Install-Id': INSTALL } });
    expect(res.status).toBe(201);
    const j = await res.json<Record<string, unknown>>();
    expect(j.shareToken).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(j.manageToken).toMatch(/^mt_[A-Za-z0-9_-]{43}$/);
    expect(j.url).toBe(`https://daysthatmatter.app/e/${j.shareToken}`);
    expect(j.schemaVersion).toBe(1);
    expect(j.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    const days = (Date.parse(j.expiresAt as string) - Date.parse(j.createdAt as string)) / 86400000;
    expect(days).toBe(365);
    expect(res.headers.get('Location')).toBe(`/api/v1/shares/${j.shareToken}`);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('X-Request-Id')).toMatch(/^[0-9a-f-]{36}$/);
  });
  it('expiresAt is null without expiry', async () => {
    expect((await create()).expiresAt).toBeNull();
  });
  it('stores only hashes, never raw tokens', async () => {
    const c = await create();
    const row = await env.DB.prepare('SELECT * FROM shares WHERE token_hash = ?').bind(await sha(c.shareToken)).first<Record<string, unknown>>();
    expect(row).toBeTruthy();
    expect(row!.manage_hash).toBe(await sha(c.manageToken));
    expect(JSON.stringify(row)).not.toContain(c.shareToken);
    expect(JSON.stringify(row)).not.toContain(c.manageToken);
    expect(row!.payload_bytes).toBe(new TextEncoder().encode(row!.payload as string).length);
  });
  it('400 invalid_install_id for missing and malformed ids', async () => {
    for (const h of <Record<string, string>[]>[{}, { 'X-Install-Id': 'nope' }, { 'X-Install-Id': '4b1d1f0e-6f0a-1c7e-9a52-0c1f1d2e3a4b' }]) {
      const res = await call('POST', '/api/v1/shares', { body: body(), headers: h });
      expect(res.status).toBe(400);
      expect((await err(res)).code).toBe('invalid_install_id');
    }
  });
  it('415 for non-JSON content types', async () => {
    for (const ct of ['text/plain', 'application/x-www-form-urlencoded', '']) {
      const res = await call('POST', '/api/v1/shares', { raw: JSON.stringify(body()), headers: { 'X-Install-Id': INSTALL, ...(ct ? { 'Content-Type': ct } : {}) } });
      expect(res.status).toBe(415);
      expect((await err(res)).code).toBe('unsupported_media_type');
    }
  });
  it('accepts application/json with charset', async () => {
    const res = await call('POST', '/api/v1/shares', { raw: JSON.stringify(body()), headers: { 'X-Install-Id': INSTALL, 'Content-Type': 'application/json; charset=utf-8' } });
    expect(res.status).toBe(201);
  });
  it('413 when Content-Length exceeds 16384', async () => {
    const res = await call('POST', '/api/v1/shares', { raw: 'x'.repeat(16385), headers: { 'Content-Type': 'application/json', 'X-Install-Id': INSTALL } });
    expect(res.status).toBe(413);
    expect((await err(res)).code).toBe('payload_too_large');
  });
  it('413 on a streamed body over the limit without Content-Length', async () => {
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode('{"a":"' + 'x'.repeat(10000)));
        c.enqueue(new TextEncoder().encode('x'.repeat(10000) + '"}'));
        c.close();
      },
    });
    const res = await call('POST', '/api/v1/shares', { raw: stream, headers: { 'Content-Type': 'application/json', 'X-Install-Id': INSTALL } });
    expect(res.status).toBe(413);
  });
  it('accepts a body of exactly 16384 bytes (then fails validation, not size)', async () => {
    const pad = 16384 - JSON.stringify({ x: '' }).length;
    const res = await call('POST', '/api/v1/shares', { raw: JSON.stringify({ x: 'a'.repeat(pad) }), headers: { 'Content-Type': 'application/json', 'X-Install-Id': INSTALL } });
    expect(res.status).toBe(400);
  });
  it('422 unsupported_schema_version with supported list', async () => {
    const res = await call('POST', '/api/v1/shares', { body: body({ schemaVersion: 2 }), headers: { 'X-Install-Id': INSTALL } });
    expect(res.status).toBe(422);
    const e = await err(res);
    expect(e.code).toBe('unsupported_schema_version');
    expect(e.details).toEqual({ supported: [1] });
  });
  it('400 when payload.v differs from schemaVersion', async () => {
    const res = await call('POST', '/api/v1/shares', { body: body({ payload: validPayload({ v: 2 }) }), headers: { 'X-Install-Id': INSTALL } });
    expect(res.status).toBe(400);
  });
  it('error envelope shape', async () => {
    const res = await call('POST', '/api/v1/shares', { body: {}, headers: { 'X-Install-Id': INSTALL } });
    const j = await res.json<{ error: Record<string, unknown> }>();
    expect(Object.keys(j)).toEqual(['error']);
    expect(Object.keys(j.error).sort()).toEqual(['code', 'details', 'message']);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});

describe('GET /shares/{token}', () => {
  it('returns the payload with ETag and cache headers', async () => {
    const c = await create();
    const res = await call('GET', `/api/v1/shares/${c.shareToken}`);
    expect(res.status).toBe(200);
    const j = await res.json<Record<string, any>>();
    expect(j.shareToken).toBe(c.shareToken);
    expect(j.schemaVersion).toBe(1);
    expect(j.accessMode).toBe('view');
    expect(j.payload.title).toBe('Our wedding');
    expect(j.expiresAt).toBeNull();
    expect(j.serverTime).toMatch(/Z$/);
    expect(res.headers.get('ETag')).toBe('"r1"');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=30, stale-while-revalidate=60');
    expect(JSON.stringify(j)).not.toContain('install');
    expect(JSON.stringify(j)).not.toContain('manage');
  });
  it('304 on If-None-Match, 200 after the etag changes', async () => {
    const c = await create();
    const url = `/api/v1/shares/${c.shareToken}`;
    const res = await call('GET', url, { headers: { 'If-None-Match': '"r1"' } });
    expect(res.status).toBe(304);
    expect(await res.text()).toBe('');
    expect(res.headers.get('ETag')).toBe('"r1"');
    expect((await call('GET', url, { headers: { 'If-None-Match': 'W/"r1"' } })).status).toBe(304);
    expect((await call('GET', url, { headers: { 'If-None-Match': '"r0", "r1"' } })).status).toBe(304);
    await call('PUT', url, { headers: auth(c), body: body() });
    expect((await call('GET', url, { headers: { 'If-None-Match': '"r1"' } })).status).toBe(200);
  });
  it('404 for unknown, malformed and purged tokens is byte-identical', async () => {
    const c = await create();
    await env.DB.prepare('DELETE FROM shares WHERE token_hash = ?').bind(await sha(c.shareToken)).run();
    const tokens = ['A'.repeat(22), 'short', 'a'.repeat(23), 'a'.repeat(21) + '!', c.shareToken];
    const out: Array<[number, string, string]> = [];
    for (const t of tokens) {
      const res = await call('GET', `/api/v1/shares/${encodeURIComponent(t)}`);
      out.push([res.status, reqIdStripped(res), await res.text()]);
    }
    expect(out[0][0]).toBe(404);
    for (const o of out) expect(o).toEqual(out[0]);
    expect(JSON.parse(out[0][2]).error.code).toBe('not_found');
    expect(out[0][1]).toContain('no-store');
  });
  it('wrong manage token gives the same 404 as an unknown share on PUT and DELETE', async () => {
    const c = await create();
    const other = await create();
    const unknownTok = 'B'.repeat(22);
    const wrong = [
      await call('PUT', `/api/v1/shares/${c.shareToken}`, { headers: auth(other), body: body() }),
      await call('PUT', `/api/v1/shares/${unknownTok}`, { headers: auth(c), body: body() }),
      await call('PUT', `/api/v1/shares/short`, { headers: auth(c), body: body() }),
      await call('DELETE', `/api/v1/shares/${c.shareToken}`, { headers: auth(other) }),
      await call('DELETE', `/api/v1/shares/${unknownTok}`, { headers: auth(c) }),
    ];
    const sigs = await Promise.all(wrong.map(async (r) => [r.status, reqIdStripped(r), await r.text()]));
    expect(sigs[0][0]).toBe(404);
    for (const s of sigs) expect(s).toEqual(sigs[0]);
    // And the share is still intact.
    expect((await call('GET', `/api/v1/shares/${c.shareToken}`)).status).toBe(200);
  });
  it('malformed token does not reach D1 on any route', async () => {
    const { db, count } = countingDb();
    await call('GET', '/api/v1/shares/nope', { db });
    await call('PUT', '/api/v1/shares/nope', { db, headers: { Authorization: 'Bearer mt_' + 'a'.repeat(43) }, body: body() });
    await call('DELETE', '/api/v1/shares/nope', { db, headers: { Authorization: 'Bearer mt_' + 'a'.repeat(43) } });
    expect(count()).toBe(0);
  });
});

describe('PUT /shares/{token}', () => {
  it('updates the payload, bumps rev, and returns contract fields', async () => {
    const c = await create();
    const url = `/api/v1/shares/${c.shareToken}`;
    const res = await call('PUT', url, { headers: auth(c), body: body({ payload: validPayload({ title: 'New title' }) }) });
    expect(res.status).toBe(200);
    const j = await res.json<{ rev: number; updatedAt: string; expiresAt: null }>();
    expect(j.rev).toBe(2);
    expect(j.expiresAt).toBeNull();
    expect(j.updatedAt).toMatch(/Z$/);
    const got = await call('GET', url);
    expect(got.headers.get('ETag')).toBe('"r2"');
    expect((await got.json<any>()).payload.title).toBe('New title');
    const again = await call('PUT', url, { headers: auth(c), body: body() });
    expect((await again.json<{ rev: number }>()).rev).toBe(3);
  });
  it('401 for missing, non-bearer and malformed Authorization', async () => {
    const c = await create();
    const url = `/api/v1/shares/${c.shareToken}`;
    for (const h of <Record<string, string>[]>[{}, { Authorization: 'Basic abc' }, { Authorization: 'Bearer abc' }, { Authorization: 'Bearer mt_short' }, { Authorization: c.manageToken }]) {
      const res = await call('PUT', url, { headers: h, body: body() });
      expect(res.status).toBe(401);
      expect((await err(res)).code).toBe('unauthorized');
      expect((await call('DELETE', url, { headers: h })).status).toBe(401);
    }
  });
  it('expiresInDays: absent keeps, null removes, integer sets', async () => {
    const c = await create({ expiresInDays: 10 });
    const url = `/api/v1/shares/${c.shareToken}`;
    const kept = await (await call('PUT', url, { headers: auth(c), body: body() })).json<{ expiresAt: string }>();
    expect(kept.expiresAt).toBe(c.expiresAt);
    const set = await (await call('PUT', url, { headers: auth(c), body: body({ expiresInDays: 30 }) })).json<{ expiresAt: string }>();
    expect(Math.round((Date.parse(set.expiresAt) - Date.now()) / 86400000)).toBe(30);
    const removed = await (await call('PUT', url, { headers: auth(c), body: body({ expiresInDays: null }) })).json<{ expiresAt: null }>();
    expect(removed.expiresAt).toBeNull();
  });
  it('If-Match: matching passes, mismatch gives 412, * passes', async () => {
    const c = await create();
    const url = `/api/v1/shares/${c.shareToken}`;
    expect((await call('PUT', url, { headers: auth(c, { 'If-Match': '"r1"' }), body: body() })).status).toBe(200);
    const stale = await call('PUT', url, { headers: auth(c, { 'If-Match': '"r1"' }), body: body() });
    expect(stale.status).toBe(412);
    expect((await err(stale)).code).toBe('precondition_failed');
    expect((await call('PUT', url, { headers: auth(c, { 'If-Match': '*' }), body: body() })).status).toBe(200);
    expect((await call('PUT', url, { headers: auth(c, { 'If-Match': 'garbage' }), body: body() })).status).toBe(412);
  });
  it('400, 413, 415, 422 on bad bodies', async () => {
    const c = await create();
    const url = `/api/v1/shares/${c.shareToken}`;
    expect((await call('PUT', url, { headers: auth(c), body: body({ payload: validPayload({ title: '' }) }) })).status).toBe(400);
    expect((await call('PUT', url, { headers: auth(c), body: body({ schemaVersion: 9 }) })).status).toBe(422);
    expect((await call('PUT', url, { headers: auth(c), raw: 'x'.repeat(16385) , })).status).toBe(415);
    expect((await call('PUT', url, { headers: auth(c, { 'Content-Type': 'application/json' }), raw: 'x'.repeat(16385) })).status).toBe(413);
    expect((await call('PUT', url, { headers: auth(c, { 'Content-Type': 'text/plain' }), raw: '{}' })).status).toBe(415);
  });
  it('429 rate_limited after 30 requests per minute per share, with Retry-After', async () => {
    const c = await create();
    const url = `/api/v1/shares/${c.shareToken}`;
    for (let i = 0; i < 30; i++) expect((await call('PUT', url, { headers: auth(c), body: body() })).status).toBe(200);
    const res = await call('PUT', url, { headers: auth(c), body: body() });
    expect(res.status).toBe(429);
    expect((await err(res)).code).toBe('rate_limited');
    const ra = Number(res.headers.get('Retry-After'));
    expect(ra).toBeGreaterThan(0);
    expect(ra).toBeLessThanOrEqual(60);
    expect((await call('DELETE', url, { headers: auth(c) })).status).toBe(429);
  });
  it('a caller without the manage token cannot trigger the per-share limit', async () => {
    const c = await create();
    const other = await create();
    const url = `/api/v1/shares/${c.shareToken}`;
    for (let i = 0; i < 35; i++) await call('PUT', url, { headers: auth(other), body: body() });
    expect((await call('PUT', url, { headers: auth(c), body: body() })).status).toBe(200);
  });
});

describe('DELETE /shares/{token}', () => {
  it('revokes: 204, payload cleared, reads give 410, PUT gives 410, repeat gives 204', async () => {
    const c = await create();
    const url = `/api/v1/shares/${c.shareToken}`;
    const res = await call('DELETE', url, { headers: auth(c) });
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
    const row = await env.DB.prepare('SELECT payload, payload_bytes, revoked_at, rev FROM shares WHERE token_hash = ?').bind(await sha(c.shareToken)).first<any>();
    expect(row.payload).toBe('{}');
    expect(row.payload_bytes).toBe(0);
    expect(row.revoked_at).not.toBeNull();
    expect(row.rev).toBe(2);
    const get = await call('GET', url);
    expect(get.status).toBe(410);
    expect((await err(get)).code).toBe('revoked');
    expect(get.headers.get('Cache-Control')).toBe('public, max-age=60');
    const put = await call('PUT', url, { headers: auth(c), body: body() });
    expect(put.status).toBe(410);
    expect((await err(put)).code).toBe('revoked');
    expect((await call('DELETE', url, { headers: auth(c) })).status).toBe(204);
    const row2 = await env.DB.prepare('SELECT rev FROM shares WHERE token_hash = ?').bind(await sha(c.shareToken)).first<any>();
    expect(row2.rev).toBe(2);
  });
  it('410 body has no payload', async () => {
    const c = await create();
    await call('DELETE', `/api/v1/shares/${c.shareToken}`, { headers: auth(c) });
    const text = await (await call('GET', `/api/v1/shares/${c.shareToken}`)).text();
    expect(text).not.toContain('Our wedding');
  });
});

describe('expiry', () => {
  it('computes expiry from expiresInDays and flips to 410 expired at the boundary', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-10T12:00:00Z'));
    const c = await create({ expiresInDays: 1 });
    expect(c.expiresAt).toBe('2026-10-11T12:00:00Z');
    const url = `/api/v1/shares/${c.shareToken}`;
    vi.setSystemTime(new Date('2026-10-11T11:59:59Z'));
    expect((await call('GET', url)).status).toBe(200);
    vi.setSystemTime(new Date('2026-10-11T12:00:00Z'));
    const res = await call('GET', url);
    expect(res.status).toBe(410);
    expect((await err(res)).code).toBe('expired');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=60');
    const put = await call('PUT', url, { headers: auth(c), body: body() });
    expect(put.status).toBe(410);
    expect((await err(put)).code).toBe('expired');
  });
  it('DELETE on an expired share succeeds with 204 and then reports revoked', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-10T12:00:00Z'));
    const c = await create({ expiresInDays: 1 });
    vi.setSystemTime(new Date('2026-10-13T12:00:00Z'));
    expect((await call('DELETE', `/api/v1/shares/${c.shareToken}`, { headers: auth(c) })).status).toBe(204);
    expect((await err(await call('GET', `/api/v1/shares/${c.shareToken}`))).code).toBe('revoked');
  });
});

describe('limits and quotas', () => {
  it('per-IP: 10 creates per minute then 429 with Retry-After', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-10T12:00:10Z'));
    const ip = freshIp();
    for (let i = 0; i < 10; i++) {
      const res = await call('POST', '/api/v1/shares', { ip, body: body(), headers: { 'X-Install-Id': crypto.randomUUID() } });
      expect(res.status).toBe(201);
    }
    const res = await call('POST', '/api/v1/shares', { ip, body: body(), headers: { 'X-Install-Id': crypto.randomUUID() } });
    expect(res.status).toBe(429);
    expect((await err(res)).code).toBe('rate_limited');
    expect(res.headers.get('Retry-After')).toBe('50');
    // A different IP is unaffected, and the next minute resets.
    expect((await call('POST', '/api/v1/shares', { body: body(), headers: { 'X-Install-Id': INSTALL } })).status).toBe(201);
    vi.setSystemTime(new Date('2026-10-10T12:01:00Z'));
    expect((await call('POST', '/api/v1/shares', { ip, body: body(), headers: { 'X-Install-Id': INSTALL } })).status).toBe(201);
  });
  it('per-IP: 60 creates per hour', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const ip = freshIp();
    const start = Date.parse('2026-11-10T10:00:00Z');
    let last: Response | undefined;
    for (let i = 0; i < 61; i++) {
      vi.setSystemTime(start + Math.floor(i / 10) * 60_000);
      last = await call('POST', '/api/v1/shares', { ip, body: body(), headers: { 'X-Install-Id': crypto.randomUUID() } });
      if (i < 60) expect(last.status).toBe(201);
    }
    expect(last!.status).toBe(429);
    expect((await err(last!)).code).toBe('rate_limited');
    expect(Number(last!.headers.get('Retry-After'))).toBeGreaterThan(60);
  });
  it('raw IPs never appear in rate_counters keys', async () => {
    const ip = '203.0.113.77';
    await create({}, { ip });
    const { results } = await env.DB.prepare('SELECT key FROM rate_counters').all<{ key: string }>();
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) expect(r.key).not.toContain(ip);
  });
  it('51st active share for one install gives quota_exceeded', async () => {
    const install = crypto.randomUUID();
    vi.useFakeTimers({ toFake: ['Date'] });
    const start = Date.parse('2026-12-01T00:00:00Z');
    for (let i = 0; i < 50; i++) {
      vi.setSystemTime(start + i * 3_600_000);
      const res = await call('POST', '/api/v1/shares', { body: body(), headers: { 'X-Install-Id': install } });
      expect(res.status).toBe(201);
    }
    const res = await call('POST', '/api/v1/shares', { body: body(), headers: { 'X-Install-Id': install } });
    expect(res.status).toBe(429);
    expect((await err(res)).code).toBe('quota_exceeded');
  });
  it('revoked shares free quota', async () => {
    const install = crypto.randomUUID();
    const made = [];
    for (let i = 0; i < 50; i++) made.push(await create({}, { headers: { 'X-Install-Id': install } }));
    expect((await call('POST', '/api/v1/shares', { body: body(), headers: { 'X-Install-Id': install } })).status).toBe(429);
    await call('DELETE', `/api/v1/shares/${made[0].shareToken}`, { headers: auth(made[0]) });
    expect((await call('POST', '/api/v1/shares', { body: body(), headers: { 'X-Install-Id': install } })).status).toBe(201);
  });
  it('global daily cap gives quota_exceeded', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2027-01-05T08:00:00Z'));
    await env.DB.prepare('INSERT INTO rate_counters (key, window_start, count) VALUES (?, ?, ?)')
      .bind('create:global:20270105', Date.parse('2027-01-05T00:00:00Z') / 1000, 10000).run();
    const res = await call('POST', '/api/v1/shares', { body: body(), headers: { 'X-Install-Id': INSTALL } });
    expect(res.status).toBe(429);
    expect((await err(res)).code).toBe('quota_exceeded');
    vi.setSystemTime(new Date('2027-01-06T00:00:01Z'));
    expect((await call('POST', '/api/v1/shares', { body: body(), headers: { 'X-Install-Id': INSTALL } })).status).toBe(201);
  });
  it('MAINTENANCE=1 gives 503 on writes only', async () => {
    const c = await create();
    const url = `/api/v1/shares/${c.shareToken}`;
    const vars = { MAINTENANCE: '1' };
    const post = await call('POST', '/api/v1/shares', { vars, body: body(), headers: { 'X-Install-Id': INSTALL } });
    expect(post.status).toBe(503);
    expect((await err(post)).code).toBe('service_unavailable');
    expect((await call('PUT', url, { vars, headers: auth(c), body: body() })).status).toBe(503);
    expect((await call('DELETE', url, { vars, headers: auth(c) })).status).toBe(503);
    expect((await call('GET', url, { vars })).status).toBe(200);
    expect((await call('GET', '/api/v1/health', { vars })).status).toBe(200);
  });
  it('D1 limit errors map to 503, other errors to 500 without leaking details', async () => {
    const throwing = (msg: string) => ({ prepare: () => { throw new Error(msg); }, batch: () => { throw new Error(msg); } }) as unknown as D1Database;
    const limited = await call('GET', `/api/v1/shares/${'a'.repeat(22)}`, { db: throwing('D1_ERROR: D1 DB reached its daily limit') });
    expect(limited.status).toBe(503);
    expect((await err(limited)).code).toBe('service_unavailable');
    const broken = await call('GET', `/api/v1/shares/${'a'.repeat(22)}`, { db: throwing('SELECT secret FROM shares failed') });
    expect(broken.status).toBe(500);
    const text = await broken.text();
    const e = JSON.parse(text).error;
    expect(e.code).toBe('internal_error');
    expect(e.details.requestId).toBe(broken.headers.get('X-Request-Id'));
    expect(text).not.toContain('secret');
  });
});

describe('D1 round trips', () => {
  it('stays within 4 per request on every route', async () => {
    const { db, count, reset } = countingDb();
    const c = await create({}, { db });
    expect(count()).toBeLessThanOrEqual(4);
    const url = `/api/v1/shares/${c.shareToken}`;
    for (const run of [
      () => call('GET', url, { db }),
      () => call('PUT', url, { db, headers: auth(c), body: body() }),
      () => call('DELETE', url, { db, headers: auth(c) }),
      () => call('GET', url, { db }),
    ]) {
      reset();
      await run();
      expect(count()).toBeLessThanOrEqual(4);
      expect(count()).toBeGreaterThan(0);
    }
    reset();
    await call('GET', '/api/v1/health', { db });
    expect(count()).toBe(0);
  });
});

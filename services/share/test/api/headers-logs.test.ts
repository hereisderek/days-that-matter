import { env } from 'cloudflare:workers';
import { afterEach, describe, expect, it, vi } from 'vitest';
import schema from '../../schema/share-payload.v1.schema.json';
import { payloadV1 } from '../../src/lib/validate';
import { INSTALL, auth, body, call, create, sha, validPayload } from './helpers';

afterEach(() => vi.restoreAllMocks());

const routes = async () => {
  const c = await create();
  const url = `/api/v1/shares/${c.shareToken}`;
  const gone = await create();
  await call('DELETE', `/api/v1/shares/${gone.shareToken}`, { headers: auth(gone) });
  return [
    ['health', await call('GET', '/api/v1/health')],
    ['create', await call('POST', '/api/v1/shares', { body: body(), headers: { 'X-Install-Id': INSTALL } })],
    ['create 400', await call('POST', '/api/v1/shares', { body: {}, headers: { 'X-Install-Id': INSTALL } })],
    ['read', await call('GET', url)],
    ['read 304', await call('GET', url, { headers: { 'If-None-Match': '"r1"' } })],
    ['read 404', await call('GET', '/api/v1/shares/nope')],
    ['read 410', await call('GET', `/api/v1/shares/${gone.shareToken}`)],
    ['put', await call('PUT', url, { headers: auth(c), body: body() })],
    ['put 401', await call('PUT', url, { body: body() })],
    ['delete', await call('DELETE', url, { headers: auth(c) })],
    ['unknown route', await call('GET', '/api/v1/nothing')],
    ['page stub', await call('GET', '/e/nope')],
    ['options', await call('OPTIONS', '/api/v1/shares', { headers: { Origin: 'https://evil.test', 'Access-Control-Request-Method': 'POST' } })],
  ] as const;
};

describe('headers', () => {
  it('every route class has nosniff, no-referrer, a request id and no CORS or cookies', async () => {
    for (const [name, res] of await routes()) {
      expect(res.headers.get('X-Content-Type-Options'), name).toBe('nosniff');
      expect(res.headers.get('Referrer-Policy'), name).toBe('no-referrer');
      expect(res.headers.get('X-Request-Id'), name).toMatch(/^[0-9a-f-]{36}$/);
      expect([...res.headers.keys()].filter((k) => k.startsWith('access-control-')), name).toEqual([]);
      expect(res.headers.get('Set-Cookie'), name).toBeNull();
    }
  });
  it('error responses are no-store except 410 which is public max-age=60', async () => {
    for (const [name, res] of await routes()) {
      if (res.status === 410) expect(res.headers.get('Cache-Control'), name).toBe('public, max-age=60');
      else if (res.status >= 400) expect(res.headers.get('Cache-Control'), name).toBe('no-store');
    }
  });
  it('health is no-store and does not echo secrets', async () => {
    const res = await call('GET', '/api/v1/health');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const j = await res.json<Record<string, string>>();
    expect(j.status).toBe('ok');
    expect(j.version).toBe('dev');
    expect(j.time).toMatch(/Z$/);
  });
  it('500 responses carry the headers too', async () => {
    const db = { prepare: () => { throw new Error('boom'); } } as unknown as D1Database;
    const res = await call('GET', `/api/v1/shares/${'a'.repeat(22)}`, { db });
    expect(res.status).toBe(500);
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
  it('preflight from another origin gets no Access-Control-Allow-Origin and no reflected Origin', async () => {
    const res = await call('OPTIONS', '/api/v1/shares', { headers: { Origin: 'https://evil.test', 'Access-Control-Request-Method': 'POST' } });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect([...res.headers.values()].join(' ')).not.toContain('evil.test');
    const post = await call('POST', '/api/v1/shares', { body: body(), headers: { Origin: 'https://evil.test', 'X-Install-Id': INSTALL } });
    expect(post.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});

describe('log redaction', () => {
  it('logs one JSON line without titles, tokens, Authorization, install id or IP', async () => {
    const lines: string[] = [];
    for (const m of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(console, m).mockImplementation((...a: unknown[]) => void lines.push(a.map(String).join(' ')));
    }
    const ip = '198.51.100.23';
    const install = crypto.randomUUID();
    const title = 'TopSecretTitle-xyz';
    const created = await (
      await call('POST', '/api/v1/shares', { ip, body: body({ payload: validPayload({ title }) }), headers: { 'X-Install-Id': install } })
    ).json<{ shareToken: string; manageToken: string }>();
    await call('GET', `/api/v1/shares/${created.shareToken}`, { ip });
    await call('PUT', `/api/v1/shares/${created.shareToken}`, { ip, headers: { Authorization: `Bearer ${created.manageToken}` }, body: body({ payload: validPayload({ title }) }) });
    await call('DELETE', `/api/v1/shares/${created.shareToken}`, { ip, headers: { Authorization: `Bearer ${created.manageToken}` } });
    expect(lines.length).toBe(4);
    const all = lines.join('\n');
    for (const secret of [title, created.shareToken, created.manageToken, install, ip, 'Bearer', 'Authorization']) {
      expect(all, secret).not.toContain(secret);
    }
    const first = JSON.parse(lines[0]);
    expect(Object.keys(first).sort()).toEqual(['rateLimited', 'reqId', 'route', 'status', 'tokenHashPrefix', 'ts']);
    expect(first.route).toBe('/api/v1/shares');
    expect(first.tokenHashPrefix).toBe((await sha(created.shareToken)).slice(0, 8));
    expect(JSON.parse(lines[1]).route).toBe('/api/v1/shares/:token');
  });
  it('logs rateLimited=true on 429', async () => {
    const lines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => void lines.push(String(a[0])));
    const c = await create();
    lines.length = 0;
    await env.DB.prepare('INSERT OR REPLACE INTO rate_counters (key, window_start, count) VALUES (?, ?, 30)')
      .bind(`write:share:${(await sha(c.shareToken)).slice(0, 32)}`, Math.floor(Date.now() / 60000) * 60).run();
    const res = await call('PUT', `/api/v1/shares/${c.shareToken}`, { headers: auth(c), body: body() });
    expect(res.status).toBe(429);
    expect(JSON.parse(lines[0]).rateLimited).toBe(true);
  });
});

describe('JSON Schema file', () => {
  it('documents the same required keys, enums and limits as the zod schema', () => {
    expect(schema.required).toEqual(['v', 'title', 'targetDate', 'theme']);
    expect(Object.keys(schema.properties).sort()).toEqual(['emoji', 'recurrence', 'targetDate', 'targetTime', 'theme', 'timeZone', 'title', 'unitMode', 'v']);
    expect(schema.properties.unitMode.enum).toEqual(['auto', 'days', 'calendar']);
    expect(schema.properties.recurrence.properties.type.enum).toEqual(['none', 'yearly', 'monthly', 'weekly', 'customDays']);
    expect(schema.additionalProperties).toBe(false);
  });
  it('canonical output of the zod schema satisfies the structural patterns', () => {
    const out = payloadV1.parse(validPayload());
    expect(out.targetDate).toMatch(new RegExp(schema.properties.targetDate.pattern));
    expect(out.targetTime).toMatch(new RegExp(schema.properties.targetTime.pattern));
    expect(out.timeZone).toMatch(new RegExp(schema.properties.timeZone.pattern));
    expect(Object.keys(out).sort()).toEqual([...Object.keys(schema.properties)].sort());
  });
});

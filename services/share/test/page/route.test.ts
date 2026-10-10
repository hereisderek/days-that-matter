import { describe, expect, it } from 'vitest';
import { env } from 'cloudflare:workers';
import { createPageRoutes, type LookupFn } from '../../src/routes/page';
import { PAGE_CSP } from '../../src/page/headers';
import { share, TOKEN } from './helpers';

const EXPECTED_CSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'; upgrade-insecure-requests";

function app(lookup: LookupFn) {
  return createPageRoutes(lookup);
}
const get = (a: ReturnType<typeof app>, path: string, init?: RequestInit) => a.request(path, init, env);

const okLookup: LookupFn = async () => ({ status: 'ok', share: share() });
const statusLookup = (status: 'revoked' | 'expired' | 'not_found'): LookupFn => async () => ({ status });

function assertHeaders(res: Response) {
  expect(res.headers.get('content-security-policy')).toBe(EXPECTED_CSP);
  expect(res.headers.get('cache-control')).toBe('no-store');
  expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  expect(res.headers.get('referrer-policy')).toBe('no-referrer');
  expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  expect(res.headers.get('strict-transport-security')).toBe('max-age=31536000');
  expect(res.headers.get('permissions-policy')).toBe('camera=(), microphone=(), geolocation=()');
  expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
  expect(res.headers.get('access-control-allow-origin')).toBeNull();
}

describe('GET /e/:token', () => {
  it('CSP constant matches the contract string', () => {
    expect(PAGE_CSP).toBe(EXPECTED_CSP);
  });

  it('200 active', async () => {
    const res = await get(app(okLookup), `/e/${TOKEN}`);
    expect(res.status).toBe(200);
    assertHeaders(res);
    expect(await res.text()).toContain('Our wedding');
  });

  it('404 unknown', async () => {
    const res = await get(app(statusLookup('not_found')), `/e/${TOKEN}`);
    expect(res.status).toBe(404);
    assertHeaders(res);
  });

  it('410 revoked and expired, no event details', async () => {
    for (const s of ['revoked', 'expired'] as const) {
      const res = await get(app(statusLookup(s)), `/e/${TOKEN}`);
      expect(res.status).toBe(410);
      assertHeaders(res);
      const body = await res.text();
      expect(body).toContain('This link is no longer available');
      expect(body).not.toContain('share-data');
    }
  });

  it('404 body is identical for unknown, malformed and purged', async () => {
    const a = app(statusLookup('not_found'));
    const bodies = await Promise.all(
      ['/e/' + TOKEN, '/e/short', '/e/' + 'x'.repeat(200), '/e/%3Cscript%3E'].map(async (p) => {
        const r = await get(a, p);
        return [r.status, await r.text(), r.headers.get('content-security-policy')];
      }),
    );
    for (const b of bodies) expect(b).toEqual(bodies[0]);
  });

  it('503 when the lookup throws, no error text leaks', async () => {
    const res = await get(
      app(async () => {
        throw new Error('D1_ERROR secret detail');
      }),
      `/e/${TOKEN}`,
    );
    expect(res.status).toBe(503);
    assertHeaders(res);
    expect(res.headers.get('retry-after')).toBe('60');
    expect(await res.text()).not.toContain('secret detail');
  });

  it('HEAD works and POST gets 404 with the same headers', async () => {
    const a = app(okLookup);
    const head = await get(a, `/e/${TOKEN}`, { method: 'HEAD' });
    expect(head.status).toBe(200);
    const post = await get(a, `/e/${TOKEN}`, { method: 'POST', body: 'x' });
    expect(post.status).toBe(404);
    assertHeaders(post);
  });

  it('passes the token and current time to the lookup', async () => {
    let seen: [string, number] | null = null;
    const before = Math.floor(Date.now() / 1000);
    await get(
      app(async (_db, token, now) => {
        seen = [token, now];
        return { status: 'not_found' };
      }),
      `/e/${TOKEN}`,
    );
    expect(seen![0]).toBe(TOKEN);
    expect(seen![1]).toBeGreaterThanOrEqual(before);
  });
});

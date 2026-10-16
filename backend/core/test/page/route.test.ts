import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/http/app.ts';
import { pageHeaders } from '../../src/http/headers.ts';
import type { CoreRequest, CoreResponse } from '../../src/http/types.ts';
import { fakePorts } from '../../src/fakes/index.ts';
import type { FakePorts } from '../../src/fakes/index.ts';
import { createPageRoutes, type LookupFn } from '../../src/page/routes.ts';
import { ORIGIN, MEDIA_ORIGIN, PAGE_CSP } from '../../src/page/headers.ts';
import { http, request, text } from '../helpers.ts';
import { share, TOKEN } from './helpers.ts';

const okLookup: LookupFn = async () => ({ status: 'ok', share: share() });
const statusLookup = (status: 'revoked' | 'expired' | 'not_found'): LookupFn => async () => ({ status });

function buildApp(lookup: LookupFn = okLookup, overrides: Partial<FakePorts> = {}) {
  const ports = { ...fakePorts(), ...overrides } as FakePorts;
  const routes = createPageRoutes(lookup);
  return { app: createApp(ports, { routes, log: () => {} }), ports };
}

function get(path: string, method = 'GET', body?: string): CoreRequest {
  return request(method, path, body !== undefined ? { body } : {});
}

async function bytes(res: CoreResponse): Promise<{ status: number; headers: [string, string][]; body: string }> {
  const r = http(res);
  return {
    status: r.status,
    headers: [...r.headers.entries()].filter(([k]) => k !== 'x-request-id').sort(([a], [b]) => a.localeCompare(b)),
    body: await text(r),
  };
}

function assertHeaders(res: CoreResponse, origin: string, mediaOrigin: string) {
  const h = http(res).headers;
  const expected = pageHeaders(origin, mediaOrigin);
  expect(h.get('content-security-policy')).toBe(expected['Content-Security-Policy']);
  expect(h.get('cache-control')).toBe('no-store');
  expect(h.get('x-robots-tag')).toBe('noindex, nofollow');
  expect(h.get('referrer-policy')).toBe('no-referrer');
  expect(h.get('x-content-type-options')).toBe('nosniff');
  expect(h.get('strict-transport-security')).toBe('max-age=31536000');
  expect(h.get('permissions-policy')).toBe('camera=(), microphone=(), geolocation=()');
  expect(h.get('content-type')).toBe('text/html; charset=utf-8');
  expect(h.get('access-control-allow-origin')).toBeNull();
  expect(h.get('set-cookie')).toBeNull();
}

describe('GET /e/:token', () => {
  it('CSP constant matches the contract string', () => {
    expect(PAGE_CSP).toBe(pageHeaders(ORIGIN, MEDIA_ORIGIN)['Content-Security-Policy']);
  });

  it('paths under /e/ without a single token segment get the HTML 404 page', async () => {
    const { app, ports } = buildApp(okLookup);
    for (const path of ['/e/', '/e/a/b']) {
      const res = http(await app.handle(get(path)));
      expect(res.status).toBe(404);
      assertHeaders(res, ports.config.origin, ports.config.mediaOrigin);
      expect(await text(res)).toContain('Link not found');
    }
  });

  it('200 active', async () => {
    const { app, ports } = buildApp(okLookup);
    const res = http(await app.handle(get(`/e/${TOKEN}`)));
    expect(res.status).toBe(200);
    assertHeaders(res, ports.config.origin, ports.config.mediaOrigin);
    expect(await text(res)).toContain('Our wedding');
  });

  it('404 unknown', async () => {
    const { app, ports } = buildApp(statusLookup('not_found'));
    const res = http(await app.handle(get(`/e/${TOKEN}`)));
    expect(res.status).toBe(404);
    assertHeaders(res, ports.config.origin, ports.config.mediaOrigin);
    expect(await text(res)).toContain('Link not found');
  });

  it('410 revoked and expired, no event details', async () => {
    for (const s of ['revoked', 'expired'] as const) {
      const { app, ports } = buildApp(statusLookup(s));
      const res = http(await app.handle(get(`/e/${TOKEN}`)));
      expect(res.status).toBe(410);
      assertHeaders(res, ports.config.origin, ports.config.mediaOrigin);
      const body = await text(res);
      expect(body).toContain('This link is no longer available');
      expect(body).not.toContain('share-data');
    }
  });

  it('404 body is identical for unknown, malformed and purged', async () => {
    const { app } = buildApp(statusLookup('not_found'));
    const bodies = await Promise.all(
      ['/e/' + TOKEN, '/e/short', '/e/' + 'x'.repeat(200), '/e/%3Cscript%3E'].map(async (p) => {
        const r = http(await app.handle(get(p)));
        return [r.status, await text(r), r.headers.get('content-security-policy')];
      }),
    );
    for (const b of bodies) expect(b).toEqual(bodies[0]);
  });

  it('503 when the lookup throws, no error text leaks', async () => {
    const { app, ports } = buildApp(async () => {
      throw new Error('D1_ERROR secret detail');
    });
    const res = http(await app.handle(get(`/e/${TOKEN}`)));
    expect(res.status).toBe(503);
    assertHeaders(res, ports.config.origin, ports.config.mediaOrigin);
    expect(res.headers.get('retry-after')).toBe('60');
    expect(await text(res)).not.toContain('secret detail');
  });

  it('HEAD works and POST gets 404 with the same headers', async () => {
    const { app, ports } = buildApp(okLookup);
    const head = http(await app.handle(get(`/e/${TOKEN}`, 'HEAD')));
    expect(head.status).toBe(200);
    const post = http(await app.handle(get(`/e/${TOKEN}`, 'POST', 'x')));
    expect(post.status).toBe(404);
    assertHeaders(post, ports.config.origin, ports.config.mediaOrigin);
  });

  it('passes the token and current time to the lookup', async () => {
    let seen: [string, number] | null = null;
    const { app, ports } = buildApp(async (_ports, token, now) => {
      seen = [token, now];
      return { status: 'not_found' };
    });
    const before = Math.floor(ports.clock.nowMs() / 1000);
    await app.handle(get(`/e/${TOKEN}`));
    expect(seen).not.toBeNull();
    if (seen) {
      expect((seen as [string, number])[0]).toBe(TOKEN);
      expect((seen as [string, number])[1]).toBeGreaterThanOrEqual(before);
    }
  });
});

describe('generic landing pages: GET /i/:token and GET /s/:id', () => {
  it('GET /i/:token renders generic invite landing page with store links and no event details', async () => {
    const { app, ports } = buildApp();
    const res = http(await app.handle(get(`/i/${TOKEN}`)));
    expect(res.status).toBe(200);
    assertHeaders(res, ports.config.origin, ports.config.mediaOrigin);
    const body = await text(res);
    expect(body).toContain('You&#39;re invited to a day in Days That Matter. Open it in the app to join.');
    expect(body).toContain('Open in app');
    expect(body).toContain('App Store');
    expect(body).toContain('Google Play');
    expect(body).not.toContain('Our wedding');
    expect(body).not.toContain('share-data');
    expect(body).not.toMatch(/<script/);
  });

  it('GET /s/:id renders generic member landing page with store links and no event details', async () => {
    const { app, ports } = buildApp();
    const res = http(await app.handle(get('/s/0b8f3c1e-6d0a-4a51-9f61-2f1b3f6d9a10')));
    expect(res.status).toBe(200);
    assertHeaders(res, ports.config.origin, ports.config.mediaOrigin);
    const body = await text(res);
    expect(body).toContain('Open in the app');
    expect(body).toContain('Open in app');
    expect(body).toContain('App Store');
    expect(body).toContain('Google Play');
    expect(body).not.toContain('Our wedding');
    expect(body).not.toContain('share-data');
    expect(body).not.toMatch(/<script/);
  });

  it('byte-comparison: /i/:token responses for valid, used-up, revoked, expired, unknown and malformed tokens are byte-identical', async () => {
    const { app } = buildApp();
    const tokens = [
      TOKEN,
      'valid_token_1234567890',
      'used_up_token_0987654321',
      'revoked_token_abcdefghij',
      'expired_token_zyxwvutsrq',
      'unknown_token_1122334455',
      'short',
      'x'.repeat(100),
      '%3Cscript%3Ealert(1)%3C%2Fscript%3E',
    ];

    const ref = await bytes(await app.handle(get(`/i/${tokens[0]}`)));
    expect(ref.status).toBe(200);

    for (const t of tokens.slice(1)) {
      const resp = await bytes(await app.handle(get(`/i/${t}`)));
      expect(resp, `Mismatch for token ${t}`).toEqual(ref);
    }
  });

  it('byte-comparison: /s/:id responses for valid, revoked, unknown and malformed ids are byte-identical', async () => {
    const { app } = buildApp();
    const ids = [
      '0b8f3c1e-6d0a-4a51-9f61-2f1b3f6d9a10',
      'revoked-event-id',
      'unknown-event-id',
      'short',
      'x'.repeat(100),
      '%3Cscript%3E',
    ];

    const ref = await bytes(await app.handle(get(`/s/${ids[0]}`)));
    expect(ref.status).toBe(200);

    for (const id of ids.slice(1)) {
      const resp = await bytes(await app.handle(get(`/s/${id}`)));
      expect(resp, `Mismatch for id ${id}`).toEqual(ref);
    }
  });
});

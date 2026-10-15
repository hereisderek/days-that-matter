// Task 3.1: log lines never contain titles, memo text, emails, codes, tokens, cookies, Authorization
// values, IPs or Spotify URLs (BACKEND.md section 14).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/http/app.ts';
import type { Handler } from '../../src/http/app.ts';
import { readJsonObject } from '../../src/http/body.ts';
import { ApiError } from '../../src/http/errors.ts';
import type { Route } from '../../src/http/router.ts';
import { jsonResponse } from '../../src/http/types.ts';
import { fakePorts } from '../../src/fakes/index.ts';
import { request } from '../helpers.ts';

afterEach(() => vi.restoreAllMocks());

const SECRETS = {
  title: 'TopSecretTitle-7f3a',
  memo: 'Private memo text 9c2e',
  email: 'mum.secret@example.org',
  code: '493817',
  linkToken: 'Ab3dEf6hIj9lMn2pQr5tUv',
  session: `st_${'S'.repeat(43)}`,
  cookie: 'sid=cookie-value-1b2c',
  ip: '198.51.100.23',
  ipv6: '2001:db8::7',
  spotify: 'https://open.spotify.com/track/37i9dQZF1DXcBWIGoYBM5M',
  pushToken: 'push-token-d4e5f6',
};

const routes: Route<Handler>[] = [
  {
    method: 'POST',
    pattern: '/api/v1/events/:id',
    handler: async ({ req }) => {
      const body = await readJsonObject(req);
      return jsonResponse(200, { received: Object.keys(body).length });
    },
  },
  { method: 'GET', pattern: '/api/v1/links/:token', handler: ({ params }) => jsonResponse(200, { length: params['token']?.length }) },
  {
    method: 'POST',
    pattern: '/api/v1/auth/email/verify',
    handler: async (ctx) => {
      await readJsonObject(ctx.req);
      ctx.rateLimited = true;
      throw new ApiError('rate_limited', 'Too many requests', null, { 'Retry-After': '60' });
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/crash',
    handler: async ({ req }) => {
      const body = await readJsonObject(req);
      throw new Error(`failed for ${JSON.stringify(body)} ${req.headers.get('Authorization')}`);
    },
  },
];

describe('log redaction', () => {
  it('logs one fixed-shape line per request and none of the sensitive values', async () => {
    const lines: string[] = [];
    const consoleLines: string[] = [];
    for (const m of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(console, m).mockImplementation((...a: unknown[]) => void consoleLines.push(a.map(String).join(' ')));
    }
    const app = createApp(fakePorts(), { routes, log: (l) => lines.push(l) });
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SECRETS.session}`,
      Cookie: SECRETS.cookie,
      'X-Forwarded-For': SECRETS.ip,
      'X-Push-Token': SECRETS.pushToken,
    };
    const body = JSON.stringify({
      title: SECRETS.title, notes: SECRETS.memo, email: SECRETS.email, code: SECRETS.code,
      audio: { kind: 'spotify', url: SECRETS.spotify }, pushToken: SECRETS.pushToken,
    });
    await app.handle(request('POST', `/api/v1/events/${SECRETS.linkToken}?email=${encodeURIComponent(SECRETS.email)}`, { headers, body, ip: SECRETS.ip }));
    await app.handle(request('GET', `/api/v1/links/${SECRETS.linkToken}?code=${SECRETS.code}`, { headers, ip: SECRETS.ipv6 }));
    await app.handle(request('POST', '/api/v1/auth/email/verify', { headers, body: JSON.stringify({ email: SECRETS.email, code: SECRETS.code }), ip: SECRETS.ip }));
    await app.handle(request('POST', '/api/v1/crash', { headers, body, ip: SECRETS.ip }));
    await app.handle(request('GET', `/api/v1/unknown/${SECRETS.linkToken}/${encodeURIComponent(SECRETS.spotify)}`, { headers, ip: SECRETS.ip }));
    await app.handle(request('POST', `/api/v1/events/${SECRETS.linkToken}`, { headers, body: `{"title":"${SECRETS.title}"`, ip: SECRETS.ip }));

    expect(lines).toHaveLength(6);
    expect(consoleLines).toEqual([]);
    const all = lines.join('\n');
    for (const [name, value] of Object.entries(SECRETS)) expect(all, name).not.toContain(value);
    for (const word of ['Bearer', 'Authorization', 'Cookie', 'spotify', '@']) expect(all, word).not.toContain(word);

    const parsed = lines.map((l) => JSON.parse(l) as Record<string, unknown>);
    for (const p of parsed) expect(Object.keys(p)).toEqual(['ts', 'route', 'status', 'reqId', 'rateLimited']);
    expect(parsed.map((p) => [p['route'], p['status'], p['rateLimited']])).toEqual([
      ['/api/v1/events/:id', 200, false],
      ['/api/v1/links/:token', 200, false],
      ['/api/v1/auth/email/verify', 429, true],
      ['/api/v1/crash', 500, false],
      [null, 404, false],
      ['/api/v1/events/:id', 400, false],
    ]);
  });

  it('the default sink writes the line with console.log only', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = createApp(fakePorts(), { routes });
    await app.handle(request('POST', '/api/v1/crash', { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: SECRETS.title }) }));
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0]?.[0])).not.toContain(SECRETS.title);
    expect(error).not.toHaveBeenCalled();
  });
});

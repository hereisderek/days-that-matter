import { describe, expect, it } from 'vitest';
import { API, coreRoutes, createApp } from '../../src/http/app.ts';
import type { Handler } from '../../src/http/app.ts';
import { ApiError } from '../../src/http/errors.ts';
import { fromFetchRequest, toFetchResponse } from '../../src/http/fetch.ts';
import type { Route } from '../../src/http/router.ts';
import { emptyResponse, jsonResponse } from '../../src/http/types.ts';
import { StoreBusyError } from '../../src/ports/store.ts';
import { fakePorts } from '../../src/fakes/index.ts';
import { http, json, request, text } from '../helpers.ts';

function setup(routes: readonly Route<Handler>[] = coreRoutes) {
  const lines: string[] = [];
  const ports = fakePorts();
  const app = createApp(ports, { routes, log: (l) => lines.push(l) });
  return { app, ports, lines };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('app', () => {
  it('GET /health answers with the deployment version', async () => {
    const { app, lines } = setup();
    const res = http(await app.handle(request('GET', `${API}/health`)));
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ status: 'ok', version: 'test' });
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('X-Request-Id')).toMatch(UUID);
    expect(JSON.parse(lines[0] as string)).toEqual({
      ts: '2026-10-12T15:04:05.000Z', route: '/api/v1/health', status: 200, reqId: res.headers.get('X-Request-Id'), rateLimited: false,
    });
  });

  it('unknown routes, wrong methods and preflights are the same 404 without CORS', async () => {
    const { app, lines } = setup();
    const bodies = [];
    for (const [method, path] of [['GET', `${API}/nothing`], ['DELETE', `${API}/health`], ['OPTIONS', `${API}/health`]] as const) {
      const res = http(await app.handle(request(method, path, { headers: { Origin: 'https://evil.test' } })));
      expect(res.status).toBe(404);
      expect(res.headers.get('Cache-Control')).toBe('no-store');
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
      bodies.push(await text(res));
    }
    expect(new Set(bodies).size).toBe(1);
    expect(lines.map((l) => (JSON.parse(l) as { route: unknown }).route)).toEqual([null, null, null]);
  });

  it('request ids are unique per request', async () => {
    const { app } = setup();
    const ids = new Set<string | null>();
    for (let i = 0; i < 5; i++) ids.add(http(await app.handle(request('GET', `${API}/health`))).headers.get('X-Request-Id'));
    expect(ids.size).toBe(5);
  });

  it('HEAD runs the GET route without a body', async () => {
    const { app } = setup();
    const res = http(await app.handle(request('HEAD', `${API}/health`)));
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it('maps ApiError, store contention and unexpected errors', async () => {
    const routes: Route<Handler>[] = [
      { method: 'GET', pattern: '/api', handler: () => { throw new ApiError('forbidden', 'Role too low'); } },
      { method: 'GET', pattern: '/busy', handler: () => { throw new StoreBusyError(); } },
      { method: 'GET', pattern: '/boom', handler: async () => { throw new Error('SQL near "secret"'); } },
    ];
    const { app } = setup(routes);
    const forbidden = http(await app.handle(request('GET', '/api')));
    expect([forbidden.status, await json(forbidden)]).toEqual([403, { error: { code: 'forbidden', message: 'Role too low', details: null } }]);
    const busy = http(await app.handle(request('GET', '/busy')));
    expect([busy.status, busy.headers.get('Retry-After')]).toEqual([503, '60']);
    const boom = http(await app.handle(request('GET', '/boom')));
    const reqId = boom.headers.get('X-Request-Id');
    expect(boom.status).toBe(500);
    expect(await json(boom)).toEqual({ error: { code: 'internal_error', message: 'Internal error', details: { requestId: reqId } } });
    expect(boom.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(boom.headers.get('Cache-Control')).toBe('no-store');
  });

  it('passes a live upgrade through with headers and logs status 101', async () => {
    const routes: Route<Handler>[] = [
      { method: 'GET', pattern: '/live', handler: () => ({ kind: 'live', eventId: 'e1', subscriber: { role: 'public' }, headers: new Headers() }) },
    ];
    const { app, lines } = setup(routes);
    const res = await app.handle(request('GET', '/live'));
    expect(res.kind).toBe('live');
    expect(res.headers.get('X-Request-Id')).toMatch(UUID);
    expect((JSON.parse(lines[0] as string) as { status: number }).status).toBe(101);
  });
});

describe('fetch adapters', () => {
  it('converts a Fetch request and response', async () => {
    const req = fromFetchRequest(new Request('https://dtm.example/api/v1/x?a=1', { method: 'POST', body: '{}', headers: { 'X-A': 'b' } }), '203.0.113.9');
    expect([req.method, req.path, req.query.get('a'), req.headers.get('x-a'), req.clientIp]).toEqual(['POST', '/api/v1/x', '1', 'b', '203.0.113.9']);
    expect(await new Response(req.body).text()).toBe('{}');
    const res = toFetchResponse(jsonResponse(201, { ok: true }, { 'X-B': 'c' }));
    expect([res.status, res.headers.get('x-b'), await res.json()]).toEqual([201, 'c', { ok: true }]);
    const bytes = toFetchResponse({ kind: 'http', status: 200, headers: new Headers(), body: new Uint8Array([104, 105]) });
    expect(await bytes.text()).toBe('hi');
    expect(await toFetchResponse(emptyResponse(204)).text()).toBe('');
    expect(toFetchResponse({ kind: 'http', status: 304, headers: new Headers(), body: 'ignored' }).status).toBe(304);
  });
});

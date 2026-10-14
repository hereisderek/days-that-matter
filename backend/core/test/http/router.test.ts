import { describe, expect, it } from 'vitest';
import { Router } from '../../src/http/router.ts';

describe('Router', () => {
  const router = new Router<string>()
    .add('GET', '/api/v1/events/:id', 'get-event')
    .add('PATCH', '/api/v1/events/:id', 'patch-event')
    .add('get', '/api/v1/events/:id/memos/:memoId', 'memo')
    .add('GET', '/api/v1/health', 'health');

  it('matches literal segments and parameters', () => {
    expect(router.match('GET', '/api/v1/health')?.route.handler).toBe('health');
    const m = router.match('GET', '/api/v1/events/abc');
    expect(m?.route.pattern).toBe('/api/v1/events/:id');
    expect(m?.params).toEqual({ id: 'abc' });
    expect(router.match('GET', '/api/v1/events/e1/memos/m2')?.params).toEqual({ id: 'e1', memoId: 'm2' });
  });

  it('selects by method, case-insensitively, with HEAD falling back to GET', () => {
    expect(router.match('patch', '/api/v1/events/abc')?.route.handler).toBe('patch-event');
    expect(router.match('HEAD', '/api/v1/health')?.route.handler).toBe('health');
    expect(router.match('DELETE', '/api/v1/events/abc')).toBeNull();
    expect(router.match('OPTIONS', '/api/v1/health')).toBeNull();
  });

  it('decodes parameters and refuses malformed or empty ones', () => {
    expect(router.match('GET', '/api/v1/events/a%20b')?.params).toEqual({ id: 'a b' });
    expect(router.match('GET', '/api/v1/events/%E0%A4%A')).toBeNull();
    expect(router.match('GET', '/api/v1/events/')).toBeNull();
  });

  it('needs the same number of segments', () => {
    expect(router.match('GET', '/api/v1/health/')).toBeNull();
    expect(router.match('GET', '/api/v1/events/a/b')).toBeNull();
    expect(router.match('GET', '/api/v1')).toBeNull();
  });

  it('rejects patterns without a leading slash', () => {
    expect(() => new Router<string>().add('GET', 'api', 'x')).toThrow();
  });
});

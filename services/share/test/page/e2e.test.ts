import { describe, expect, it } from 'vitest';
import { auth, call, create, validPayload } from '../api/helpers';
import { blobOf } from './helpers';

// The page through the real app and D1: create with the API, then read /e/{token}.
const page = (path: string) => call('GET', path);

describe('/e/{token} end to end', () => {
  it('serves an active share with all headers', async () => {
    const c = await create();
    const res = await page(`/e/${c.shareToken}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('content-security-policy')).toContain("script-src 'self'");
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
    const body = await res.text();
    expect(body).toContain('Our wedding');
    expect(JSON.parse(blobOf(body)).shareToken).toBe(c.shareToken);
  });

  it('renders a hostile title inert', async () => {
    const title = '</title><script>alert(1)</script>"><img src=x onerror=alert(1)>';
    const c = await create({ payload: validPayload({ title }) });
    const body = await (await page(`/e/${c.shareToken}`)).text();
    expect(body).not.toContain('<script>alert');
    expect(body).not.toContain('<img src=x');
    expect(JSON.parse(blobOf(body)).payload.title).toBe(title);
  });

  it('410 after revoke, without the title', async () => {
    const c = await create({ payload: validPayload({ title: 'Secret surprise' }) });
    expect((await call('DELETE', `/api/v1/shares/${c.shareToken}`, { headers: auth(c) })).status).toBe(204);
    const res = await page(`/e/${c.shareToken}`);
    expect(res.status).toBe(410);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.text();
    expect(body).toContain('This link is no longer available');
    expect(body).not.toContain('Secret surprise');
  });

  it('404 for unknown and malformed tokens, same body and headers', async () => {
    const results = await Promise.all(
      [`/e/${'A'.repeat(22)}`, '/e/short', `/e/${'A'.repeat(23)}`, '/e/%00'].map(async (p) => {
        const r = await page(p);
        const h = [...r.headers].filter(([k]) => k !== 'x-request-id').sort();
        return [r.status, JSON.stringify(h), await r.text()];
      }),
    );
    expect(results[0]![0]).toBe(404);
    for (const r of results) expect(r).toEqual(results[0]);
  });
});

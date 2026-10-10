import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { rootTokens, tokenDrift } from '../../scripts/lib/tokens.mjs';

// Served through the Static Assets binding, so this also covers what the deployed site serves
// (the `_headers` file included, as far as the local emulation applies it).
async function asset(path: string): Promise<Response> {
  return env.ASSETS.fetch(`https://daysthatmatter.app${path}`, { redirect: 'manual' });
}
async function text(path: string): Promise<string> {
  const res = await asset(path);
  expect(res.status, path).toBe(200);
  return res.text();
}

describe('design tokens', () => {
  it('parses the :root block of share.css', async () => {
    const css = await text('/assets/share.css');
    expect(rootTokens(css)!.size).toBeGreaterThan(30);
    expect(tokenDrift(css, css)).toEqual([]);
  });

  // The comparison against design/v1/css/styles.css itself runs in `npm run check:assets` (Node),
  // because the test runtime cannot read files outside the service directory.
  it('detects a changed value, a missing token and an extra token', async () => {
    const css = await text('/assets/share.css');
    const drifted = css.replace('--brand-primary: #3B82F6;', '--brand-primary: #3B82F7;');
    expect(drifted).not.toBe(css);
    expect(tokenDrift(css, drifted)).toEqual([expect.stringContaining('--brand-primary differs')]);
    expect(tokenDrift(css, css.replace(/ {2}--radius-xs: [^;]+;\n/, ''))).toEqual(['share.css is missing --radius-xs']);
    expect(tokenDrift(css, css.replace(':root {', ':root {\n  --extra: 1px;'))).toEqual([expect.stringContaining('--extra')]);
  });
});

describe('well-known files', () => {
  it('assetlinks.json is JSON, served without redirect', async () => {
    const res = await asset('/.well-known/assetlinks.json');
    expect(res.status).toBe(200);
    const j = (await res.json()) as any;
    expect(j[0].relation).toEqual(['delegate_permission/common.handle_all_urls']);
    expect(j[0].target.namespace).toBe('android_app');
    expect(j[0].target.sha256_cert_fingerprints.length).toBeGreaterThanOrEqual(2);
  });

  it('apple-app-site-association is JSON, served without redirect', async () => {
    const res = await asset('/.well-known/apple-app-site-association');
    expect(res.status).toBe(200);
    const j = (await res.json()) as any;
    expect(j.applinks.details[0].components).toEqual([{ '/': '/e/*' }]);
    expect(j.applinks.details[0].appIDs.length).toBe(1);
  });

  it('serves both with Content-Type application/json and no duplicated nosniff', async () => {
    for (const path of ['/.well-known/apple-app-site-association', '/.well-known/assetlinks.json']) {
      const res = await asset(path);
      expect(res.headers.get('content-type'), path).toBe('application/json');
      expect(res.headers.get('x-content-type-options'), path).toBe('nosniff');
      expect(res.headers.get('location')).toBeNull();
    }
  });
});

describe('static pages and CSS', () => {
  it('have no inline script, style or handler', async () => {
    for (const path of ['/', '/gone', '/error']) {
      const page = await text(path);
      expect(page).not.toMatch(/<script/i);
      expect(page).not.toMatch(/<style/i);
      expect(page).not.toMatch(/<[^>]*\sstyle=/i);
      expect(page).not.toMatch(/<[^>]*\son[a-z]+=/i);
    }
  });
  it('share.css loads only same-origin resources', async () => {
    const css = await text('/assets/share.css');
    const urls = [...css.matchAll(/url\(([^)]+)\)/g)];
    expect(urls.length).toBeGreaterThan(0);
    for (const m of urls) expect(m[1]).toMatch(/^'\/assets\//);
    expect(css).not.toMatch(/@import/);
  });
  it('countdown.js never writes HTML', async () => {
    expect(await text('/assets/countdown.js')).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function/);
  });
  it('default OG image is a 1200x630 PNG', async () => {
    const res = await asset('/og/default.png');
    expect(res.status).toBe(200);
    const b = new DataView(await res.arrayBuffer());
    expect(b.getUint32(0)).toBe(0x89504e47);
    expect(b.getUint32(16)).toBe(1200);
    expect(b.getUint32(20)).toBe(630);
  });
});

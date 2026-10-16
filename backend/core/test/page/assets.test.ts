import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderActive } from '../../src/page/render.ts';
import { PAGE_CSP } from '../../src/page/headers.ts';
import { NOW_MS, share } from './helpers.ts';

const WEB = path.resolve(import.meta.dirname, '../../web');

describe('page assets', () => {
  it('serves the same countdown script as the one the core imports', () => {
    expect(fs.readFileSync(path.join(WEB, 'assets/countdown.js'), 'utf8')).toBe(fs.readFileSync(path.join(WEB, 'countdown.js'), 'utf8'));
  });

  it('has every file the page and the stylesheet refer to', () => {
    const css = fs.readFileSync(path.join(WEB, 'assets/share.css'), 'utf8');
    const urls = [...css.matchAll(/url\('\/assets\/([^']+)'\)/g)].map((m) => m[1] as string);
    expect(urls.length).toBeGreaterThanOrEqual(5);
    for (const name of [...urls, 'icon.svg', 'countdown.js', 'share.css']) {
      expect(fs.existsSync(path.join(WEB, 'assets', name)), name).toBe(true);
    }
  });

  it('needs nothing the content security policy blocks', () => {
    const css = fs.readFileSync(path.join(WEB, 'assets/share.css'), 'utf8');
    expect(css).not.toMatch(/@import|url\(['"]?https?:/);
    expect(PAGE_CSP).toContain("style-src 'self'");
    expect(PAGE_CSP).toContain("font-src 'self'");
    const page = renderActive(share(), NOW_MS);
    expect(page).not.toMatch(/(?:src|href)="https?:\/\/(?!daysthatmatter\.app|play\.google\.com|apps\.apple\.com|media\.daysthatmatter\.app)/);
  });

  it('has a stylesheet rule for every dim and blur step the page can write', () => {
    const css = fs.readFileSync(path.join(WEB, 'assets/share.css'), 'utf8');
    for (let i = 0; i <= 16; i++) {
      expect(css).toContain(`.dim-${i} {`);
      expect(css).toContain(`.blur-${i} {`);
    }
  });

  it('styles every card style, typography and palette the page can name', () => {
    const css = fs.readFileSync(path.join(WEB, 'assets/share.css'), 'utf8');
    for (const card of ['glass', 'solid', 'minimal', 'outline', 'poster']) expect(css, card).toContain(`data-card='${card}'`);
    for (const type of ['classic', 'rounded', 'mono', 'condensed']) expect(css, type).toContain(`data-type='${type}'`);
    for (const pal of ['blue', 'rose', 'emerald', 'amber', 'violet', 'sky', 'coral', 'plum', 'ink']) expect(css, pal).toContain(`data-palette='${pal}'`);
  });
});

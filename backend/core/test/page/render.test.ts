import { describe, expect, it } from 'vitest';
import { renderActive, renderGone, renderNotFound, renderUnavailable } from '../../src/page/render.ts';
import { truncate } from '../../src/page/og.ts';
import { blobOf, NOW_MS, payload, share, TOKEN } from './helpers.ts';

// Hostile titles. Every one must come out inert in body, title, meta content and the JSON blob.
export const XSS_CORPUS = [
  '</title><script>alert(1)</script>',
  '"><img src=x onerror=alert(1)>',
  "' onmouseover='alert(1)",
  '</script><script>alert(1)</script>',
  '${alert(1)} `${alert(1)}` {{constructor.constructor("alert(1)")()}}',
  '<svg/onload=alert(1)>',
  '&lt;b&gt; &amp; &#x3C;script&#x3E;',
  'line\u2028sep\u2029para',
  '\u{1F469}‍\u{1F469}‍\u{1F467} family \u{1F1EB}\u{1F1F7}',
  '‮evil‬ RTL ⁦iso⁩',
  '<!-- comment --><![CDATA[x]]>',
  'javascript:alert(1)',
];

describe('active page', () => {
  it('renders the event', () => {
    const page = renderActive(share(), NOW_MS);
    expect(page).toContain('<h1 class="share-title" id="share-title">Our wedding</h1>');
    expect(page).toContain('<meta name="robots" content="noindex, nofollow">');
    expect(page).toContain(`<link rel="canonical" href="https://daysthatmatter.app/e/${TOKEN}">`);
    expect(page).toContain('<meta property="og:title" content="Our wedding">');
    expect(page).toContain('<meta property="og:description" content="244 days to go">');
    expect(page).toContain('<meta property="og:image" content="https://daysthatmatter.app/og/default.png">');
    expect(page).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(page).toContain(`app-argument=https://daysthatmatter.app/e/${TOKEN}`);
    expect(page).toContain('data-palette="violet" data-card="glass" data-type="modern"');
    expect(page).toContain('<script type="module" src="/assets/countdown.js"></script>');
    expect(page).toContain('Report this link');
    expect(page).toContain('Created by a user of Days That Matter');
  });

  it('has no inline script, inline style or event handler attribute', () => {
    for (const title of ['Plain', ...XSS_CORPUS]) {
      const page = renderActive(share({ title }), NOW_MS);
      expect(page).not.toMatch(/<style/i);
      expect(page.replace(/="[^"]*"/g, '=""')).not.toMatch(/<[^>]*\sstyle=/i);
      // Drop quoted attribute values first: escaped title text such as `onerror=` is inert inside them.
      const m = /<[^>]*\son[a-z]+=/i.exec(page.replace(/="[^"]*"/g, '=""'));
      expect(m && m[0], title).toBeNull();
      const scripts = page.match(/<script[^>]*>/g) ?? [];
      expect(scripts).toEqual(['<script type="application/json" id="share-data">', '<script type="module" src="/assets/countdown.js">']);
    }
  });

  it('smart banner links use the fixed origin and token', () => {
    const page = renderActive(share(), NOW_MS);
    expect(page).toContain(`href="daysthatmatter://event?token=${TOKEN}"`);
    expect(page).toMatch(/play\.google\.com\/store\/apps\/details\?id=[^"&]+&amp;referrer=share_token%3D/);
    expect(page).toContain('id="banner-android" hidden');
  });

  it('falls back to defaults for unknown theme ids', () => {
    const base = share();
    const basePayload = base.payload ?? payload();
    const baseTheme = basePayload.theme ?? { paletteId: 'blue', cardStyle: 'glass', typography: 'modern' };
    const page = renderActive(
      {
        ...base,
        payload: {
          ...basePayload,
          theme: { ...baseTheme, paletteId: '"x"', cardStyle: 'nope', typography: '<b>' },
        },
      },
      NOW_MS,
    );
    expect(page).toContain('data-palette="blue" data-card="glass" data-type="modern"');
  });

  it('truncates the og title to 70 graphemes without splitting emoji', () => {
    const family = '\u{1F469}‍\u{1F469}‍\u{1F467}';
    const t = truncate(family.repeat(80), 70);
    expect([...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(t)].length).toBe(70);
    expect(t.endsWith('…')).toBe(true);
    expect(truncate('short', 70)).toBe('short');
    const page = renderActive(share({ title: 'x'.repeat(100) }), NOW_MS);
    expect(page).toContain(`<meta property="og:title" content="${'x'.repeat(69)}…">`);
  });
});

describe('XSS corpus', () => {
  for (const title of XSS_CORPUS) {
    it(`inert: ${JSON.stringify(title).slice(0, 50)}`, () => {
      const page = renderActive(share({ title, emoji: title.slice(0, 4) }), NOW_MS);
      const blob = blobOf(page);
      // JSON blob: no character that could close the block, and it round-trips.
      expect(blob).not.toMatch(/[<>&\u2028\u2029]/);
      expect(JSON.parse(blob).payload.title).toBe(title);
      // Outside the blob, no raw markup from the title survives.
      const outside = page.replace(blob, '');
      expect(outside).not.toContain('<script>alert');
      expect(outside).not.toContain('<img src=x');
      expect(outside).not.toContain('<svg/onload');
      expect(outside).not.toContain('</title><script');
      expect(outside).not.toContain('"><img');
      // <title> holds one text node only.
      const titleMatch = /<title>([\s\S]*?)<\/title>/.exec(page);
      expect(titleMatch).not.toBeNull();
      const titleTag = titleMatch ? (titleMatch[1] ?? '') : '';
      expect(titleTag).not.toContain('<');
      // meta content attributes contain no raw quote or angle bracket from the title.
      for (const m of page.matchAll(/<meta [^>]*content="([^"]*)"/g)) {
        expect(m[1]).not.toMatch(/[<>]/);
      }
    });
  }

  it('golden snapshot of the hostile page', () => {
    const page = renderActive(share({ title: '</title><script>alert(1)</script>"><img src=x onerror=alert(1)>', emoji: null }), NOW_MS);
    expect(page).toMatchSnapshot();
  });
});

describe('message pages', () => {
  it('404 page shows no event data', () => {
    const page = renderNotFound();
    expect(page).toContain('Link not found');
    expect(page).not.toContain('share-data');
    expect(page).not.toMatch(/<script/);
  });
  it('410 page says the link is gone', () => {
    expect(renderGone()).toContain('This link is no longer available');
  });
  it('503 page', () => {
    expect(renderUnavailable()).toContain('Temporarily unavailable');
  });
});

describe('backdrop and audio rendering', () => {
  it('renders still photo backdrop and preview meta image', () => {
    const page = renderActive(
      share({
        backdrop: {
          kind: 'still',
          stillId: 'photo123',
          stillUrl: 'https://media.daysthatmatter.app/m/photo123.jpg',
          dim: 0.3,
          blur: 4,
        },
      }),
      NOW_MS,
    );
    expect(page).toContain('<div class="share-backdrop" data-dim="0.3" data-blur="4">');
    expect(page).toContain('<img class="backdrop-still" src="https://media.daysthatmatter.app/m/photo123.jpg" alt="">');
    expect(page).toContain('<meta property="og:image" content="https://media.daysthatmatter.app/m/photo123.jpg">');
    expect(page).toContain('<meta name="twitter:image" content="https://media.daysthatmatter.app/m/photo123.jpg">');
  });

  it('renders animated photo backdrop with video and still fallback', () => {
    const page = renderActive(
      share({
        backdrop: {
          kind: 'animated',
          stillId: 'photo123',
          motionId: 'motion456',
          stillUrl: 'https://media.daysthatmatter.app/m/photo123.jpg',
          motionUrl: 'https://media.daysthatmatter.app/m/motion456.mp4',
          dim: 0,
        },
      }),
      NOW_MS,
    );
    expect(page).toContain('<video class="backdrop-motion" src="https://media.daysthatmatter.app/m/motion456.mp4" poster="https://media.daysthatmatter.app/m/photo123.jpg" playsinline muted loop></video>');
    expect(page).toContain('<img class="backdrop-still" src="https://media.daysthatmatter.app/m/photo123.jpg" alt="">');
  });

  it('renders library audio track player with token link', () => {
    const page = renderActive(
      share({
        audio: {
          kind: 'library',
          trackId: 'calm-lofi',
        },
      }),
      NOW_MS,
    );
    expect(page).toContain('<div class="share-audio" id="share-audio">');
    expect(page).toContain(`src="https://daysthatmatter.app/api/v1/audio/calm-lofi?link=${TOKEN}"`);
    expect(page).toContain('controls');
  });

  it('renders spotify link with track title and artist', () => {
    const page = renderActive(
      share({
        audio: {
          kind: 'spotify',
          url: 'https://open.spotify.com/track/12345',
          title: 'Awesome Song',
          artist: 'Great Artist',
        },
      }),
      NOW_MS,
    );
    expect(page).toContain('<div class="share-spotify" id="share-spotify">');
    expect(page).toContain('href="https://open.spotify.com/track/12345"');
    expect(page).toContain('Listen on Spotify');
    expect(page).toContain('Awesome Song • Great Artist');
  });

  it('custom audio does not render an audio player on the web', () => {
    const page = renderActive(
      share({
        audio: {
          kind: 'custom',
          mediaId: 'audio-custom-1',
          title: 'My Custom Song',
        },
      }),
      NOW_MS,
    );
    expect(page).not.toContain('share-audio');
    expect(page).not.toContain('audio-player');
    expect(page).not.toContain('My Custom Song');
  });
});

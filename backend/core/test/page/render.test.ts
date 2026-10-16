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
    expect(page).toContain('data-palette="violet" data-card="glass" data-type="modern" data-backdrop="none"');
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

  it('offers the app through the scheme link and the stores, and no event data in them', () => {
    const page = renderActive(share(), NOW_MS);
    expect(page).toContain(`id="cta-open" href="daysthatmatter://e/${TOKEN}">Open in Days That Matter</a>`);
    expect(page).toMatch(/play\.google\.com\/store\/apps\/details\?id=[^"&]+&amp;referrer=share_token%3D/);
    expect(page).toContain('apps.apple.com/app/id');
    expect(page).toContain('Created with');
    expect(page).not.toContain('banner-android');
  });

  it('leaves out a store the region does not have', () => {
    const page = renderActive(share(), NOW_MS, { stores: ['google'] });
    expect(page).toContain('store-google');
    expect(page).not.toContain('store-apple');
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
    expect(page).toContain('data-palette="blue" data-card="glass" data-type="modern" data-backdrop="none"');
  });

  it('maps spec names and app ids of card styles and typographies', () => {
    const cases: [string, string, string, string][] = [
      ['Glassmorphic', 'ModernSans', 'glass', 'modern'],
      ['minimal', 'classic', 'minimal', 'classic'],
      ['MinimalistClean', 'ClassicSerif', 'minimal', 'classic'],
      ['CardOutlined', 'PlayfulRounded', 'outline', 'rounded'],
      ['FullBleedPoster', 'MonospaceTech', 'poster', 'mono'],
      ['poster', 'EditorialCondensed', 'poster', 'condensed'],
      ['solid', 'condensed', 'solid', 'condensed'],
    ];
    for (const [cardStyle, typography, card, type] of cases) {
      const base = payload();
      const page = renderActive(share({ theme: { ...(base.theme as NonNullable<typeof base.theme>), cardStyle, typography } }), NOW_MS);
      expect(page, cardStyle).toContain(`data-card="${card}" data-type="${type}"`);
    }
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

describe('card content', () => {
  const html = (over = {}) => renderActive(share(over), NOW_MS);

  it('shows emoji, title, date, time, zone, repeat and direction', () => {
    const page = html({ recurrence: { type: 'yearly', originalYear: 2020 } });
    expect(page).toContain('<span class="card-emoji" aria-hidden="true">\u{1F48D}</span>');
    expect(page).toContain('<p class="share-kicker" id="share-kicker">Until</p>');
    expect(page).toContain('<span id="share-when">Saturday, June 12, 2027 \u00b7 4:30 PM</span>');
    expect(page).toMatch(/id="share-zone">.*GMT\+2 \u00b7 Paris<\/span>/);
    expect(page).toContain('Repeats yearly');
    expect(page).toContain('7th anniversary');
  });

  it('shows Since for a past date and Today on the day', () => {
    expect(html({ targetDate: '2026-01-02', targetTime: null, timeZone: 'UTC' })).toContain('id="share-kicker">Since</p>');
    const day = html({ targetDate: '2026-10-10', targetTime: null, timeZone: 'UTC' });
    expect(day).toContain('id="share-kicker">Today is the day</p>');
  });

  it('labels repeats and hides the chips that do not apply', () => {
    expect(html({ recurrence: { type: 'monthly' } })).toContain('Repeats monthly');
    expect(html({ recurrence: { type: 'weekly' } })).toContain('Repeats weekly');
    expect(html({ recurrence: { type: 'customDays', days: 10 } })).toContain('Repeats every 10 days');
    expect(html({ recurrence: { type: 'customDays', days: 1 } })).toContain('Repeats daily');
    const none = html();
    expect(none).not.toContain('Repeats');
    expect(none).toContain('id="share-anniversary" hidden');
  });

  it('shows no zone chip for a floating time', () => {
    expect(html({ timeZone: null })).not.toContain('chip-zone');
  });

  it('puts the number of the unit mode in the hero and the rest in the ticker', () => {
    const days = html({ unitMode: 'days' });
    expect(days).toContain('data-len="3">244</span><span class="hero-unit" id="hero-unit">days to go</span>');
    expect(days).toContain('<span class="tick-label">hours</span>');
    const weeks = html({ unitMode: 'weeks' });
    expect(weeks).toContain('id="hero-num" data-len="2">34</span><span class="hero-unit" id="hero-unit">weeks to go');
    const hours = html({ unitMode: 'hours' });
    expect(hours).toContain('hours to go');
    expect(hours).toContain('5,8');
    const workdays = html({ unitMode: 'workdays' });
    expect(workdays).toContain('workdays to go');
    expect(workdays).toContain('id="share-ticker" aria-hidden="true" hidden');
    const calendar = html({ unitMode: 'calendar' });
    expect(calendar).toContain('id="hero-unit">months to go');
    expect(calendar).toMatch(/tick-label">days?<\/span>/);
  });

  it('uses the singular for one', () => {
    const page = html({ targetDate: '2026-10-11', targetTime: '15:00:00', timeZone: 'UTC', unitMode: 'days' });
    expect(page).toContain('>1</span><span class="hero-unit" id="hero-unit">day to go');
  });

  it('shows a word instead of a number when the day has come and nothing is left', () => {
    const page = html({ targetDate: '2026-10-10', targetTime: '00:00:00', timeZone: 'UTC' });
    expect(page).toContain('data-word="true"');
    expect(page).toContain('id="hero-num" data-len="5">Today</span>');
  });

  it('never includes a memo, notes or a category', () => {
    const page = renderActive(share({ memo: 'secret memo', notes: 'secret notes', categoryId: 'secret-cat', category: 'Secret' } as never), NOW_MS);
    expect(page).not.toMatch(/secret/i);
  });

  it('offers the app on the page but keeps the open button out of the page body text for crawlers', () => {
    expect(html()).toContain('class="app-cta"');
  });
});

describe('backdrop and audio rendering', () => {
  const still = {
    kind: 'still' as const,
    stillId: 'photo123',
    stillUrl: 'https://media.daysthatmatter.app/m/photo123.jpg',
    dim: 0.3,
    blur: 4,
  };

  it('renders a still photo backdrop with dim and blur steps and the preview meta image', () => {
    const page = renderActive(share({ backdrop: still }), NOW_MS);
    expect(page).toContain('<div class="share-backdrop dim-6 blur-4" aria-hidden="true">');
    expect(page).toContain('<img class="backdrop-still" src="https://media.daysthatmatter.app/m/photo123.jpg" alt="">');
    expect(page).not.toContain('<video');
    expect(page).toContain('data-backdrop="still"');
    expect(page).toContain('<img class="ambient-img" src="https://media.daysthatmatter.app/m/photo123.jpg" alt="">');
    expect(page).toContain('<meta property="og:image" content="https://media.daysthatmatter.app/m/photo123.jpg">');
    expect(page).toContain('<meta name="twitter:image" content="https://media.daysthatmatter.app/m/photo123.jpg">');
  });

  it('clamps dim to 0.8 and blur to 16', () => {
    const page = renderActive(share({ backdrop: { ...still, dim: 3, blur: 99 } }), NOW_MS);
    expect(page).toContain('share-backdrop dim-16 blur-16');
    const { blur: _blur, ...noBlur } = still;
    const low = renderActive(share({ backdrop: { ...noBlur, dim: -1 } }), NOW_MS);
    expect(low).toContain('share-backdrop dim-0 blur-0');
  });

  it('draws no backdrop on the outlined card, only the page glow', () => {
    const base = payload();
    const theme = { ...(base.theme as NonNullable<typeof base.theme>), cardStyle: 'outline' };
    const page = renderActive(share({ backdrop: still, theme }), NOW_MS);
    expect(page).not.toContain('class="share-backdrop');
    expect(page).toContain('class="ambient-img"');
  });

  it('renders an animated photo as muted looping inline video over its still', () => {
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
    expect(page).toContain(
      '<video class="backdrop-motion" src="https://media.daysthatmatter.app/m/motion456.mp4" poster="https://media.daysthatmatter.app/m/photo123.jpg" autoplay muted loop playsinline preload="auto" disablepictureinpicture tabindex="-1"></video>',
    );
    expect(page).toContain('<img class="backdrop-still" src="https://media.daysthatmatter.app/m/photo123.jpg" alt="">');
    expect(page).toContain('data-backdrop="animated"');
  });

  it('renders a built-in track as a pill with play, mute and equalizer, and starts nothing on its own', () => {
    const page = renderActive(share({ audio: { kind: 'library', trackId: 'calm-lofi' } }), NOW_MS);
    expect(page).toContain('<div class="audio-pill" id="share-audio" data-playing="false" data-muted="false" hidden>');
    expect(page).toContain('id="audio-toggle" aria-pressed="false" aria-label="Play music"');
    expect(page).toContain('id="audio-mute" aria-pressed="false" aria-label="Mute music"');
    expect(page).toContain('<span class="audio-title">Calm lofi</span>');
    expect(page).toContain('<span class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>');
    expect(page).toContain(`<audio class="share-audio-player" id="audio-player" src="https://daysthatmatter.app/api/v1/audio/calm-lofi?link=${TOKEN}" preload="none"></audio>`);
    expect(page).not.toMatch(/<audio[^>]*\sautoplay/);
    // Without script the pill stays hidden and a plain player takes over.
    expect(page).toMatch(/<noscript><audio class="share-audio-fallback"[^>]* controls><\/audio><\/noscript>/);
  });

  it('uses the title and artist a catalog lookup gives', () => {
    const page = renderActive(share({ audio: { kind: 'library', trackId: 'calm-lofi' } }), NOW_MS, {
      trackInfo: () => ({ title: 'Calm Lo-fi', artist: 'DTM Studio' }),
    });
    expect(page).toContain('<span class="audio-title">Calm Lo-fi</span>');
    expect(page).toContain('>DTM Studio</span>');
  });

  it('renders a Spotify link as a pill with the logo, title and artist', () => {
    const page = renderActive(
      share({ audio: { kind: 'spotify', url: 'https://open.spotify.com/track/12345', title: 'Awesome Song', artist: 'Great Artist' } }),
      NOW_MS,
    );
    expect(page).toContain('<a class="spotify-pill" id="share-spotify" href="https://open.spotify.com/track/12345" target="_blank" rel="noopener noreferrer">');
    expect(page).toContain('icon-spotify');
    expect(page).toContain('Listen on Spotify');
    expect(page).toContain('<span class="audio-title">Awesome Song</span>');
    expect(page).toContain('<span class="audio-note">Great Artist</span>');
    expect(page).not.toContain('<iframe');
  });

  it('shows a Spotify link without a name as the label alone', () => {
    const page = renderActive(share({ audio: { kind: 'spotify', url: 'https://open.spotify.com/track/12345' } }), NOW_MS);
    expect(page).toContain('Listen on Spotify');
    expect(page).not.toContain('audio-title');
  });

  it('refuses a link that is not Spotify', () => {
    const page = renderActive(share({ audio: { kind: 'spotify', url: 'javascript:alert(1)' } }), NOW_MS);
    expect(page).not.toContain('spotify-pill');
    expect(page.replace(blobOf(page), '')).not.toContain('javascript:alert');
  });

  it('custom audio does not render an audio player on the web', () => {
    const page = renderActive(share({ audio: { kind: 'custom', mediaId: 'audio-custom-1', title: 'My Custom Song' } }), NOW_MS);
    expect(page).not.toContain('share-audio');
    expect(page).not.toContain('audio-player');
    expect(page).not.toContain('My Custom Song');
  });
});

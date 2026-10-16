import { html, jsonForScript, raw, type HtmlString } from './html.ts';
import { cellText, compute, display, ordinal, summaryText, unitLabel, type CountdownState } from './countdown.ts';
import { genericMetaTags, IOS_APP_ID, metaTags, PLAY_PACKAGE, playUrl, REPORT_EMAIL, schemeUrl, shareUrl, truncate, ORIGIN } from './og.ts';
import type { PageShare, SharePayload } from './types.ts';

// Theme ids are free strings in the contract (`^[a-z0-9_-]{1,32}$`). The page maps the ids the apps send,
// and the spelling of the spec names (docs/features/customization/SPEC.md section 2), to the styles it has.
// Anything else falls back to the first entry.
const PALETTES = ['blue', 'rose', 'emerald', 'amber', 'violet', 'sky', 'coral', 'plum', 'ink'];
const CARD_STYLES: Readonly<Record<string, string>> = {
  glass: 'glass',
  glassmorphic: 'glass',
  solid: 'solid',
  minimal: 'minimal',
  minimalist: 'minimal',
  minimalistclean: 'minimal',
  clean: 'minimal',
  outline: 'outline',
  outlined: 'outline',
  cardoutlined: 'outline',
  poster: 'poster',
  fullbleed: 'poster',
  fullbleedposter: 'poster',
};
const TYPOGRAPHIES: Readonly<Record<string, string>> = {
  modern: 'modern',
  modernsans: 'modern',
  sans: 'modern',
  classic: 'classic',
  classicserif: 'classic',
  serif: 'classic',
  rounded: 'rounded',
  playful: 'rounded',
  playfulrounded: 'rounded',
  mono: 'mono',
  monospace: 'mono',
  monospacetech: 'mono',
  condensed: 'condensed',
  editorial: 'condensed',
  editorialcondensed: 'condensed',
};

function key(value: string | undefined): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function pickPalette(value: string | undefined): string {
  const id = (value ?? '').toLowerCase();
  return PALETTES.includes(id) ? id : (PALETTES[0] as string);
}

function pickFrom(map: Readonly<Record<string, string>>, value: string | undefined, fallback: string): string {
  return map[key(value)] ?? fallback;
}

const SPOTIFY_URL = /^https:\/\/open\.spotify\.com\//;
const LOCALE = 'en-US';

function layout(opts: { title: string; head?: HtmlString | string; bodyAttrs?: HtmlString | string; body: HtmlString }): HtmlString {
  return html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#0A0D0C">
<title>${opts.title}</title>
<link rel="icon" href="/assets/icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/share.css">
${opts.head ?? ''}
</head>
<body${opts.bodyAttrs ?? ''}>
${opts.body}
</body>
</html>
`;
}

const ICON_PLAY = html`<svg class="icon icon-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z"/></svg>`;
const ICON_PAUSE = html`<svg class="icon icon-pause" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4.2" height="14" rx="1.4"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.4"/></svg>`;
const ICON_VOLUME = html`<svg class="icon icon-volume" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.6l4.4 3.6V5.9L7.6 9.5H4Z" fill="currentColor" stroke="none"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.6a7.6 7.6 0 0 1 0 10.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const ICON_MUTED = html`<svg class="icon icon-muted" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.6l4.4 3.6V5.9L7.6 9.5H4Z" fill="currentColor" stroke="none"/><path d="m16 9.5 5 5m0-5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const ICON_SPOTIFY = html`<svg class="icon icon-spotify" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#1DB954"/><path d="M6.4 9.2c3.7-1.1 7.9-.8 11.2 1.1M6.9 12.4c3.1-.9 6.5-.6 9.2.9M7.4 15.3c2.5-.7 5.1-.4 7.2.8" fill="none" stroke="#08130C" stroke-width="1.7" stroke-linecap="round"/></svg>`;
const ICON_REPEAT = html`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M17 3.5 20.5 7 17 10.5M3.5 11V9.5A2.5 2.5 0 0 1 6 7h14.5M7 20.5 3.5 17 7 13.5M20.5 13v1.5a2.5 2.5 0 0 1-2.5 2.5H3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_GLOBE = html`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9s1.3-6.5 3.8-9Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
const ICON_ARROW = html`<svg class="icon icon-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const BRAND_GLYPH = html`<span class="brand-glyph" aria-hidden="true">D</span>`;

function stage(opts: { ambient?: HtmlString | string; body: HtmlString }): HtmlString {
  return html`<div class="stage" id="share-stage">
<div class="ambient" aria-hidden="true">${opts.ambient ?? ''}<span class="ambient-wash"></span><span class="ambient-vignette"></span></div>
<main class="share-main">
${opts.body}
</main>
</div>`;
}

function footer(token: string | null, origin = ORIGIN): HtmlString {
  const subject = encodeURIComponent('Report a shared link');
  const body = encodeURIComponent(token ? `Link: ${shareUrl(token, origin)}\n\nWhat is wrong with it?\n` : 'What is wrong?\n');
  return html`<footer class="share-footer">
<p>Created by a user of Days That Matter</p>
<p><a href="mailto:${REPORT_EMAIL}?subject=${subject}&amp;body=${body}">Report this link</a></p>
</footer>`;
}

function storeLinks(token: string | null, stores: readonly string[]): HtmlString {
  const apple = stores.includes('apple') ? html`<a class="btn btn-store store-apple" href="https://apps.apple.com/app/id${IOS_APP_ID}">App Store</a>` : '';
  const google = stores.includes('google')
    ? html`<a class="btn btn-store store-google" href="${token ? playUrl(token) : `https://play.google.com/store/apps/details?id=${PLAY_PACKAGE}`}">Google Play</a>`
    : '';
  return html`${apple}${google}`;
}

/** The entry to the app under the card. The open and store buttons show on phones and tablets only. */
function appCta(token: string, appScheme: string, stores: readonly string[]): HtmlString {
  return html`<aside class="app-cta" id="app-cta">
<a class="cta-brand" href="/">${BRAND_GLYPH}<span class="cta-brand-text"><small>Created with</small><strong>Days That Matter</strong></span></a>
<div class="cta-actions">
<a class="btn btn-primary btn-open" id="cta-open" href="${schemeUrl(token, appScheme)}">Open in Days That Matter</a>
<div class="cta-stores"><span class="cta-stores-label">Get the app</span>${storeLinks(token, stores)}</div>
</div>
</aside>`;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(2000, m - 1, d));
  date.setUTCFullYear(y);
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: 'full', timeZone: 'UTC' }).format(date);
}

function formatTime(time: string): string {
  const [h, mi] = time.split(':').map(Number) as [number, number];
  return new Intl.DateTimeFormat(LOCALE, { timeStyle: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, 0, 1, h, mi)));
}

function repeatLabel(rec: SharePayload['recurrence']): string {
  switch (rec?.type) {
    case 'yearly':
      return 'Repeats yearly';
    case 'monthly':
      return 'Repeats monthly';
    case 'weekly':
      return 'Repeats weekly';
    case 'customDays': {
      const days = rec.days ?? 0;
      if (days <= 0) return '';
      return days === 1 ? 'Repeats daily' : `Repeats every ${days} days`;
    }
    default:
      return '';
  }
}

/** "EDT · New York" for a zone at the target instant. */
function zoneLabel(zone: string, atMs: number): string {
  const abbr = new Intl.DateTimeFormat(LOCALE, { timeZone: zone, timeZoneName: 'short' })
    .formatToParts(new Date(atMs))
    .find((p) => p.type === 'timeZoneName')?.value;
  const city = (zone.split('/').pop() ?? zone).replace(/_/g, ' ');
  return abbr && abbr !== city ? `${abbr} · ${city}` : city;
}

/** Dim 0 to 0.8 in steps of 0.05, blur 0 to 16 in whole points: the stylesheet has a rule per step. */
function dimStep(dim: number | undefined): number {
  return Math.round(Math.min(0.8, Math.max(0, Number(dim) || 0)) * 20);
}
function blurStep(blur: number | undefined): number {
  return Math.round(Math.min(16, Math.max(0, Number(blur) || 0)));
}

/** A readable name for a built-in track until the page gets the audio catalog ("romantic-strings" to "Romantic strings"). */
function trackName(trackId: string): string {
  const words = trackId.replace(/[-_]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Background music';
}

const SHARED_KEYS = ['v', 'rev', 'title', 'emoji', 'targetDate', 'targetTime', 'timeZone', 'unitMode', 'recurrence', 'theme', 'backdrop', 'audio'] as const;

/** Only the shared fields reach the page's data block: owner-only fields never do, whatever the caller passes. */
function sharedFields(p: SharePayload): Record<string, unknown> {
  const source = p as unknown as Record<string, unknown>;
  return Object.fromEntries(SHARED_KEYS.filter((k) => source[k] !== undefined).map((k) => [k, source[k]]));
}

export interface TrackInfo {
  title: string;
  artist?: string | null;
}

export interface RenderActiveOptions {
  origin?: string;
  mediaOrigin?: string;
  appScheme?: string;
  stores?: readonly string[];
  /** Title and artist of a built-in track; without it the page shows a name made from the track id. */
  trackInfo?: (trackId: string) => TrackInfo | null | undefined;
}

export function renderActive(share: PageShare, nowMs: number, options: RenderActiveOptions = {}): string {
  const origin = options.origin ?? ORIGIN;
  const appScheme = options.appScheme ?? 'daysthatmatter';
  const stores = options.stores ?? ['apple', 'google'];
  let p: SharePayload = (share.payload ?? share.event) as SharePayload;
  if (p.audio?.kind === 'custom') {
    const { audio: _, ...rest } = p;
    p = rest;
  }
  const token = share.shareToken;
  const state: CountdownState = compute(p, nowMs, null);
  const summary = summaryText(state, p.unitMode);
  const view = display(state, p.unitMode);
  const kicker = state.direction === 'today' ? 'Today is the day' : state.direction === 'since' ? 'Since' : 'Until';
  const anniversary = state.anniversary && state.anniversary > 0 ? `${ordinal(state.anniversary)} anniversary` : '';
  const theme = p.theme ?? { paletteId: '', cardStyle: '', typography: '', gradient: null };
  const cardStyle = pickFrom(CARD_STYLES, theme.cardStyle, 'glass');

  const shared = sharedFields(p);
  const blobData: Record<string, unknown> = {
    shareToken: token,
    payload: shared,
    serverTime: new Date(nowMs).toISOString().replace(/\.\d{3}Z$/, 'Z'),
  };
  const blob = jsonForScript(blobData);

  const rest = view.rest.map(
    (c, i) =>
      html`<div class="tick-cell"><span class="tick-num">${cellText(c, i + 1, LOCALE)}</span><span class="tick-label">${unitLabel(c.unit, c.value)}</span></div>`,
  );
  const heroHtml = view.hero
    ? html`<div class="share-hero" id="share-hero" data-word="false" aria-hidden="true"><span class="hero-num" id="hero-num" data-len="${Math.min(9, cellText(view.hero, 0, LOCALE).length)}">${cellText(view.hero, 0, LOCALE)}</span><span class="hero-unit" id="hero-unit">${unitLabel(view.hero.unit, view.hero.value)} ${view.suffix}</span></div>`
    : html`<div class="share-hero" id="share-hero" data-word="true" aria-hidden="true"><span class="hero-num" id="hero-num" data-len="5">Today</span><span class="hero-unit" id="hero-unit"></span></div>`;

  const still = p.backdrop?.stillUrl ?? null;
  const animated = p.backdrop?.kind === 'animated' && !!p.backdrop.motionUrl && still !== null;
  // The outlined style is a plain card: it draws no backdrop of its own, only the page glow does.
  let backdropHtml: HtmlString | string = '';
  if (still && cardStyle !== 'outline') {
    const motion = animated
      ? html`<video class="backdrop-motion" src="${p.backdrop?.motionUrl}" poster="${still}" autoplay muted loop playsinline preload="auto" disablepictureinpicture tabindex="-1"></video>`
      : '';
    backdropHtml = html`<div class="share-backdrop dim-${dimStep(p.backdrop?.dim)} blur-${blurStep(p.backdrop?.blur)}" aria-hidden="true"><img class="backdrop-still" src="${still}" alt="">${motion}<span class="backdrop-dim"></span></div>`;
  }
  const ambientHtml = still ? html`<img class="ambient-img" src="${still}" alt="">` : '';

  const repeat = repeatLabel(p.recurrence);
  const zone = p.timeZone ? zoneLabel(p.timeZone, state.targetMs) : '';
  const chips = html`${repeat ? html`<li class="chip chip-repeat" id="share-repeat">${ICON_REPEAT}${repeat}</li>` : ''}<li class="chip chip-anniversary" id="share-anniversary"${anniversary ? '' : raw(' hidden')}>${anniversary}</li>`;

  let audioHtml: HtmlString | string = '';
  if (p.audio?.kind === 'library') {
    const audioUrl = `${origin}/api/v1/audio/${encodeURIComponent(p.audio.trackId)}?link=${encodeURIComponent(token)}`;
    const info = options.trackInfo?.(p.audio.trackId);
    const title = info?.title ?? trackName(p.audio.trackId);
    const artist = info?.artist || 'Background music';
    audioHtml = html`<div class="audio-pill" id="share-audio" data-playing="false" data-muted="false" hidden>
<button type="button" class="audio-toggle" id="audio-toggle" aria-pressed="false" aria-label="Play music">${ICON_PLAY}${ICON_PAUSE}</button>
<div class="audio-meta"><span class="audio-title">${title}</span><span class="audio-note" id="audio-note">${artist}</span></div>
<span class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
<button type="button" class="audio-mute" id="audio-mute" aria-pressed="false" aria-label="Mute music">${ICON_VOLUME}${ICON_MUTED}</button>
<audio class="share-audio-player" id="audio-player" src="${audioUrl}" preload="none"></audio>
</div>
<noscript><audio class="share-audio-fallback" src="${audioUrl}" preload="none" controls></audio></noscript>`;
  } else if (p.audio?.kind === 'spotify' && SPOTIFY_URL.test(p.audio.url)) {
    const detail = [p.audio.title, p.audio.artist].filter(Boolean);
    audioHtml = html`<a class="spotify-pill" id="share-spotify" href="${p.audio.url}" target="_blank" rel="noopener noreferrer">${ICON_SPOTIFY}<span class="audio-meta"><span class="spotify-label">Listen on Spotify</span>${detail.length > 0 ? html`<span class="audio-title">${p.audio.title ?? ''}</span><span class="audio-note">${p.audio.artist ?? ''}</span>` : ''}</span>${ICON_ARROW}</a>`;
  }

  const body = html`<article class="share-card" id="share-card" data-state="${state.direction}" aria-labelledby="share-title">
${backdropHtml}<span class="card-legible" aria-hidden="true"></span><span class="card-grain" aria-hidden="true"></span>
<div class="card-body">
<header class="card-top">
${p.emoji ? html`<span class="card-emoji" aria-hidden="true">${p.emoji}</span>` : ''}
<ul class="card-chips">${chips}</ul>
</header>
<div class="card-main">
<p class="share-kicker" id="share-kicker">${kicker}</p>
<h1 class="share-title" id="share-title">${p.title}</h1>
<p class="share-when"><span id="share-when">${formatDate(state.occurrenceDate)}${p.targetTime ? ` · ${formatTime(p.targetTime)}` : ''}</span>${zone ? html`<span class="chip chip-zone" id="share-zone">${ICON_GLOBE}${zone}</span>` : ''}</p>
</div>
<div class="card-count">
${heroHtml}
<div class="share-ticker" id="share-ticker" aria-hidden="true"${rest.length > 0 ? '' : raw(' hidden')}>${rest}</div>
</div>
<p class="visually-hidden" id="share-live" role="status">${summary}</p>
${audioHtml}<noscript><p class="share-noscript">${summary}. Turn on JavaScript to see the live countdown.</p></noscript>
</div>
</article>
${appCta(token, appScheme, stores)}
${footer(token, origin)}
<script type="application/json" id="share-data">${raw(blob)}</script>
<script type="module" src="/assets/countdown.js"></script>`;

  return String(
    layout({
      title: `${truncate(p.title, 70)} | Days That Matter`,
      head: metaTags(token, p.title, summary, p.backdrop?.stillUrl, origin),
      bodyAttrs: html` data-palette="${pickPalette(theme.paletteId)}" data-card="${cardStyle}" data-type="${pickFrom(TYPOGRAPHIES, theme.typography, 'modern')}" data-backdrop="${still ? (animated ? 'animated' : 'still') : 'none'}"`,
      body: stage({ ambient: ambientHtml, body }),
    }),
  );
}

function messagePage(title: string, heading: string, text: string): string {
  return String(
    layout({
      title: `${title} | Days That Matter`,
      body: stage({
        body: html`<section class="message-card">
${BRAND_GLYPH}
<h1 class="message-title">${heading}</h1>
<p class="message-text">${text}</p>
<p><a class="btn btn-primary" href="/">About Days That Matter</a></p>
</section>`,
      }),
    }),
  );
}

export const renderNotFound = (): string =>
  messagePage('Link not found', 'Link not found', 'This link does not exist or was typed incorrectly. Ask the sender for a new one.');

export const renderGone = (): string =>
  messagePage('Link unavailable', 'This link is no longer available', 'The owner removed it or it has expired.');

export const renderUnavailable = (): string =>
  messagePage('Temporarily unavailable', 'Temporarily unavailable', 'Something went wrong on our side. Please try again in a few minutes.');

export interface LandingOptions {
  origin?: string;
  appScheme?: string;
  stores?: readonly string[];
  region?: string;
}

/** Generic page for invite and member links. Its output never depends on a token or an id. */
function landingPage(opts: LandingOptions, page: { title: string; description: string; heading: string }): string {
  const origin = opts.origin ?? ORIGIN;
  const appScheme = opts.appScheme ?? 'daysthatmatter';
  const stores = opts.stores ?? ['apple', 'google'];
  const body = html`<section class="message-card landing-card">
${BRAND_GLYPH}
<h1 class="message-title">${page.heading}</h1>
<p class="message-text">${page.description}</p>
<div class="landing-actions">
<a class="btn btn-primary btn-open" href="${appScheme}://">Open in Days That Matter</a>
<div class="cta-stores"><span class="cta-stores-label">Get the app</span>${storeLinks(null, stores)}</div>
</div>
</section>
${footer(null, origin)}`;
  return String(
    layout({
      title: `${page.title} | Days That Matter`,
      head: genericMetaTags(page.description, origin),
      body: stage({ body }),
    }),
  );
}

export function renderInviteLanding(opts: LandingOptions = {}): string {
  return landingPage(opts, {
    title: "You're invited",
    heading: 'Days That Matter',
    description: "You're invited to a day in Days That Matter. Open it in the app to join.",
  });
}

export function renderMemberLanding(opts: LandingOptions = {}): string {
  return landingPage(opts, { title: 'Open in the app', heading: 'Days That Matter', description: 'Open in the app' });
}

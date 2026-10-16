import { html, jsonForScript, raw, type HtmlString } from './html.ts';
import { cells, compute, ordinal, summaryText, type CountdownState } from './countdown.ts';
import { genericMetaTags, IOS_APP_ID, metaTags, PLAY_PACKAGE, playUrl, REPORT_EMAIL, schemeUrl, shareUrl, truncate, ORIGIN } from './og.ts';
import type { PageShare, SharePayload } from './types.ts';

const PALETTES = ['blue', 'rose', 'emerald', 'amber', 'violet'];
const CARD_STYLES = ['glass', 'solid', 'minimal'];
const TYPOGRAPHIES = ['modern', 'classic', 'mono'];

function pick(value: string | undefined, allowed: string[]): string {
  return value && allowed.includes(value) ? value : allowed[0] as string;
}

function layout(opts: { title: string; head?: HtmlString | string; bodyAttrs?: HtmlString | string; body: HtmlString }): HtmlString {
  return html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="color-scheme" content="dark light">
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

function brandHeader(): HtmlString {
  return html`<header class="share-brand"><a class="brand-link" href="/"><span class="brand-glyph" aria-hidden="true">D</span><span>Days That Matter</span></a></header>`;
}

function footer(token: string | null, origin = ORIGIN): HtmlString {
  const subject = encodeURIComponent('Report a shared link');
  const body = encodeURIComponent(token ? `Link: ${shareUrl(token, origin)}\n\nWhat is wrong with it?\n` : 'What is wrong?\n');
  return html`<footer class="share-footer">
<p>Created by a user of Days That Matter</p>
<p><a href="mailto:${REPORT_EMAIL}?subject=${subject}&amp;body=${body}">Report this link</a></p>
</footer>`;
}

export interface RenderActiveOptions {
  origin?: string;
  mediaOrigin?: string;
  appScheme?: string;
}

export function renderActive(share: PageShare, nowMs: number, options: RenderActiveOptions = {}): string {
  const origin = options.origin ?? ORIGIN;
  const appScheme = options.appScheme ?? 'daysthatmatter';
  let p: SharePayload = (share.payload ?? share.event) as SharePayload;
  if (p.audio?.kind === 'custom') {
    const { audio: _, ...rest } = p;
    p = rest;
  }
  const token = share.shareToken;
  const state: CountdownState = compute(p, nowMs, null);
  const summary = summaryText(state, p.unitMode);
  const list = cells(state, p.unitMode);
  const kicker = state.direction === 'today' ? 'Today is the day' : state.direction === 'since' ? 'Since' : 'Until';
  const anniversary = state.anniversary && state.anniversary > 0 ? `${ordinal(state.anniversary)} anniversary` : '';
  const url = shareUrl(token, origin);
  const theme = p.theme ?? { paletteId: '', cardStyle: '', typography: '', gradient: null };

  let payloadForBlob = share.payload;
  if (payloadForBlob?.audio?.kind === 'custom') {
    const { audio: _, ...rest } = payloadForBlob;
    payloadForBlob = rest;
  }

  const blobData: Record<string, unknown> = {
    shareToken: token,
    ...(payloadForBlob !== undefined ? { payload: payloadForBlob } : { event: p, payload: p }),
    serverTime: new Date(nowMs).toISOString().replace(/\.\d{3}Z$/, 'Z'),
  };
  const blob = jsonForScript(blobData);

  const ticker = list.map(
    (c, i) =>
      html`<div class="ticker-cell"><span class="ticker-num">${
        c.unit === 'days' || c.unit === 'years' || c.unit === 'months' || i === 0 ? String(c.value) : String(c.value).padStart(2, '0')
      }</span><span class="ticker-label">${c.unit}</span></div>`,
  );

  let backdropHtml: HtmlString | string = '';
  if (p.backdrop?.stillUrl) {
    const dimAttr = p.backdrop.dim ? html` data-dim="${p.backdrop.dim}"` : '';
    const blurAttr = p.backdrop.blur ? html` data-blur="${p.backdrop.blur}"` : '';
    const motion = p.backdrop.kind === 'animated' && p.backdrop.motionUrl
      ? html`<video class="backdrop-motion" src="${p.backdrop.motionUrl}" poster="${p.backdrop.stillUrl}" playsinline muted loop></video>`
      : '';
    backdropHtml = html`<div class="share-backdrop"${dimAttr}${blurAttr}>${motion}<img class="backdrop-still" src="${p.backdrop.stillUrl}" alt=""></div>`;
  }

  let audioHtml: HtmlString | string = '';
  if (p.audio?.kind === 'library') {
    const audioUrl = `${origin}/api/v1/audio/${encodeURIComponent(p.audio.trackId)}?link=${encodeURIComponent(token)}`;
    audioHtml = html`<div class="share-audio" id="share-audio"><audio class="share-audio-player" id="audio-player" src="${audioUrl}" preload="none" controls></audio></div>`;
  } else if (p.audio?.kind === 'spotify') {
    const spotifyMeta = p.audio.title ? html`<p class="spotify-track">${p.audio.title}${p.audio.artist ? ` • ${p.audio.artist}` : ''}</p>` : '';
    audioHtml = html`<div class="share-spotify" id="share-spotify"><a class="btn btn-spotify" href="${p.audio.url}" target="_blank" rel="noopener noreferrer">Listen on Spotify</a>${spotifyMeta}</div>`;
  }

  const body = html`<main class="share-main">
${brandHeader()}
<section class="share-card" id="share-card" data-state="${state.direction}" aria-labelledby="share-title">
${backdropHtml}${p.emoji ? html`<p class="share-emoji" aria-hidden="true">${p.emoji}</p>` : ''}
<p class="share-kicker" id="share-kicker">${kicker}</p>
<h1 class="share-title" id="share-title">${p.title}</h1>
<p class="share-anniversary" id="share-anniversary"${anniversary ? '' : raw(' hidden')}>${anniversary}</p>
<div class="share-ticker" id="share-ticker" aria-hidden="true">${ticker}</div>
<p class="visually-hidden" id="share-live" role="status">${summary}</p>
<p class="share-when" id="share-when">${state.occurrenceDate}${p.targetTime ? ` ${p.targetTime.slice(0, 5)}` : ''}${p.timeZone ? ` (${p.timeZone})` : ''}</p>
${audioHtml}<noscript><p class="share-noscript">${summary}. Turn on JavaScript to see the live countdown.</p></noscript>
</section>
<aside class="app-banner" id="banner-android" hidden>
<p class="app-banner-text">See this countdown in the Days That Matter app.</p>
<div class="app-banner-actions">
<a class="btn btn-primary" href="${url}">Open in app</a>
<a class="btn" href="${playUrl(token)}">Get it on Google Play</a>
</div>
<a class="app-banner-alt" href="${schemeUrl(token, appScheme)}">App not opening? Try the app link</a>
</aside>
${footer(token, origin)}
</main>
<script type="application/json" id="share-data">${raw(blob)}</script>
<script type="module" src="/assets/countdown.js"></script>`;

  return String(
    layout({
      title: `${truncate(p.title, 70)} | Days That Matter`,
      head: metaTags(token, p.title, summary, p.backdrop?.stillUrl, origin),
      bodyAttrs: html` data-palette="${pick(theme.paletteId, PALETTES)}" data-card="${pick(theme.cardStyle, CARD_STYLES)}" data-type="${pick(theme.typography, TYPOGRAPHIES)}"`,
      body,
    }),
  );
}

function messagePage(title: string, heading: string, text: string): string {
  return String(
    layout({
      title: `${title} | Days That Matter`,
      body: html`<main class="share-main">
${brandHeader()}
<section class="message-card">
<h1 class="message-title">${heading}</h1>
<p class="message-text">${text}</p>
<p><a class="btn btn-primary" href="/">About Days That Matter</a></p>
</section>
</main>`,
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

export function renderInviteLanding(opts: LandingOptions = {}): string {
  const origin = opts.origin ?? ORIGIN;
  const appScheme = opts.appScheme ?? 'daysthatmatter';
  const stores = opts.stores ?? ['apple', 'google'];
  const desc = "You're invited to a day in Days That Matter. Open it in the app to join.";
  const body = html`<main class="share-main">
${brandHeader()}
<section class="message-card">
<h1 class="message-title">Days That Matter</h1>
<p class="message-text">${desc}</p>
<div class="app-banner-actions">
<a class="btn btn-primary" href="${appScheme}://">Open in app</a>
${stores.includes('apple') ? html`<a class="btn" href="https://apps.apple.com/app/id${IOS_APP_ID}">App Store</a>` : ''}
${stores.includes('google') ? html`<a class="btn" href="https://play.google.com/store/apps/details?id=${PLAY_PACKAGE}">Google Play</a>` : ''}
</div>
</section>
${footer(null, origin)}
</main>`;
  return String(
    layout({
      title: "You're invited | Days That Matter",
      head: genericMetaTags(desc, origin),
      body,
    }),
  );
}

export function renderMemberLanding(opts: LandingOptions = {}): string {
  const origin = opts.origin ?? ORIGIN;
  const appScheme = opts.appScheme ?? 'daysthatmatter';
  const stores = opts.stores ?? ['apple', 'google'];
  const desc = 'Open in the app';
  const body = html`<main class="share-main">
${brandHeader()}
<section class="message-card">
<h1 class="message-title">Days That Matter</h1>
<p class="message-text">${desc}</p>
<div class="app-banner-actions">
<a class="btn btn-primary" href="${appScheme}://">Open in app</a>
${stores.includes('apple') ? html`<a class="btn" href="https://apps.apple.com/app/id${IOS_APP_ID}">App Store</a>` : ''}
${stores.includes('google') ? html`<a class="btn" href="https://play.google.com/store/apps/details?id=${PLAY_PACKAGE}">Google Play</a>` : ''}
</div>
</section>
${footer(null, origin)}
</main>`;
  return String(
    layout({
      title: 'Open in the app | Days That Matter',
      head: genericMetaTags(desc, origin),
      body,
    }),
  );
}

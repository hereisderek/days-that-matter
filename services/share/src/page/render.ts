import { html, raw } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import { cells, compute, ordinal, summaryText, type CountdownState } from './countdown';
import { metaTags, playUrl, REPORT_EMAIL, schemeUrl, shareUrl, truncate } from './og';
import type { PageShare, SharePayload } from './types';

type Html = HtmlEscapedString | Promise<HtmlEscapedString>;

const PALETTES = ['blue', 'rose', 'emerald', 'amber', 'violet'];
const CARD_STYLES = ['glass', 'solid', 'minimal'];
const TYPOGRAPHIES = ['modern', 'classic', 'mono'];

function pick(value: string, allowed: string[]): string {
  return allowed.includes(value) ? value : allowed[0]!;
}

/** JSON for a `<script type="application/json">` block. Escapes characters that could end the block. */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function layout(opts: { title: string; head?: Html | string; bodyAttrs?: Html | string; body: Html }): Html {
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

function brandHeader(): Html {
  return html`<header class="share-brand"><a class="brand-link" href="/"><span class="brand-glyph" aria-hidden="true">D</span><span>Days That Matter</span></a></header>`;
}

function footer(token: string | null): Html {
  const subject = encodeURIComponent('Report a shared link');
  const body = encodeURIComponent(token ? `Link: ${shareUrl(token)}\n\nWhat is wrong with it?\n` : 'What is wrong?\n');
  return html`<footer class="share-footer">
<p>Created by a user of Days That Matter</p>
<p><a href="mailto:${REPORT_EMAIL}?subject=${subject}&amp;body=${body}">Report this link</a></p>
</footer>`;
}

export function renderActive(share: PageShare, nowMs: number): string {
  const p: SharePayload = share.payload;
  const token = share.shareToken;
  const state: CountdownState = compute(p, nowMs, null);
  const summary = summaryText(state, p.unitMode);
  const list = cells(state, p.unitMode);
  const kicker = state.direction === 'today' ? 'Today is the day' : state.direction === 'since' ? 'Since' : 'Until';
  const anniversary = state.anniversary && state.anniversary > 0 ? `${ordinal(state.anniversary)} anniversary` : '';
  const url = shareUrl(token);
  const theme = p.theme ?? { paletteId: '', cardStyle: '', typography: '', gradient: null };
  const blob = jsonForScript({
    shareToken: token,
    payload: p,
    serverTime: new Date(nowMs).toISOString().replace(/\.\d{3}Z$/, 'Z'),
  });
  const ticker = list.map(
    (c, i) =>
      html`<div class="ticker-cell"><span class="ticker-num">${
        c.unit === 'days' || c.unit === 'years' || c.unit === 'months' || i === 0 ? String(c.value) : String(c.value).padStart(2, '0')
      }</span><span class="ticker-label">${c.unit}</span></div>`,
  );
  const body = html`<main class="share-main">
${brandHeader()}
<section class="share-card" id="share-card" data-state="${state.direction}" aria-labelledby="share-title">
${p.emoji ? html`<p class="share-emoji" aria-hidden="true">${p.emoji}</p>` : ''}
<p class="share-kicker" id="share-kicker">${kicker}</p>
<h1 class="share-title" id="share-title">${p.title}</h1>
<p class="share-anniversary" id="share-anniversary"${anniversary ? '' : raw(' hidden')}>${anniversary}</p>
<div class="share-ticker" id="share-ticker" aria-hidden="true">${ticker}</div>
<p class="visually-hidden" id="share-live" role="status">${summary}</p>
<p class="share-when" id="share-when">${state.occurrenceDate}${p.targetTime ? ` ${p.targetTime.slice(0, 5)}` : ''}${p.timeZone ? ` (${p.timeZone})` : ''}</p>
<noscript><p class="share-noscript">${summary}. Turn on JavaScript to see the live countdown.</p></noscript>
</section>
<aside class="app-banner" id="banner-android" hidden>
<p class="app-banner-text">See this countdown in the Days That Matter app.</p>
<div class="app-banner-actions">
<a class="btn btn-primary" href="${url}">Open in app</a>
<a class="btn" href="${playUrl(token)}">Get it on Google Play</a>
</div>
<a class="app-banner-alt" href="${schemeUrl(token)}">App not opening? Try the app link</a>
</aside>
${footer(token)}
</main>
<script type="application/json" id="share-data">${raw(blob)}</script>
<script type="module" src="/assets/countdown.js"></script>`;
  return String(
    layout({
      title: `${truncate(p.title, 70)} | Days That Matter`,
      head: metaTags(token, p.title, summary),
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

export const renderNotFound = (): string => messagePage('Link not found', 'Link not found', 'This link does not exist or was typed incorrectly. Ask the sender for a new one.');
export const renderGone = (): string => messagePage('Link unavailable', 'This link is no longer available', 'The owner removed it or it has expired.');
export const renderUnavailable = (): string => messagePage('Temporarily unavailable', 'Temporarily unavailable', 'Something went wrong on our side. Please try again in a few minutes.');

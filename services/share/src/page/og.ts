import { html } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';

export const ORIGIN = 'https://daysthatmatter.app';
// Placeholders until the apps are published (docs/architecture/SHARE_SERVICE.md section 11).
// scripts/check-assets.mjs reports them; a production deploy must have none.
export const IOS_APP_ID = 'IOS_APP_ID_PLACEHOLDER';
export const PLAY_PACKAGE = 'PLAY_PACKAGE_PLACEHOLDER';
export const REPORT_EMAIL = 'abuse@daysthatmatter.app';

export function shareUrl(token: string): string {
  return `${ORIGIN}/e/${token}`;
}

export function playUrl(token: string): string {
  return `https://play.google.com/store/apps/details?id=${encodeURIComponent(PLAY_PACKAGE)}&referrer=${encodeURIComponent(`share_token=${token}`)}`;
}

export function schemeUrl(token: string): string {
  return `daysthatmatter://event?token=${encodeURIComponent(token)}`;
}

/** Truncates to `max` grapheme clusters, adding an ellipsis when cut. */
export function truncate(text: string, max: number): string {
  const seg = new Intl.Segmenter('en', { granularity: 'grapheme' });
  const parts: string[] = [];
  for (const s of seg.segment(text)) {
    parts.push(s.segment);
    if (parts.length > max) break;
  }
  if (parts.length <= max) return text;
  return parts.slice(0, max - 1).join('') + '…';
}

/** Open Graph, Twitter and smart banner meta tags. All values go through hono/html escaping. */
export function metaTags(token: string, title: string, description: string): HtmlEscapedString | Promise<HtmlEscapedString> {
  const url = shareUrl(token);
  const ogTitle = truncate(title, 70);
  const image = `${ORIGIN}/og/default.png`;
  return html`<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Days That Matter">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${ogTitle}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${ogTitle}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${image}">
<meta name="apple-itunes-app" content="app-id=${IOS_APP_ID}, app-argument=${url}">`;
}


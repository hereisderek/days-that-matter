// Preview server for the share web pages: `npm run preview` (port 8080, or PORT).
// Renders every entry of fixtures/sample-events.json through the same renderer and headers as the core,
// serves web/assets and the sample media, and answers the built-in track URL with a generated tone.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderActive, renderGone, renderInviteLanding, renderMemberLanding, renderNotFound } from '../src/page/render.ts';
import { escapeHtml } from '../src/page/html.ts';
import { pageHeaders } from '../src/http/headers.ts';
import type { PublicEvent } from '../src/contract/index.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const FIXTURES_FILE = path.join(ROOT_DIR, 'fixtures', 'sample-events.json');
const MEDIA_DIR = path.join(ROOT_DIR, 'fixtures', 'media');
const ASSETS_DIR = path.join(ROOT_DIR, 'web', 'assets');

interface SampleEntry {
  id: string;
  shareToken: string;
  description: string;
  event: PublicEvent;
}

const DAY_MS = 86_400_000;

/** `TODAY` and `TOMORROW` in the fixture stay relative to the day the server runs. */
function loadSampleEvents(): SampleEntry[] {
  const items: SampleEntry[] = JSON.parse(fs.readFileSync(FIXTURES_FILE, 'utf-8'));
  const iso = (offsetDays: number): string => new Date(Date.now() + offsetDays * DAY_MS).toISOString().slice(0, 10);
  for (const item of items) {
    if (item.event.targetDate === 'TODAY') item.event.targetDate = iso(0);
    if (item.event.targetDate === 'TOMORROW') item.event.targetDate = iso(1);
  }
  return items;
}

const PORT = Number(process.env['PORT'] ?? 8080);
const HOST = '0.0.0.0';

const MIME_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.mp4': 'video/mp4',
  '.wav': 'audio/wav',
};

/** Page headers of the core. Not sent on plain http: HSTS, and `upgrade-insecure-requests`, which would break the previews. */
function previewHeaders(origin: string, embed: boolean): Record<string, string> {
  const headers = { ...pageHeaders(origin, origin) };
  delete headers['Strict-Transport-Security'];
  headers['Content-Security-Policy'] = (headers['Content-Security-Policy'] ?? '')
    .split('; ')
    .filter((d) => d !== 'upgrade-insecure-requests')
    .map((d) => (embed && d.startsWith('frame-ancestors') ? "frame-ancestors 'self'" : d))
    .join('; ');
  headers['Content-Type'] = 'text/html; charset=utf-8';
  return headers;
}

/** A short chord arpeggio as 16 bit mono PCM; the base note comes from the track id. */
function toneWav(trackId: string): Buffer {
  const rate = 22_050;
  const seconds = 16;
  let seed = 0;
  for (const ch of trackId) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const root = 196 * 2 ** ((seed % 7) / 12);
  const scale = [0, 3, 7, 10, 12, 10, 7, 3].map((s) => root * 2 ** (s / 12));
  const samples = new Int16Array(rate * seconds);
  for (let i = 0; i < samples.length; i++) {
    const t = i / rate;
    const step = Math.floor(t / 0.5);
    const local = t - step * 0.5;
    const f = scale[step % scale.length] as number;
    const env = Math.min(1, local / 0.02) * Math.exp(-local * 3.2);
    const pad = Math.sin(2 * Math.PI * root * 0.5 * t) * 0.18;
    const fade = Math.min(1, t / 0.3, (seconds - t) / 0.3);
    const v = (Math.sin(2 * Math.PI * f * t) * 0.55 * env + Math.sin(2 * Math.PI * f * 2 * t) * 0.12 * env + pad) * fade;
    samples[i] = Math.round(Math.max(-1, Math.min(1, v)) * 0.6 * 32767);
  }
  const data = Buffer.from(samples.buffer);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const toneCache = new Map<string, Buffer>();

/** Sends bytes with Range support: browsers need it to play and loop audio and video. */
function sendBytes(req: http.IncomingMessage, res: http.ServerResponse, type: string, body: Buffer): void {
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1;
    if (start <= end && start < body.length) {
      res.writeHead(206, {
        'Content-Type': type,
        'Content-Range': `bytes ${start}-${end}/${body.length}`,
        'Content-Length': end - start + 1,
        'Accept-Ranges': 'bytes',
      });
      res.end(body.subarray(start, end + 1));
      return;
    }
  }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': body.length, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' });
  res.end(body);
}

function sendFile(req: http.IncomingMessage, res: http.ServerResponse, dir: string, name: string): void {
  const filePath = path.join(dir, path.basename(name));
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
    return;
  }
  sendBytes(req, res, MIME_TYPES[path.extname(filePath)] ?? 'application/octet-stream', fs.readFileSync(filePath));
}

function showcase(samples: SampleEntry[]): string {
  const cards = samples
    .map((s) => {
      const t = s.event.theme;
      const tags = [
        s.event.unitMode ?? 'auto',
        t.cardStyle,
        t.typography,
        t.paletteId,
        s.event.backdrop ? `${s.event.backdrop.kind} photo` : '',
        s.event.audio ? `${s.event.audio.kind} audio` : '',
        s.event.recurrence && s.event.recurrence.type !== 'none' ? `repeats ${s.event.recurrence.type}` : '',
        s.event.timeZone ? '' : 'floating time',
      ]
        .filter(Boolean)
        .map((x) => `<span class="tag">${escapeHtml(x)}</span>`)
        .join('');
      const token = encodeURIComponent(s.shareToken);
      return `<article class="sample">
  <h3><span aria-hidden="true">${escapeHtml(s.event.emoji ?? '')}</span> ${escapeHtml(s.event.title)}</h3>
  <p>${escapeHtml(s.description)}</p>
  <div class="tags">${tags}</div>
  <div class="links"><a href="/e/${token}">Open page</a><a href="/frame/${token}">Phone frame</a></div>
</article>`;
    })
    .join('\n');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Days That Matter share page preview</title>
<style>
  body { margin: 0; padding: 40px 20px 80px; background: #0A0D0C; color: #ECF1EE; font: 15px/1.5 system-ui, -apple-system, sans-serif; }
  main { max-width: 1100px; margin: 0 auto; }
  h1 { margin: 0 0 6px; font-size: 28px; letter-spacing: -0.02em; }
  h2 { margin: 40px 0 12px; font-size: 18px; }
  .lead { margin: 0; color: #A9B3AE; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; margin-top: 18px; }
  .sample { padding: 18px; border-radius: 20px; background: #171C1A; border: 1px solid rgba(236,241,238,.1); }
  .sample h3 { margin: 0 0 6px; font-size: 17px; }
  .sample p { margin: 0 0 12px; color: #A9B3AE; font-size: 13.5px; }
  .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
  .tag { padding: 2px 9px; border-radius: 99px; background: #1F2623; color: #52D6A3; font-size: 12px; }
  .links { display: flex; gap: 14px; }
  a { color: #8BBBFF; text-decoration: none; font-weight: 600; font-size: 14px; }
  a:hover { text-decoration: underline; }
  code { background: #1F2623; padding: 1px 6px; border-radius: 6px; }
</style></head>
<body><main>
  <h1>Share page preview</h1>
  <p class="lead">Every sample runs through the core renderer with the core's security headers (strict CSP). Dates marked today and tomorrow follow the day the server runs.</p>
  <h2>Public link pages <code>/e/:token</code></h2>
  <div class="grid">${cards}</div>
  <h2>Generic and error pages</h2>
  <div class="grid">
    <article class="sample"><h3>Invite landing</h3><p>The same bytes for any token.</p><div class="links"><a href="/i/sample_invite_token">/i/sample_invite_token</a><a href="/i/another-token">/i/another-token</a></div></article>
    <article class="sample"><h3>Member landing</h3><p>The same bytes for any event id.</p><div class="links"><a href="/s/sample-wedding">/s/sample-wedding</a></div></article>
    <article class="sample"><h3>Link gone (410)</h3><p>Revoked or expired.</p><div class="links"><a href="/e/expired_token">/e/expired_token</a></div></article>
    <article class="sample"><h3>Not found (404)</h3><p>Unknown token.</p><div class="links"><a href="/e/unknown_token">/e/unknown_token</a></div></article>
  </div>
</main></body></html>`;
}

function frame(token: string): string {
  const src = `/e/${encodeURIComponent(token)}?embed=1`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Phone frame</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #050706; }
  .phone { width: 390px; height: 844px; border-radius: 52px; overflow: hidden; border: 10px solid #222927; box-shadow: 0 40px 90px -30px #000; }
  iframe { width: 100%; height: 100%; border: 0; display: block; background: #0A0D0C; }
</style></head>
<body><div class="phone"><iframe src="${escapeHtml(src)}" title="Share page at phone width"></iframe></div></body></html>`;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? `localhost:${PORT}`}`);
  const pathname = url.pathname;
  const origin = `http://${req.headers.host ?? `localhost:${PORT}`}`;
  const embed = url.searchParams.get('embed') === '1';

  const page = (status: number, body: string): void => {
    res.writeHead(status, previewHeaders(origin, embed));
    res.end(body);
  };

  if (pathname.startsWith('/assets/')) return sendFile(req, res, ASSETS_DIR, pathname);
  if (pathname.startsWith('/media/')) return sendFile(req, res, MEDIA_DIR, pathname);

  const audio = pathname.match(/^\/api\/v1\/audio\/([^/]+)$/);
  if (audio) {
    const id = decodeURIComponent(audio[1] ?? '');
    let tone = toneCache.get(id);
    if (!tone) {
      tone = toneWav(id);
      toneCache.set(id, tone);
    }
    return sendBytes(req, res, 'audio/wav', tone);
  }

  const samples = loadSampleEvents();

  if (pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(showcase(samples));
    return;
  }

  const framed = pathname.match(/^\/frame\/([^/]+)$/);
  if (framed) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(frame(decodeURIComponent(framed[1] ?? '')));
    return;
  }

  const eventMatch = pathname.match(/^\/e\/([^/]+)$/);
  if (eventMatch) {
    const token = decodeURIComponent(eventMatch[1] ?? '');
    if (token === 'expired_token') return page(410, renderGone());
    const sample = samples.find((s) => s.shareToken === token);
    if (!sample) return page(404, renderNotFound());
    return page(200, renderActive({ shareToken: sample.shareToken, event: sample.event }, Date.now(), { origin }));
  }

  if (pathname.startsWith('/i/')) return page(200, renderInviteLanding({ origin }));
  if (pathname.startsWith('/s/')) return page(200, renderMemberLanding({ origin }));

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, HOST, () => {
  console.log(`[Days That Matter] Preview server running at http://${HOST}:${PORT}/`);
});

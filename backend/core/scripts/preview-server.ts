import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderActive, renderGone, renderInviteLanding, renderMemberLanding, renderNotFound } from '../src/page/render.ts';
import type { PublicEvent } from '../src/contract/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const FIXTURES_FILE = path.join(ROOT_DIR, 'fixtures', 'sample-events.json');
const ASSETS_DIR = path.join(ROOT_DIR, 'web', 'assets');

interface SampleEntry {
  id: string;
  shareToken: string;
  description: string;
  event: PublicEvent;
}

function loadSampleEvents(): SampleEntry[] {
  const content = fs.readFileSync(FIXTURES_FILE, 'utf-8');
  const items: SampleEntry[] = JSON.parse(content);
  const today = new Date().toISOString().slice(0, 10);
  for (const item of items) {
    if (item.event.targetDate === 'TODAY') {
      item.event.targetDate = today;
    }
  }
  return items;
}

const PORT = Number(process.env['PORT'] ?? 8080);
const HOST = '0.0.0.0';

const MIME_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const pathname = url.pathname;

  // Static Assets
  if (pathname.startsWith('/assets/')) {
    const filename = path.basename(pathname);
    const filePath = path.join(ASSETS_DIR, filename);
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath);
      const mime = MIME_TYPES[ext] ?? 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'public, max-age=3600' });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Asset not found');
    return;
  }

  const samples = loadSampleEvents();

  // Root Showcase Index
  if (pathname === '/') {
    const today = new Date().toISOString().slice(0, 10);
    const rows = samples
      .map((s) => {
        const theme = s.event.theme;
        const target = s.event.targetDate === today ? 'Today!' : s.event.targetDate;
        return `
        <tr style="border-bottom: 1px solid #27272a;">
          <td style="padding: 14px 16px; font-weight: 600;">
            <a href="/e/${encodeURIComponent(s.shareToken)}" style="color: #60a5fa; text-decoration: none;">
              ${s.event.emoji ?? '📅'} ${s.event.title}
            </a>
          </td>
          <td style="padding: 14px 16px; color: #a1a1aa;">${s.description}</td>
          <td style="padding: 14px 16px; font-family: monospace; color: #e4e4e7;">${target}</td>
          <td style="padding: 14px 16px;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; background: #27272a; color: #38bdf8;">
              ${s.event.unitMode ?? 'auto'}
            </span>
          </td>
          <td style="padding: 14px 16px;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; background: #3f3f46; color: #f472b6;">
              ${theme.paletteId} · ${theme.cardStyle}
            </span>
          </td>
          <td style="padding: 14px 16px;">
            <a href="/e/${encodeURIComponent(s.shareToken)}" style="display: inline-block; padding: 6px 12px; background: #2563eb; color: #ffffff; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 500;">
              View Event ↗
            </a>
          </td>
        </tr>
      `;
      })
      .join('\n');

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Days That Matter - Share Web Showcase</title>
  <style>
    body {
      margin: 0;
      padding: 40px 20px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #09090b;
      color: #fafafa;
      line-height: 1.5;
    }
    .container {
      max-width: 1040px;
      margin: 0 auto;
    }
    header {
      margin-bottom: 32px;
      border-bottom: 1px solid #27272a;
      padding-bottom: 24px;
    }
    h1 {
      font-size: 28px;
      margin: 0 0 8px 0;
      letter-spacing: -0.02em;
    }
    p.lead {
      color: #a1a1aa;
      margin: 0;
      font-size: 16px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 16px;
      background: #18181b;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #27272a;
    }
    th {
      text-align: left;
      padding: 14px 16px;
      background: #27272a;
      color: #d4d4d8;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .landing-section {
      margin-top: 40px;
      background: #18181b;
      padding: 24px;
      border-radius: 8px;
      border: 1px solid #27272a;
    }
    .landing-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
      margin-top: 16px;
    }
    .card {
      background: #27272a;
      padding: 16px;
      border-radius: 6px;
      border: 1px solid #3f3f46;
    }
    .card h3 {
      margin: 0 0 6px 0;
      font-size: 16px;
    }
    .card p {
      margin: 0 0 12px 0;
      color: #a1a1aa;
      font-size: 14px;
    }
    .card a {
      color: #60a5fa;
      font-size: 13px;
      font-weight: 500;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>✨ Days That Matter — Share Web Preview</h1>
      <p class="lead">Task 3.14 rendered HTML showcase verifying domain models, theme presets, countdown engines, backdrops, and landing pages.</p>
    </header>

    <h2>Public Shared Events (<code>/e/:token</code>)</h2>
    <table>
      <thead>
        <tr>
          <th>Event</th>
          <th>Scenario & Features</th>
          <th>Target</th>
          <th>Unit Mode</th>
          <th>Theme Style</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <div class="landing-section">
      <h2 style="margin-top: 0;">Generic Landing Pages & Error States</h2>
      <p style="color: #a1a1aa; margin: 0 0 16px 0;">Per Design D17: byte-identical responses that leak zero event metadata.</p>
      <div class="landing-grid">
        <div class="card">
          <h3>Generic Invite Page</h3>
          <p>Shown when an invite link is clicked in a browser. Deep links to app.</p>
          <a href="/i/sample_invite_token">Open <code>/i/sample_invite_token</code> ↗</a>
        </div>
        <div class="card">
          <h3>Generic Member Page</h3>
          <p>Shown when a member link is clicked in a browser.</p>
          <a href="/s/sample-wedding">Open <code>/s/sample-wedding</code> ↗</a>
        </div>
        <div class="card">
          <h3>410 Gone (Revoked/Expired)</h3>
          <p>Clean message when an event link has been revoked by owner or expired.</p>
          <a href="/e/expired_token">Open <code>/e/expired_token</code> ↗</a>
        </div>
        <div class="card">
          <h3>404 Not Found</h3>
          <p>Byte-identical error page when a token does not exist.</p>
          <a href="/e/unknown_token">Open <code>/e/unknown_token</code> ↗</a>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  // Public Event Route: /e/:token
  const eventMatch = pathname.match(/^\/e\/([^/]+)$/);
  if (eventMatch) {
    const token = eventMatch[1] ?? '';
    if (token === 'expired_token') {
      res.writeHead(410, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(renderGone());
      return;
    }
    const sample = samples.find((s) => s.shareToken === token);
    if (!sample) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(renderNotFound());
      return;
    }
    const html = renderActive({ shareToken: sample.shareToken, event: sample.event }, Date.now(), {
      origin: `http://${req.headers.host ?? 'localhost:8080'}`,
    });
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  // Invite Landing Route: /i/:token
  if (pathname.startsWith('/i/')) {
    const html = renderInviteLanding({
      origin: `http://${req.headers.host ?? 'localhost:8080'}`,
    });
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  // Member Landing Route: /s/:id
  if (pathname.startsWith('/s/')) {
    const html = renderMemberLanding({
      origin: `http://${req.headers.host ?? 'localhost:8080'}`,
    });
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, HOST, () => {
  console.log(`[Days That Matter] Preview server running at http://${HOST}:${PORT}/`);
});

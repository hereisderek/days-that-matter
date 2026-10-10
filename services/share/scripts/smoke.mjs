// Smoke test against a deployed environment.
// Usage: BASE_URL=https://dtm-share-preview.<account>.workers.dev node scripts/smoke.mjs
const base = (process.env.BASE_URL ?? '').replace(/\/$/, '');
if (!base) {
  console.error('BASE_URL is required');
  process.exit(2);
}
const fail = (m) => {
  console.error(`SMOKE FAIL: ${m}`);
  process.exit(1);
};
const expect = (cond, m) => cond || fail(m);

let r = await fetch(`${base}/api/v1/health`);
expect(r.status === 200, `health status ${r.status}`);
expect((await r.json()).status === 'ok', 'health body');

const payload = {
  v: 1,
  title: 'Smoke test',
  emoji: '\u{1F389}',
  targetDate: '2099-01-01',
  targetTime: '00:00:00',
  timeZone: 'UTC',
  unitMode: 'auto',
  recurrence: { type: 'none', originalYear: null, days: null },
  theme: { paletteId: 'violet', cardStyle: 'glass', typography: 'modern', gradient: ['#8B5CF6', '#3B82F6'] },
};
r = await fetch(`${base}/api/v1/shares`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Install-Id': crypto.randomUUID() },
  body: JSON.stringify({ schemaVersion: 1, payload, expiresInDays: 1 }),
});
expect(r.status === 201, `create status ${r.status} ${await r.clone().text()}`);
const { shareToken, manageToken } = await r.json();

r = await fetch(`${base}/api/v1/shares/${shareToken}`);
expect(r.status === 200, `read status ${r.status}`);
expect((await r.json()).payload?.title === 'Smoke test', 'read payload title');

r = await fetch(`${base}/api/v1/shares/${shareToken}`, { method: 'DELETE', headers: { Authorization: `Bearer ${manageToken}` } });
expect(r.status === 204, `revoke status ${r.status}`);

r = await fetch(`${base}/api/v1/shares/${shareToken}`);
expect(r.status === 410, `read after revoke status ${r.status}`);

for (const p of ['/.well-known/assetlinks.json', '/.well-known/apple-app-site-association']) {
  r = await fetch(`${base}${p}`, { redirect: 'manual' });
  expect(r.status === 200, `${p} status ${r.status}`);
  expect((r.headers.get('content-type') ?? '').includes('application/json'), `${p} content-type ${r.headers.get('content-type')}`);
  JSON.parse(await r.text());
}
console.log('smoke ok');

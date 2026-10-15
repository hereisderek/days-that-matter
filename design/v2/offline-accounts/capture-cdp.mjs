// Captures every state listed in README section 9.10 as light and dark PNGs, with no dependencies.
// It drives a running Chrome through the DevTools protocol, using only Node 22's built-in WebSocket and fetch.
//
//   Start Chrome with a throwaway profile and the prototype open, for example on a Mac:
//     "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9333 \
//        --user-data-dir=/tmp/dtm-cdp --no-first-run http://127.0.0.1:8765/index.html
//   Make that port reachable here (for example ssh -R 9333:127.0.0.1:9333 <this host>), serve design/v2 on
//   PROTOTYPE_URL, then run from anywhere:
//     CDP_URL=http://127.0.0.1:9333 PROTOTYPE_URL=http://127.0.0.1:8765/index.html node capture-cdp.mjs
//
// Output goes next to this file as <number>-<screen>-<state>-<light|dark>.png.
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const CDP = process.env.CDP_URL ?? 'http://127.0.0.1:9333';
const PROTOTYPE = process.env.PROTOTYPE_URL ?? 'http://127.0.0.1:8765/index.html';
const out = path.dirname(fileURLToPath(import.meta.url));

const targets = await (await fetch(`${CDP}/json/list`)).json();
let target = targets.find(t => t.type === 'page' && t.url.startsWith(PROTOTYPE.replace(/index\.html.*$/, ''))) ?? targets.find(t => t.type === 'page');
// With no open tab, open one for the run and close it at the end.
let created = null;
if (!target) { created = await (await fetch(`${CDP}/json/new?${PROTOTYPE}`, { method: 'PUT' })).json(); target = created; }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
let nextId = 0;
const pending = new Map();
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
  }
});
const send = (method, params = {}) => new Promise((res, rej) => {
  const id = ++nextId;
  pending.set(id, { res, rej });
  ws.send(JSON.stringify({ id, method, params }));
});
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ev = async expression => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};

// Helpers that run inside the page. They click like a user would (a real click event on the element).
const HELPERS = `
window.__cap = {
  panel(label, value) {
    const ctl = [...document.querySelectorAll('#panel .pctl')].find(c => c.textContent.includes(label));
    if (!ctl) throw new Error('panel control not found: ' + label);
    const b = [...ctl.querySelectorAll('button')].find(b => b.textContent.trim() === value);
    if (!b) throw new Error('panel button not found: ' + label + ' / ' + value);
    b.click();
  },
  nav(name) {
    const b = [...document.querySelectorAll('#panel .nav button')].find(b => b.textContent.includes(name));
    if (!b) throw new Error('nav button not found: ' + name);
    b.click();
  },
  btn(src, flags) {
    const re = new RegExp(src, flags || '');
    const b = [...document.querySelectorAll('button')].find(b => re.test(b.textContent.trim()));
    if (!b) throw new Error('button not found: /' + src + '/');
    b.click();
  },
  click(sel) {
    const el = document.querySelector(sel);
    if (!el) throw new Error('element not found: ' + sel);
    el.click();
  },
  row(text) {
    const el = [...document.querySelectorAll('#app .cell, #app button')].find(c => c.textContent.includes(text));
    if (!el) throw new Error('row not found: ' + text);
    el.click();
  },
  scrollTop() { const v = document.querySelector('#app .view'); if (v) v.scrollTop = 0; },
  rect() { const r = document.querySelector('#device').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }
};`;

await send('Page.enable');
// A stale cached app.js or styles.css would silently capture the previous design, so never use the cache.
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
// The phone frame is 876 px tall and starts about 384 px down the page, so the viewport must be taller than that.
await send('Emulation.setDeviceMetricsOverride', { width: 1000, height: 1300, deviceScaleFactor: 2, mobile: false });
const failures = [];

for (const theme of ['light', 'dark']) {
  await send('Page.navigate', { url: PROTOTYPE });
  await sleep(1200);
  await ev(HELPERS);
  await ev(`new Promise(r => { const t = setInterval(() => { if (document.querySelector('.screen .view, #app .view')) { clearInterval(t); r(true); } }, 100); })`);

  const panel = (l, v) => ev(`__cap.panel(${JSON.stringify(l)}, ${JSON.stringify(v)})`);
  const nav = n => ev(`__cap.nav(${JSON.stringify(n)})`);
  const btn = (src, flags) => ev(`__cap.btn(${JSON.stringify(src)}, ${JSON.stringify(flags ?? '')})`);
  const row = text => ev(`__cap.row(${JSON.stringify(text)})`);
  const click = sel => ev(`__cap.click(${JSON.stringify(sel)})`);
  const reset = async () => { await btn('^Reset demo$'); await sleep(300); };
  const shot = async name => {
    await sleep(700);
    const clip = await ev('__cap.rect()');
    const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { ...clip, scale: 1 } });
    writeFileSync(path.join(out, `${name}-${theme}.png`), Buffer.from(data, 'base64'));
    console.log('saved', `${name}-${theme}.png`);
  };
  const step = async (name, fn) => { try { await fn(); } catch (e) { failures.push(`${theme} ${name}: ${e.message}`); console.error('FAILED', theme, name, e.message); } };

  await step('theme', () => panel('Theme', theme === 'dark' ? 'Dark' : 'Light'));
  await step('00', async () => { await nav('Welcome'); await shot('00-welcome'); });
  await step('01', async () => { await nav('Device or account'); await shot('01-onboarding-choice'); });
  await step('02', async () => { await panel('Account', 'Local'); await nav('Settings'); await shot('02-settings-local'); });
  await step('02a', async () => { await click('[data-act="edit-name"]'); await shot('02a-settings-local-name-popup'); await btn('^Cancel$'); });
  await step('03', async () => { await nav('Home'); await panel('Time of day', 'Morning'); await shot('03-home-greeting-morning-local'); });
  await step('04', async () => { await panel('Name', 'None'); await panel('Time of day', 'Afternoon'); await shot('04-home-greeting-afternoon-no-name'); });
  await step('05', async () => { await panel('Name', 'Long'); await panel('Time of day', 'Evening'); await shot('05-home-greeting-evening-long-name'); });
  await step('06', async () => { await panel('Name', 'Emoji'); await panel('Time of day', 'Late'); await shot('06-home-greeting-late-emoji-name'); });
  await step('07', async () => { await reset(); await panel('Time of day', 'Evening'); await shot('07-home-greeting-signed-in'); });
  await step('08', async () => { await reset(); await btn('^Show$'); await shot('08-nudge-sheet'); });
  await step('09', async () => { await reset(); await panel('Import choice', 'Not yet'); await shot('09-import-prompt'); });
  await step('10', async () => { await btn('^Import 4 days'); await shot('10-import-confirm'); });
  await step('11', async () => { await btn('^Yes, import'); await sleep(1300); await shot('11-import-success'); });
  await step('12', async () => { await reset(); await shot('12-home-signed-in-after-skip'); });
  await step('13', async () => { await nav('Settings'); await ev('__cap.scrollTop()'); await shot('13-settings-signed-in-import-row'); });
  await step('14', async () => { await btn('^Sign out'); await shot('14-signout-confirm'); });
  await step('15', async () => { await btn('^Sign out$'); await shot('15-home-local-after-signout'); });
  await step('16', async () => {
    await sleep(5000); /* let the sign-out toast of the previous step go away */ await reset(); await panel('Import choice', 'Not yet');
    await btn('^Import 4 days'); await btn('^Yes, import'); await shot('16-import-progress');
  });
  await step('17', async () => {
    await reset(); await panel('Import result', 'Failed'); await panel('Import choice', 'Not yet');
    await btn('^Import 4 days'); await btn('^Yes, import'); await sleep(1300);
    await shot('17-import-failed');
  });
  await step('18', async () => {
    await reset(); await panel('Import result', "Can't import"); await panel('Import choice', 'Not yet');
    await btn('^Import 4 days'); await btn('^Yes, import'); await sleep(1300);
    await shot('18-import-cannot');
  });
  await step('19', async () => { await reset(); await nav('Settings'); await ev('__cap.scrollTop()'); await shot('19-settings-export-import'); });
  await step('20', async () => { await row('Export events'); await shot('20-export-saved'); });
  await step('21', async () => { await reset(); await panel('Widgets', 'Signed out'); await nav('Widgets'); await shot('21-widgets-signed-out'); });
  await step('22', async () => { await panel('Widgets', 'Signed in, not imported'); await shot('22-widgets-not-imported'); });
  await step('23', async () => { await reset(); await panel('Unsynced changes', 'Some, offline'); await nav('Settings'); await btn('^Sign out'); await shot('23-signout-offline-unsynced'); });
  await step('24', async () => { await reset(); await panel('Limits config', 'Spotify limit removed'); await nav('Settings'); await sleep(1200); /* the screen resets its scroll while it renders */ await ev("(() => { const r = [...document.querySelectorAll('#app .view *')].find(e => e.children.length === 0 && /Photo backdrops/.test(e.textContent)); if (!r) return; let c = r.parentElement; while (c && c.scrollHeight <= c.clientHeight + 1) c = c.parentElement; if (c) c.scrollTop += r.getBoundingClientRect().top - c.getBoundingClientRect().top - c.clientHeight / 3; })()"); await shot('24-settings-limit-removed'); });
  await step('25', async () => { await btn('^Upgrade to Premium'); await shot('25-paywall-limit-removed'); });
}

await send('Emulation.clearDeviceMetricsOverride');
ws.close();
if (created) await fetch(`${CDP}/json/close/${created.id}`);
if (failures.length) { console.error('\n' + failures.length + ' step(s) failed:\n' + failures.join('\n')); process.exit(1); }
console.log('done');

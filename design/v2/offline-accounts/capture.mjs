// Captures every state listed in README section 9.10 as light and dark PNGs.
// Run from design/v2 on a host with a browser:  npm i playwright && npx playwright install chromium && node offline-accounts/capture.mjs
// NOT RUN YET: written on a host with no browser, so selectors may need small fixes.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, 'offline-accounts');
const browser = await chromium.launch();

for (const theme of ['light', 'dark']) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 940 }, deviceScaleFactor: 2 });
  await page.goto('file://' + path.join(root, 'index.html'));
  await page.waitForSelector('.screen .view');
  const panel = (label, value) => page.locator('#panel .pctl', { hasText: label }).getByRole('button', { name: value, exact: true }).click();
  const nav = name => page.locator('#panel .nav button', { hasText: name }).first().click();
  const shot = async name => { await page.waitForTimeout(700); await page.locator('#device').screenshot({ path: path.join(out, `${name}-${theme}.png`) }); };
  const reset = async () => { await page.getByRole('button', { name: 'Reset demo' }).click(); await page.waitForTimeout(300); };
  const app = t => page.locator('#app').getByText(t, { exact: false }).first();

  await panel('Theme', theme === 'dark' ? 'Dark' : 'Light');
  await nav('Welcome'); await shot('00-welcome');
  await nav('Device or account'); await shot('01-onboarding-choice');
  await panel('Account', 'Local'); await nav('Settings'); await shot('02-settings-local');
  await nav('Home'); await panel('Time of day', 'Morning'); await shot('03-home-greeting-morning-local');
  await panel('Name', 'None'); await panel('Time of day', 'Afternoon'); await shot('04-home-greeting-afternoon-no-name');
  await panel('Name', 'Long'); await panel('Time of day', 'Evening'); await shot('05-home-greeting-evening-long-name');
  await panel('Name', 'Emoji'); await panel('Time of day', 'Late'); await shot('06-home-greeting-late-emoji-name');
  await reset(); await panel('Time of day', 'Evening'); await shot('07-home-greeting-signed-in');
  await reset(); await page.getByRole('button', { name: 'Show' }).click(); await shot('08-nudge-sheet');
  await reset(); await panel('Import choice', 'Not yet'); await shot('09-import-prompt');
  await page.getByRole('button', { name: /^Import 4 days/ }).click(); await shot('10-import-confirm');
  await page.getByRole('button', { name: /^Yes, import/ }).click(); await shot('11-import-success');
  await reset(); await panel('Import result', 'Partial'); await panel('Import choice', 'Not yet');
  await page.getByRole('button', { name: /^Import 4 days/ }).click(); await page.getByRole('button', { name: /^Yes, import/ }).click(); await shot('12-import-partial');
  await reset(); await shot('13-home-signed-in-after-skip');
  await nav('Settings'); await page.locator('#app .view').evaluate(v => { v.scrollTop = 0; }); await shot('14-settings-signed-in-import-row');
  await page.getByRole('button', { name: /^Sign out/ }).click(); await shot('15-signout-confirm');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click(); await shot('16-home-local-after-signout');
  await page.close();
}
await browser.close();

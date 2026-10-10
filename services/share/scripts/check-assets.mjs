// Static asset checks, run as `npm run check:assets`.
//  1. Design token drift: the :root block of public/assets/share.css must equal the one in design/v1/css/styles.css.
//  2. Well-known files parse as JSON and have the expected shape.
//  3. public/_headers sets Content-Type: application/json for both well-known files.
//  4. Placeholders (store ids, Team ID, fingerprints) are listed. They fail the run only with
//     --production or CHECK_PRODUCTION=1, which the production deploy job sets.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokenDrift } from './lib/tokens.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(root, '../..');
const production = process.argv.includes('--production') || process.env.CHECK_PRODUCTION === '1';
const errors = [];
const read = (p) => readFileSync(p, 'utf8');

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // 1. tokens
  for (const p of tokenDrift(read(resolve(repo, 'design/v1/css/styles.css')), read(resolve(root, 'public/assets/share.css')))) {
    errors.push(`token drift: ${p}`);
  }

  // 2. well-known files
  const wk = resolve(root, 'public/.well-known');
  let assetlinks;
  let aasa;
  try {
    assetlinks = JSON.parse(read(resolve(wk, 'assetlinks.json')));
    aasa = JSON.parse(read(resolve(wk, 'apple-app-site-association')));
  } catch (e) {
    errors.push(`well-known JSON does not parse: ${e.message}`);
  }
  if (assetlinks) {
    const t = assetlinks[0]?.target;
    if (assetlinks[0]?.relation?.[0] !== 'delegate_permission/common.handle_all_urls') errors.push('assetlinks.json: wrong relation');
    if (t?.namespace !== 'android_app' || !t?.package_name || !(t?.sha256_cert_fingerprints?.length >= 1)) {
      errors.push('assetlinks.json: needs android_app target with package_name and sha256_cert_fingerprints');
    }
  }
  if (aasa) {
    const d = aasa.applinks?.details?.[0];
    if (!d?.appIDs?.length || d?.components?.[0]?.['/'] !== '/e/*') errors.push('apple-app-site-association: needs appIDs and the /e/* component');
  }

  // 3. _headers
  const headers = read(resolve(root, 'public/_headers')).replace(/^#.*$/gm, '');
  for (const path of ['/.well-known/apple-app-site-association', '/.well-known/assetlinks.json']) {
    const block = headers.split(/\n\s*\n/).find((b) => b.trim().startsWith(path + '\n') || b.trim() === path);
    if (!block || !/^\s+Content-Type:\s*application\/json\s*$/m.test(block)) errors.push(`_headers: no Content-Type application/json for ${path}`);
  }

  // 4. placeholders
  const found = [];
  const scan = (label, text) => {
    for (const m of new Set(text.match(/[A-Z0-9_]*PLACEHOLDER[A-Z0-9_]*/g) ?? [])) found.push(`${label}: ${m}`);
  };
  scan('assetlinks.json', read(resolve(wk, 'assetlinks.json')));
  scan('apple-app-site-association', read(resolve(wk, 'apple-app-site-association')));
  scan('src/page/og.ts', read(resolve(root, 'src/page/og.ts')));
  if (found.length) {
    const msg = `placeholders remaining (${found.length}):\n  ${found.join('\n  ')}`;
    if (production) errors.push(msg);
    else console.warn(`warning: ${msg}`);
  }

  if (errors.length) {
    console.error(errors.map((e) => `error: ${e}`).join('\n'));
    process.exit(1);
  }
  console.log('check:assets ok');
}

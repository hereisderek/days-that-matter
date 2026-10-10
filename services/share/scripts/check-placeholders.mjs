// Validates the app association files and, with --strict, fails while placeholders remain.
// Also checks that wrangler.jsonc has real D1 database ids when --deploy <env> is given.
// Usage: node scripts/check-placeholders.mjs [--strict] [--deploy preview|production]
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const strict = args.includes('--strict');
const deployEnv = args.includes('--deploy') ? args[args.indexOf('--deploy') + 1] : null;
const errors = [];

const PLACEHOLDER = /TEAMID|BUNDLE_?ID|PACKAGE_?NAME|REPLACE|PLACEHOLDER|TODO|XX:XX|00:00:00:00/i;
for (const f of ['public/.well-known/assetlinks.json', 'public/.well-known/apple-app-site-association']) {
  const p = join(root, f);
  if (!existsSync(p)) {
    errors.push(`${f}: missing`);
    continue;
  }
  const text = readFileSync(p, 'utf8');
  try {
    JSON.parse(text);
  } catch (e) {
    errors.push(`${f}: invalid JSON (${e.message})`);
    continue;
  }
  if (strict && PLACEHOLDER.test(text)) errors.push(`${f}: still contains a placeholder`);
}

if (deployEnv) {
  const stripped = readFileSync(join(root, 'wrangler.jsonc'), 'utf8')
    .split('\n')
    .map((l) => l.replace(/^\s*\/\/.*$/, ''))
    .join('\n');
  const cfg = JSON.parse(stripped);
  const dbs = cfg.env?.[deployEnv]?.d1_databases ?? [];
  if (dbs.length === 0) errors.push(`wrangler.jsonc: env.${deployEnv} has no d1_databases`);
  for (const d of dbs) {
    if (/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(d.database_id)) errors.push(`wrangler.jsonc: env.${deployEnv} D1 database_id is still the placeholder`);
  }
}

if (errors.length) {
  console.error(errors.map((e) => `FAIL ${e}`).join('\n'));
  process.exit(1);
}
console.log(`check-placeholders ok${strict ? ' (strict)' : ''}${deployEnv ? ` (deploy ${deployEnv})` : ''}`);

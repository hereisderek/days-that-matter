// Pure helpers for the design token drift check (shared by scripts/check-assets.mjs and the tests).
/** Custom properties of the first top-level `:root { ... }` block. */
export function rootTokens(css) {
  const start = css.indexOf(':root {');
  if (start < 0) return null;
  const end = css.indexOf('\n}', start);
  const body = css.slice(start + 7, end);
  const out = new Map();
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out.set(m[1], m[2].replace(/\s+/g, ' ').trim());
  return out;
}

export function tokenDrift(designCss, shareCss) {
  const a = rootTokens(designCss);
  const b = rootTokens(shareCss);
  if (!a) return ['design source has no :root block'];
  if (!b) return ['share.css has no :root block'];
  const problems = [];
  for (const [k, v] of a) {
    if (!b.has(k)) problems.push(`share.css is missing ${k}`);
    else if (b.get(k) !== v) problems.push(`${k} differs: design "${v}", share.css "${b.get(k)}"`);
  }
  for (const k of b.keys()) if (!a.has(k)) problems.push(`share.css has ${k}, which is not in the design source`);
  return problems;
}

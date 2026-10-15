// Verification of OpenID Connect ID tokens (Google, Apple): RS256 signature against the provider's
// JWKS, then `iss`, `aud`, `exp` and the nonce (BACKEND.md section 8). Returns the claims or null;
// the reason is never shown to the client, which gets one `401 unauthorized` for every failure.
import { fromBase64Url } from './crypto.ts';
import type { Jwk, KeyFetcher } from './keys.ts';

export type Claims = Readonly<Record<string, unknown>>;

export interface IdTokenRules {
  readonly jwksUrl: string;
  readonly issuers: readonly string[];
  readonly audiences: readonly string[];
  /** The `nonce` claim the token must carry. */
  readonly nonce: string;
  readonly nowMs: number;
}

/** Clock skew allowed on `exp` and `iat`. */
const LEEWAY_SECONDS = 60;
const MAX_TOKEN_CHARS = 8192;

const decoder = new TextDecoder('utf-8', { fatal: true });

function json(part: string): Record<string, unknown> | null {
  const bytes = fromBase64Url(part);
  if (bytes === null) return null;
  try {
    const value: unknown = JSON.parse(decoder.decode(bytes));
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function verifyIdToken(token: string, keys: KeyFetcher, rules: IdTokenRules): Promise<Claims | null> {
  if (token.length > MAX_TOKEN_CHARS) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts as [string, string, string];
  const header = json(h);
  const claims = json(p);
  const signature = fromBase64Url(s);
  if (!header || !claims || !signature || header['alg'] !== 'RS256' || typeof header['kid'] !== 'string') return null;

  const key = await findKey(keys, rules.jwksUrl, header['kid']);
  if (!key) return null;
  let valid: boolean;
  try {
    const cryptoKey = await crypto.subtle.importKey(
      'jwk', { kty: key.kty, n: key.n as string, e: key.e as string, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'],
    );
    valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signature, new TextEncoder().encode(`${h}.${p}`));
  } catch {
    return null;
  }
  if (!valid) return null;

  const now = Math.floor(rules.nowMs / 1000);
  const aud = claims['aud'];
  const audiences = typeof aud === 'string' ? [aud] : Array.isArray(aud) ? aud : [];
  if (typeof claims['iss'] !== 'string' || !rules.issuers.includes(claims['iss'])) return null;
  if (!audiences.some((a) => typeof a === 'string' && rules.audiences.includes(a))) return null;
  if (typeof claims['exp'] !== 'number' || claims['exp'] + LEEWAY_SECONDS <= now) return null;
  if (typeof claims['iat'] === 'number' && claims['iat'] - LEEWAY_SECONDS > now) return null;
  if (typeof claims['sub'] !== 'string' || claims['sub'] === '') return null;
  if (claims['nonce'] !== rules.nonce) return null;
  return claims;
}

async function findKey(keys: KeyFetcher, url: string, kid: string): Promise<Jwk | null> {
  const pick = (set: readonly Jwk[]): Jwk | null =>
    set.find((k) => k.kid === kid && k.kty === 'RSA' && typeof k.n === 'string' && typeof k.e === 'string' && (k.use === undefined || k.use === 'sig')) ?? null;
  return pick(await keys.keys(url, false)) ?? pick(await keys.keys(url, true));
}

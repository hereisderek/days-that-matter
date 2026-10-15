// Signing keys of the identity providers (JWKS), fetched by the core and cached per instance
// (BACKEND.md section 8). Tests inject a fake fetcher with locally generated keys.
import type { Clock } from '../ports/clock.ts';

/** One public key of a JWKS document, as the provider publishes it. */
export interface Jwk {
  readonly kty: string;
  readonly kid?: string;
  readonly alg?: string;
  readonly use?: string;
  readonly n?: string;
  readonly e?: string;
}

/** Fetches a provider's keys. `refresh` asks for a fresh copy (a token named a key the cached set lacks). */
export interface KeyFetcher {
  keys(jwksUrl: string, refresh: boolean): Promise<readonly Jwk[]>;
}

export type FetchFn = (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

const CACHE_MS = 3_600_000;
const MIN_REFRESH_MS = 60_000;

/**
 * Keys over HTTP, cached for an hour per URL. A refresh refetches at most once a minute, so tokens
 * with made-up key ids cannot turn into one provider request each.
 */
export function cachedKeyFetcher(fetchFn: FetchFn, clock: Clock): KeyFetcher {
  const cache = new Map<string, { keys: readonly Jwk[]; at: number }>();
  return {
    async keys(url, refresh) {
      const now = clock.nowMs();
      const hit = cache.get(url);
      if (hit && now - hit.at < (refresh ? MIN_REFRESH_MS : CACHE_MS)) return hit.keys;
      const res = await fetchFn(url);
      if (!res.ok) throw new Error('key fetch failed');
      const body = (await res.json()) as { keys?: unknown };
      const keys = Array.isArray(body.keys) ? (body.keys as Jwk[]) : [];
      cache.set(url, { keys, at: now });
      return keys;
    },
  };
}

/** A fetcher with fixed keys per URL, for tests and offline development. */
export function staticKeyFetcher(keysByUrl: Readonly<Record<string, readonly Jwk[]>>): KeyFetcher {
  return { keys: async (url) => keysByUrl[url] ?? [] };
}

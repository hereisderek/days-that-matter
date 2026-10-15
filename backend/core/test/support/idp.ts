// Local stand-ins for Google and Apple sign-in: RSA keys generated per test run, JWKS served by a fake
// key fetcher, and ID tokens signed with them. No network.
import { APPLE_ISSUERS, APPLE_JWKS, GOOGLE_ISSUERS, GOOGLE_JWKS } from '../../src/auth/providers.ts';
import type { Jwk, KeyFetcher } from '../../src/auth/keys.ts';
import { sha256Hex } from '../../src/auth/crypto.ts';
import { base64Url } from '../../src/ports/random.ts';

export interface TokenOptions {
  readonly sub: string;
  readonly nonce: string;
  readonly email?: string;
  readonly emailVerified?: boolean | 'true' | 'false';
  readonly name?: string;
  readonly aud?: string | string[];
  readonly iss?: string;
  /** Seconds from `nowMs`; default one hour. */
  readonly expiresIn?: number;
  readonly kid?: string;
  /** Sign with a key the JWKS does not list. */
  readonly foreignKey?: boolean;
}

import { webcrypto } from 'node:crypto';

interface Signer {
  readonly kid: string;
  readonly key: webcrypto.CryptoKey;
}

const ALG = { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' } as const;

async function signer(kid: string): Promise<{ signer: Signer; jwk: Jwk }> {
  const pair = await crypto.subtle.generateKey(ALG, true, ['sign', 'verify']);
  const pub = await crypto.subtle.exportKey('jwk', pair.publicKey);
  return { signer: { kid, key: pair.privateKey }, jwk: { kty: 'RSA', kid, alg: 'RS256', use: 'sig', n: pub.n as string, e: pub.e as string } };
}

const text = (value: unknown): string => base64Url(new TextEncoder().encode(JSON.stringify(value)));

export class TestIdp {
  /** How often each JWKS URL was fetched, refreshes included. */
  readonly fetches: string[] = [];

  readonly #google: Signer;
  readonly #apple: Signer;
  readonly #foreign: Signer;
  readonly #jwks: Record<string, Jwk[]>;
  readonly #nowMs: () => number;

  private constructor(google: Signer, apple: Signer, foreign: Signer, jwks: Record<string, Jwk[]>, nowMs: () => number) {
    this.#google = google;
    this.#apple = apple;
    this.#foreign = foreign;
    this.#jwks = jwks;
    this.#nowMs = nowMs;
  }

  static async create(nowMs: () => number): Promise<TestIdp> {
    const [g, a, f] = await Promise.all([signer('g-key-1'), signer('a-key-1'), signer('g-key-1')]);
    return new TestIdp(g.signer, a.signer, f.signer, { [GOOGLE_JWKS]: [g.jwk], [APPLE_JWKS]: [a.jwk] }, nowMs);
  }

  readonly keys: KeyFetcher = {
    keys: async (url) => {
      this.fetches.push(url);
      return this.#jwks[url] ?? [];
    },
  };

  /** A Google ID token for the test config's client id. */
  googleToken(o: TokenOptions): Promise<string> {
    return this.sign(o.foreignKey ? this.#foreign : this.#google, { iss: GOOGLE_ISSUERS[0], aud: 'google-client.test', ...o, nonceClaim: o.nonce });
  }

  /** An Apple ID token: its nonce claim is the SHA-256 of the app's nonce. */
  async appleToken(o: TokenOptions): Promise<string> {
    return this.sign(this.#apple, { iss: APPLE_ISSUERS[0], aud: 'app.test.ios', ...o, nonceClaim: await sha256Hex(o.nonce) });
  }

  private async sign(s: Signer, o: TokenOptions & { iss: string; aud: string | string[]; nonceClaim: string }): Promise<string> {
    const now = Math.floor(this.#nowMs() / 1000);
    const claims: Record<string, unknown> = {
      iss: o.iss, aud: o.aud, sub: o.sub, iat: now, exp: now + (o.expiresIn ?? 3600), nonce: o.nonceClaim,
    };
    if (o.email !== undefined) claims['email'] = o.email;
    if (o.emailVerified !== undefined) claims['email_verified'] = o.emailVerified;
    if (o.name !== undefined) claims['name'] = o.name;
    const head = text({ alg: 'RS256', kid: o.kid ?? s.kid, typ: 'JWT' });
    const body = text(claims);
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', s.key, new TextEncoder().encode(`${head}.${body}`));
    return `${head}.${body}.${base64Url(new Uint8Array(sig))}`;
  }
}

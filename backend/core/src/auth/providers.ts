// Sign-in methods as plug-ins (design D4, BACKEND.md sections 4 and 8). Each verifies a credential and
// returns the identity it proves; the deployment config lists the enabled ones. WeChat or phone codes
// would be added the same way.
import type { SignInMethod } from '../contract/index.ts';
import { LIMITS } from '../contract/index.ts';
import type { Clock } from '../ports/clock.ts';
import type { Config } from '../ports/config.ts';
import type { Mailer } from '../ports/mailer.ts';
import type { Random } from '../ports/random.ts';
import type { IdentityInput, Store } from '../ports/store.ts';
import { constantTimeEqual, hmacSha256Hex, sha256Hex } from './crypto.ts';
import { verifyIdToken } from './jwt.ts';
import type { Claims } from './jwt.ts';
import type { KeyFetcher } from './keys.ts';

/** A verified identity plus the name the provider gave, for the default display name. */
export interface VerifiedIdentity extends IdentityInput {
  readonly name: string | null;
}

/** An ID token sign-in method (`POST /auth/token`). */
export interface TokenProvider {
  readonly id: SignInMethod;
  /** The identity the token proves, or null when it does not verify. */
  verify(idToken: string, nonce: string, nowMs: number): Promise<VerifiedIdentity | null>;
}

export const GOOGLE_JWKS = 'https://www.googleapis.com/oauth2/v3/certs';
export const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'] as const;
export const APPLE_JWKS = 'https://appleid.apple.com/auth/keys';
export const APPLE_ISSUERS = ['https://appleid.apple.com'] as const;

/** Sign in with Google: the token's `nonce` claim is the app's nonce as sent. */
export function googleProvider(audiences: readonly string[], keys: KeyFetcher): TokenProvider {
  return {
    id: 'google',
    async verify(idToken, nonce, nowMs) {
      const claims = await verifyIdToken(idToken, keys, { jwksUrl: GOOGLE_JWKS, issuers: GOOGLE_ISSUERS, audiences, nonce, nowMs });
      return claims ? identity('google', claims) : null;
    },
  };
}

/**
 * Sign in with Apple: the app gives Apple the SHA-256 (hex) of its nonce, so the token's `nonce` claim
 * is that hash. The same rule holds for iOS and for the Android web flow.
 */
export function appleProvider(audiences: readonly string[], keys: KeyFetcher): TokenProvider {
  return {
    id: 'apple',
    async verify(idToken, nonce, nowMs) {
      const hashed = await sha256Hex(nonce);
      const claims = await verifyIdToken(idToken, keys, { jwksUrl: APPLE_JWKS, issuers: APPLE_ISSUERS, audiences, nonce: hashed, nowMs });
      return claims ? identity('apple', claims) : null;
    },
  };
}

function identity(provider: SignInMethod, claims: Claims): VerifiedIdentity {
  const email = typeof claims['email'] === 'string' ? normalizeEmail(claims['email']) : null;
  const verified = claims['email_verified'] === true || claims['email_verified'] === 'true';
  return {
    provider,
    subject: claims['sub'] as string,
    email,
    emailVerified: email !== null && verified,
    name: typeof claims['name'] === 'string' ? claims['name'] : null,
  };
}

/** The token providers this deployment enables. */
export function tokenProviders(config: Config, keys: KeyFetcher): Map<SignInMethod, TokenProvider> {
  const out = new Map<SignInMethod, TokenProvider>();
  if (config.signIn.includes('google')) out.set('google', googleProvider(config.googleClientIds, keys));
  if (config.signIn.includes('apple')) out.set('apple', appleProvider(config.appleClientIds, keys));
  return out;
}

// ---- Email codes ----

export const EMAIL_CODE_TTL_SECONDS = 600;
export const EMAIL_CODE_ATTEMPTS = 5;
const MAX_EMAIL_CHARS = 254;
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/** Trimmed and lower-cased; null when it is not an email address. */
export function normalizeEmail(text: string): string | null {
  const email = text.trim().toLowerCase();
  if (email.length > MAX_EMAIL_CHARS || !EMAIL.test(email)) return null;
  for (const ch of email) {
    const cp = ch.codePointAt(0) as number;
    if (cp <= 0x1f || (cp >= 0x7f && cp <= 0x9f)) return null;
  }
  return email;
}

/** A uniform 6-digit code from the CSPRNG (rejection sampling, no modulo bias). */
export function sixDigitCode(random: Random): string {
  const limit = Math.floor(0x1_0000_0000 / 1_000_000) * 1_000_000;
  for (;;) {
    const b = random.bytes(4);
    const n = (((b[0] as number) << 24) | ((b[1] as number) << 16) | ((b[2] as number) << 8) | (b[3] as number)) >>> 0;
    if (n < limit) return String(n % 1_000_000).padStart(6, '0');
  }
}

export interface EmailCodeDeps {
  readonly store: Store;
  readonly mailer: Mailer;
  readonly random: Random;
  readonly clock: Clock;
  readonly codeKey: string;
}

/** Sends a new code to `email` (normalized), replacing an earlier one. The email holds the code and the app name only. */
export async function sendEmailCode(deps: EmailCodeDeps, email: string): Promise<void> {
  const code = sixDigitCode(deps.random);
  const now = Math.floor(deps.clock.nowMs() / 1000);
  await deps.store.putEmailCode({
    emailHash: await sha256Hex(email),
    codeMac: await hmacSha256Hex(deps.codeKey, email + code),
    expiresAt: now + EMAIL_CODE_TTL_SECONDS,
  });
  await deps.mailer.send({
    to: email,
    subject: 'Your Days That Matter sign-in code',
    text: `Your Days That Matter sign-in code is ${code}. It works for 10 minutes.`,
  });
}

/**
 * Checks a code for `email` (normalized). Every try counts against the 5 attempts before it is
 * compared; a right code works once. Returns the email identity, or null.
 */
export async function verifyEmailCode(deps: EmailCodeDeps, email: string, code: string): Promise<VerifiedIdentity | null> {
  if (!/^\d{6}$/.test(code)) return null;
  const emailHash = await sha256Hex(email);
  const now = Math.floor(deps.clock.nowMs() / 1000);
  const stored = await deps.store.takeEmailCodeAttempt(emailHash, now, EMAIL_CODE_ATTEMPTS);
  if (stored === null) return null;
  const mac = await hmacSha256Hex(deps.codeKey, email + code);
  if (!constantTimeEqual(mac, stored)) return null;
  if (!(await deps.store.consumeEmailCode(emailHash, mac))) return null;
  return { provider: 'email', subject: email, email, emailVerified: true, name: null };
}

/**
 * The display name of a new account: the provider's name, else the part of the email before `@`,
 * else "Me". Cut to the title limit and stripped of characters no text field may hold.
 */
export function defaultDisplayName(identity: VerifiedIdentity): string {
  const raw = identity.name?.trim() || identity.email?.split('@')[0] || '';
  let out = '';
  let n = 0;
  for (const ch of raw.normalize('NFC')) {
    const cp = ch.codePointAt(0) as number;
    if (cp <= 0x1f || (cp >= 0x7f && cp <= 0x9f) || (cp >= 0x2028 && cp <= 0x202e) || (cp >= 0x2066 && cp <= 0x2069)) continue;
    if (n++ >= LIMITS.TITLE_MAX_CHARS) break;
    out += ch;
  }
  return out.trim() || 'Me';
}

// Bearer sessions of the app (BACKEND.md section 8): `st_` + 43 characters base64url (256 bits),
// stored as SHA-256, valid until 90 days after last use. The web has no sessions (design D17).
import { ApiError } from '../http/errors.ts';
import type { CoreRequest } from '../http/types.ts';
import { nowSeconds } from '../ports/clock.ts';
import type { Ports } from '../ports/index.ts';
import { base64Url } from '../ports/random.ts';
import type { Random } from '../ports/random.ts';
import { DAY_SECONDS } from '../store/records.ts';
import { sha256Hex } from './crypto.ts';

export const SESSION_LIFETIME_SECONDS = 90 * DAY_SECONDS;
const BEARER = /^Bearer (st_[A-Za-z0-9_-]{43})$/;

export interface Session {
  readonly accountId: string;
  readonly tokenHash: string;
  /** When the session started (unix seconds). */
  readonly createdAt: number;
}

export const unauthorized = (): ApiError => new ApiError('unauthorized', 'Sign in required');

export function newSessionToken(random: Random): string {
  return `st_${base64Url(random.bytes(32))}`;
}

/** Starts a session for an account and records the sign-in as signed-in use. Returns the token. */
export async function startSession(ports: Ports, accountId: string): Promise<string> {
  const token = newSessionToken(ports.random);
  const tokenHash = await sha256Hex(token);
  const now = nowSeconds(ports.clock);
  await ports.store.createSession({ tokenHash, accountId, createdAt: now, lastUsedAt: now });
  await ports.store.markActive(tokenHash, accountId, now);
  return token;
}

/**
 * The session of a request, or `401 unauthorized`. The token format is checked before any store
 * access; an expired session is deleted. Use is recorded at most once a day per session.
 */
export async function authenticate(ports: Ports, req: CoreRequest): Promise<Session> {
  const m = BEARER.exec(req.headers.get('Authorization') ?? '');
  if (!m) throw unauthorized();
  const tokenHash = await sha256Hex(m[1] as string);
  const session = await ports.store.getSession(tokenHash);
  if (!session) throw unauthorized();
  const now = nowSeconds(ports.clock);
  if (now - session.lastUsedAt > SESSION_LIFETIME_SECONDS) {
    await ports.store.deleteSession(tokenHash);
    throw unauthorized();
  }
  if (now - session.lastUsedAt >= DAY_SECONDS) await ports.store.markActive(tokenHash, session.accountId, now);
  return { accountId: session.accountId, tokenHash, createdAt: session.createdAt };
}

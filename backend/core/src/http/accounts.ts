// Accounts (task 3.5, BACKEND.md sections 7.3 and 8): configuration, sign-in with Google, Apple and
// email codes, the Apple callback for Android, sessions, and the account itself.
import { authenticate, startSession } from '../auth/session.ts';
import {
  defaultDisplayName,
  normalizeEmail,
  sendEmailCode,
  tokenProviders,
  verifyEmailCode,
} from '../auth/providers.ts';
import type { EmailCodeDeps, VerifiedIdentity } from '../auth/providers.ts';
import type { ConfigResponse, IdentityInfo, Me, SignInMethod, SignInResponse } from '../contract/index.ts';
import { LIMITS } from '../contract/index.ts';
import { nowSeconds } from '../ports/clock.ts';
import type { Ports } from '../ports/index.ts';
import type { AccountRecord } from '../ports/store.ts';
import type { JsonObject } from '../rules/merge.ts';
import { effectivePlan, limitsByFeature, usageByFeature } from '../rules/plan.ts';
import { isoSeconds, validateMePatch } from '../rules/validation.ts';
import type { Handler } from './app.ts';
import { readBody, readJsonObject } from './body.ts';
import { ApiError, invalidPayload, notFound, serviceUnavailable, unsupportedMediaType } from './errors.ts';
import { onlyFields, requiredString, valid } from './input.ts';
import type { Route } from './router.ts';
import { emptyResponse, jsonResponse } from './types.ts';
import { API } from './paths.ts';
import { mediaKey } from './media-keys.ts';

const NO_STORE = { 'Cache-Control': 'no-store' };
const MAX_ID_TOKEN = 8192;
const MAX_NONCE = 256;

export const invalidCode = (): ApiError => new ApiError('invalid_code', 'Code wrong, expired or used up');

function emailDeps(ports: Ports): EmailCodeDeps {
  return { store: ports.store, mailer: ports.mailer, random: ports.random, clock: ports.clock, codeKey: ports.config.secrets.emailCodeKey };
}

/** The body of `GET /me` and the account in a sign-in answer. */
export async function meBody(ports: Ports, account: AccountRecord): Promise<Me> {
  const now = nowSeconds(ports.clock);
  const plan = effectivePlan(account, now);
  const [identities, usage] = await Promise.all([ports.store.listIdentities(account.id), ports.store.usage(account.id)]);
  return {
    id: account.id,
    displayName: account.displayName,
    plan,
    planExpiresAt: plan === 'free' || account.planExpiresAt === null ? null : isoSeconds(account.planExpiresAt),
    identities: identities.map((i): IdentityInfo => ({ provider: i.provider, email: i.email })),
    usage: usageByFeature(usage),
    limits: limitsByFeature(plan),
    createdAt: isoSeconds(account.createdAt),
  };
}

/** Verifies `{provider, idToken, nonce}` with an enabled token provider; `401` when the token does not verify. */
async function verifyToken(ports: Ports, body: JsonObject): Promise<VerifiedIdentity> {
  const provider = body['provider'];
  const providers = tokenProviders(ports.config, ports.keys);
  if (typeof provider !== 'string' || !providers.has(provider as SignInMethod)) throw invalidPayload('provider', 'unsupported value');
  const idToken = requiredString(body, 'idToken', MAX_ID_TOKEN);
  const nonce = requiredString(body, 'nonce', MAX_NONCE);
  const identity = await providers.get(provider as SignInMethod)?.verify(idToken, nonce, ports.clock.nowMs());
  if (!identity) throw new ApiError('unauthorized', 'Sign-in could not be verified');
  return identity;
}

/** Verifies `{email, code}`; `400 invalid_code` when the code is wrong, expired or out of attempts. */
async function verifyCode(ports: Ports, body: JsonObject): Promise<VerifiedIdentity> {
  if (!ports.config.signIn.includes('email')) throw notFound();
  const email = normalizeEmail(requiredString(body, 'email', 320));
  if (email === null) throw invalidPayload('email', 'invalid email address');
  const code = requiredString(body, 'code', 16);
  const identity = await verifyEmailCode(emailDeps(ports), email, code);
  if (!identity) throw invalidCode();
  return identity;
}

async function signIn(ports: Ports, identity: VerifiedIdentity) {
  const now = nowSeconds(ports.clock);
  const outcome = await ports.store.signIn({
    identity: { provider: identity.provider, subject: identity.subject, email: identity.email, emailVerified: identity.emailVerified },
    newAccount: { id: ports.random.uuid(), displayName: defaultDisplayName(identity), now },
  });
  const session = await startSession(ports, outcome.account.id);
  const body: SignInResponse = { session, account: await meBody(ports, outcome.account), created: outcome.status === 'created' };
  return jsonResponse(200, body, NO_STORE);
}

async function currentAccount(ports: Ports, accountId: string): Promise<AccountRecord> {
  const account = await ports.store.getAccount(accountId);
  if (!account) throw new ApiError('unauthorized', 'Sign in required');
  return account;
}

const config: Handler = ({ ports }) => {
  const c = ports.config;
  const body: ConfigResponse = {
    region: c.region,
    live: c.live,
    signIn: [...c.signIn],
    stores: [...c.stores],
    features: { spotify: c.features.spotify },
    ui: { memoBadge: c.ui.memoBadge },
  };
  return jsonResponse(200, body, { 'Cache-Control': 'public, max-age=300' });
};

const tokenSignIn: Handler = async ({ ports, req }) => {
  const body = await readJsonObject(req);
  onlyFields(body, ['provider', 'idToken', 'nonce']);
  return signIn(ports, await verifyToken(ports, body));
};

const emailStart: Handler = async ({ ports, req }) => {
  if (!ports.config.signIn.includes('email')) throw notFound();
  const body = await readJsonObject(req);
  onlyFields(body, ['email']);
  const email = normalizeEmail(requiredString(body, 'email', 320));
  if (email === null) throw invalidPayload('email', 'invalid email address');
  // The same answer whether or not the address has an account. A refusing mail provider is a
  // provider limit: 503, so the app offers to try again.
  try {
    await sendEmailCode(emailDeps(ports), email);
  } catch {
    throw serviceUnavailable();
  }
  return emptyResponse(202, NO_STORE);
};

const emailVerify: Handler = async ({ ports, req }) => {
  const body = await readJsonObject(req);
  onlyFields(body, ['email', 'code']);
  return signIn(ports, await verifyCode(ports, body));
};

const signOut: Handler = async ({ ports, req }) => {
  const session = await authenticate(ports, req);
  await ports.store.deleteSession(session.tokenHash);
  return emptyResponse(204, NO_STORE);
};

const getMe: Handler = async ({ ports, req }) => {
  const session = await authenticate(ports, req);
  return jsonResponse(200, await meBody(ports, await currentAccount(ports, session.accountId)), NO_STORE);
};

const patchMe: Handler = async ({ ports, req }) => {
  const session = await authenticate(ports, req);
  const patch = valid(validateMePatch(await readJsonObject(req)));
  const account = await ports.store.updateDisplayName(session.accountId, patch['displayName'] as string);
  if (!account) throw new ApiError('unauthorized', 'Sign in required');
  return jsonResponse(200, await meBody(ports, account), NO_STORE);
};

const deleteMe: Handler = async ({ ports, req }) => {
  const session = await authenticate(ports, req);
  const deleted = await ports.store.deleteAccount(session.accountId, nowSeconds(ports.clock));
  if (!deleted) throw new ApiError('unauthorized', 'Sign in required');
  await ports.blobs.delete(deleted.media.map(mediaKey));
  // Members of the owned events lose them; their open screens refetch.
  for (const eventId of deleted.ownedEventIds) await ports.live.publish(eventId, { type: 'access' });
  return emptyResponse(204, NO_STORE);
};

const addIdentity: Handler = async ({ ports, req }) => {
  const session = await authenticate(ports, req);
  const body = await readJsonObject(req);
  let identity: VerifiedIdentity;
  if ('provider' in body) {
    onlyFields(body, ['provider', 'idToken', 'nonce']);
    identity = await verifyToken(ports, body);
  } else {
    onlyFields(body, ['email', 'code']);
    identity = await verifyCode(ports, body);
  }
  const outcome = await ports.store.addIdentity({
    accountId: session.accountId,
    identity: { provider: identity.provider, subject: identity.subject, email: identity.email, emailVerified: identity.emailVerified },
    now: nowSeconds(ports.clock),
  });
  if (outcome === 'conflict') throw new ApiError('conflict', 'This sign-in method belongs to another account');
  return jsonResponse(200, await meBody(ports, await currentAccount(ports, session.accountId)), NO_STORE);
};

/** Fields of Apple's form post that the app needs; anything else is dropped. */
const APPLE_FIELDS = ['code', 'id_token', 'state', 'user', 'error'] as const;

/**
 * Sign in with Apple on Android (design D4 and D17): Apple posts the result here; the core stores
 * nothing and redirects to the app, which checks `state` and signs in with `POST /auth/token`.
 * No cookie, no browser session.
 */
const appleCallback: Handler = async ({ ports, req }) => {
  const type = req.headers.get('Content-Type') ?? '';
  if (!/^application\/x-www-form-urlencoded\s*(;|$)/i.test(type)) throw unsupportedMediaType();
  const bytes = await readBody(req, LIMITS.JSON_BODY_MAX_BYTES);
  const form = new URLSearchParams(new TextDecoder().decode(bytes));
  const out = new URLSearchParams();
  for (const name of APPLE_FIELDS) {
    const value = form.get(name);
    if (value !== null) out.set(name, value);
  }
  const location = `intent://auth/apple?${out.toString()}#Intent;scheme=${ports.config.appScheme};end`;
  return emptyResponse(303, { Location: location, 'Cache-Control': 'no-store' });
};

export const accountRoutes: readonly Route<Handler>[] = [
  { method: 'GET', pattern: `${API}/config`, handler: config },
  { method: 'POST', pattern: `${API}/auth/token`, handler: tokenSignIn },
  { method: 'POST', pattern: `${API}/auth/email/start`, handler: emailStart },
  { method: 'POST', pattern: `${API}/auth/email/verify`, handler: emailVerify },
  { method: 'POST', pattern: `${API}/auth/signout`, handler: signOut },
  { method: 'GET', pattern: `${API}/me`, handler: getMe },
  { method: 'PATCH', pattern: `${API}/me`, handler: patchMe },
  { method: 'DELETE', pattern: `${API}/me`, handler: deleteMe },
  { method: 'POST', pattern: `${API}/me/identities`, handler: addIdentity },
  { method: 'POST', pattern: '/auth/apple/callback', handler: appleCallback },
];

// Deployment configuration (BACKEND.md sections 4, 11 and 16). A variant reads its environment and
// passes it to loadConfig; the core refuses to start without the secrets it needs.
import type { LiveMode, MemoBadgePosition, PurchaseStore, SignInMethod } from '../contract/index.ts';

export interface Secrets {
  /** Salt of the per-IP rate counter keys. */
  readonly rateSalt: string;
  /** HMAC key of email sign-in codes. */
  readonly emailCodeKey: string;
  /** AES-GCM key material for invite tokens. */
  readonly inviteKey: string;
  /** Operator token; null means the operator routes answer 401 to everyone. */
  readonly adminToken: string | null;
}

export interface Config {
  readonly region: string;
  /** `https://<domain>`, without a trailing slash. */
  readonly origin: string;
  /** Origin of backdrop files, `https://media.<domain>` on Cloudflare; the origin itself on self-host. */
  readonly mediaOrigin: string;
  readonly version: string;
  readonly live: LiveMode;
  readonly signIn: readonly SignInMethod[];
  readonly stores: readonly PurchaseStore[];
  readonly features: { readonly spotify: boolean };
  readonly ui: { readonly memoBadge: MemoBadgePosition };
  /** Accepted `aud` values of Google ID tokens (the app's OAuth client ids); required when Google sign-in is on. */
  readonly googleClientIds: readonly string[];
  /** Accepted `aud` values of Apple ID tokens (bundle id, Services ID); required when Apple sign-in is on. */
  readonly appleClientIds: readonly string[];
  /** URL scheme of the app that `POST /auth/apple/callback` redirects to (`daysthatmatter` by default). */
  readonly appScheme: string;
  /** Writes answer 503 while true. */
  readonly maintenance: boolean;
  /** The inactive account steps of the daily job run while true. */
  readonly inactiveJob: boolean;
  readonly secrets: Secrets;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export type Env = Readonly<Record<string, string | undefined>>;

const SIGN_IN: readonly SignInMethod[] = ['apple', 'google', 'email'];
const STORES: readonly PurchaseStore[] = ['apple', 'google'];

/**
 * Reads the configuration from environment variables: `ORIGIN` (required), `MEDIA_ORIGIN`, `REGION`
 * (default `global`), `VERSION`, `LIVE_MODE` (`ws` or `poll`, required), `SIGN_IN` and `STORES`
 * (comma lists), `FEATURE_SPOTIFY` (`1`), `UI_MEMO_BADGE` (`top-left` or `top-right`),
 * `MAINTENANCE` (`1`), `INACTIVE_JOB` (`0` pauses), `GOOGLE_CLIENT_IDS` and `APPLE_CLIENT_IDS` (comma
 * lists, required when that sign-in method is on), `APP_SCHEME` (default `daysthatmatter`) and the
 * secrets `RATE_SALT`, `EMAIL_CODE_KEY`, `INVITE_KEY` (required) and `ADMIN_TOKEN` (optional, at least
 * 32 characters). Messages name the variable, never its value.
 */
export function loadConfig(env: Env): Config {
  const origin = httpsOrigin(env, 'ORIGIN', true) as string;
  const live = env['LIVE_MODE'];
  if (live !== 'ws' && live !== 'poll') throw new ConfigError('LIVE_MODE must be ws or poll');
  const badge = env['UI_MEMO_BADGE'] ?? 'top-right';
  if (badge !== 'top-left' && badge !== 'top-right') throw new ConfigError('UI_MEMO_BADGE must be top-left or top-right');
  const adminToken = optional(env, 'ADMIN_TOKEN');
  const signIn = list(env, 'SIGN_IN', SIGN_IN);
  const googleClientIds = clientIds(env, 'GOOGLE_CLIENT_IDS', signIn.includes('google'));
  const appleClientIds = clientIds(env, 'APPLE_CLIENT_IDS', signIn.includes('apple'));
  const appScheme = optional(env, 'APP_SCHEME') ?? 'daysthatmatter';
  if (!/^[a-z][a-z0-9+.-]{0,31}$/.test(appScheme)) throw new ConfigError('APP_SCHEME must be a lower-case URL scheme');
  if (adminToken !== null && adminToken.length < 32) throw new ConfigError('ADMIN_TOKEN must be at least 32 characters');
  return {
    region: optional(env, 'REGION') ?? 'global',
    origin,
    mediaOrigin: httpsOrigin(env, 'MEDIA_ORIGIN', false) ?? origin,
    version: optional(env, 'VERSION') ?? 'dev',
    live,
    signIn,
    stores: list(env, 'STORES', STORES),
    features: { spotify: flag(env, 'FEATURE_SPOTIFY', false) },
    ui: { memoBadge: badge },
    googleClientIds,
    appleClientIds,
    appScheme,
    maintenance: flag(env, 'MAINTENANCE', false),
    inactiveJob: flag(env, 'INACTIVE_JOB', true),
    secrets: {
      rateSalt: required(env, 'RATE_SALT'),
      emailCodeKey: required(env, 'EMAIL_CODE_KEY'),
      inviteKey: required(env, 'INVITE_KEY'),
      adminToken,
    },
  };
}

function optional(env: Env, name: string): string | null {
  const value = env[name]?.trim();
  return value ? value : null;
}

function required(env: Env, name: string): string {
  const value = optional(env, name);
  if (value === null) throw new ConfigError(`${name} is required`);
  return value;
}

function flag(env: Env, name: string, fallback: boolean): boolean {
  const value = optional(env, name);
  if (value === null) return fallback;
  if (value !== '0' && value !== '1') throw new ConfigError(`${name} must be 0 or 1`);
  return value === '1';
}

function list<T extends string>(env: Env, name: string, allowed: readonly T[]): T[] {
  const value = optional(env, name);
  if (value === null) return [];
  const items = value.split(',').map((s) => s.trim()).filter((s) => s !== '');
  for (const item of items) {
    if (!(allowed as readonly string[]).includes(item)) throw new ConfigError(`${name} has an unknown value`);
  }
  return [...new Set(items)] as T[];
}

function clientIds(env: Env, name: string, isRequired: boolean): string[] {
  const ids = [...new Set((optional(env, name) ?? '').split(',').map((s) => s.trim()).filter((s) => s !== ''))];
  if (isRequired && ids.length === 0) throw new ConfigError(`${name} is required when that sign-in method is on`);
  return ids;
}

function httpsOrigin(env: Env, name: string, isRequired: boolean): string | null {
  const value = isRequired ? required(env, name) : optional(env, name);
  if (value === null) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ConfigError(`${name} must be an https origin`);
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.pathname !== '/' || url.search || url.hash) {
    throw new ConfigError(`${name} must be an https origin`);
  }
  return url.origin;
}

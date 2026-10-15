export type { BlobObject, BlobStore } from './blob.ts';
export { nowSeconds, systemClock } from './clock.ts';
export type { Clock } from './clock.ts';
export { ConfigError, loadConfig } from './config.ts';
export type { Config, Env, Secrets } from './config.ts';
export { pollHub } from './live.ts';
export type { LiveHub } from './live.ts';
export type { MailMessage, Mailer } from './mailer.ts';
export { base64Url, cryptoRandom, token22 } from './random.ts';
export type { Random } from './random.ts';
export type { SqlDriver, SqlRow, SqlStatement, SqlValue } from './sql.ts';
export { StoreBusyError } from './store.ts';
export type * from './store.ts';

import type { KeyFetcher } from '../auth/keys.ts';
import type { BlobStore } from './blob.ts';
import type { Clock } from './clock.ts';
import type { Config } from './config.ts';
import type { LiveHub } from './live.ts';
import type { Mailer } from './mailer.ts';
import type { Random } from './random.ts';
import type { Store } from './store.ts';

/** Everything a variant wires into the core. */
export interface Ports {
  readonly store: Store;
  readonly blobs: BlobStore;
  readonly live: LiveHub;
  readonly mailer: Mailer;
  readonly clock: Clock;
  readonly random: Random;
  readonly config: Config;
  /** Signing keys of Google and Apple; `cachedKeyFetcher(fetch, clock)` in production. */
  readonly keys: KeyFetcher;
}

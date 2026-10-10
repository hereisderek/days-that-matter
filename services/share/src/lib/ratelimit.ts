import { sha256Hex } from './tokens';
import { yyyymmdd } from './time';

export interface Limit {
  key: string;
  windowSeconds: number;
  max: number;
}

export interface LimitResult {
  limit: Limit;
  ok: boolean;
  retryAfter: number;
}

// Counter is only incremented while below the max, so rejected requests do not keep writing rows.
const HIT_SQL = `INSERT INTO rate_counters (key, window_start, count) VALUES (?1, ?2, 1)
  ON CONFLICT(key, window_start) DO UPDATE SET count = count + 1 WHERE count < ?3
  RETURNING count`;

/** One D1 round trip for any number of limits. */
export async function hitLimits(db: D1Database, limits: Limit[], now: number): Promise<LimitResult[]> {
  const stmts = limits.map((l) =>
    db.prepare(HIT_SQL).bind(l.key, now - (now % l.windowSeconds), l.max),
  );
  const results = await db.batch(stmts);
  return limits.map((limit, i) => ({
    limit,
    ok: results[i].results.length > 0,
    retryAfter: limit.windowSeconds - (now % limit.windowSeconds),
  }));
}

export async function ipKey(ip: string | null, now: number, salt: string | undefined): Promise<string> {
  return sha256Hex(`${ip ?? 'unknown'}:${yyyymmdd(now)}:${salt ?? ''}`);
}

export const CREATE_PER_MINUTE = 10;
export const CREATE_PER_HOUR = 60;
export const CREATE_GLOBAL_PER_DAY = 10_000;
export const WRITES_PER_SHARE_MINUTE = 30;

export async function createLimits(ip: string | null, now: number, salt: string | undefined): Promise<Limit[]> {
  const h = await ipKey(ip, now, salt);
  return [
    { key: `create:ipm:${h}`, windowSeconds: 60, max: CREATE_PER_MINUTE },
    { key: `create:iph:${h}`, windowSeconds: 3600, max: CREATE_PER_HOUR },
    { key: `create:global:${yyyymmdd(now)}`, windowSeconds: 86400, max: CREATE_GLOBAL_PER_DAY },
  ];
}

export const shareWriteLimit = (tokenHash: string): Limit => ({
  key: `write:share:${tokenHash.slice(0, 32)}`,
  windowSeconds: 60,
  max: WRITES_PER_SHARE_MINUTE,
});

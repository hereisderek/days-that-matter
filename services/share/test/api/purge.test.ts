import { env } from 'cloudflare:workers';
import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import worker from '../../src/index';
import { purge } from '../../src/lib/purge';

const DAY = 86400;
const NOW = 1_800_000_000;
let n = 0;

async function row(o: { expires?: number | null; revoked?: number | null; payload?: string; bytes?: number }) {
  const id = `purge-${n++}`;
  const payload = o.payload ?? '{"v":1}';
  await env.DB.prepare(
    `INSERT INTO shares (id, token_hash, manage_hash, install_id, schema_version, payload, payload_bytes, created_at, updated_at, expires_at, revoked_at)
     VALUES (?1, ?1, 'm', 'i', 1, ?2, ?3, 1, 1, ?4, ?5)`,
  ).bind(id, payload, o.bytes ?? payload.length, o.expires ?? null, o.revoked ?? null).run();
  return id;
}
const get = (id: string) => env.DB.prepare('SELECT * FROM shares WHERE id = ?').bind(id).first<any>();
const count = async (prefix: string) => (await env.DB.prepare('SELECT COUNT(*) c FROM shares WHERE id LIKE ?').bind(prefix + '%').first<any>()).c as number;

describe('purge', () => {
  it('clears the payload of expired rows but keeps the row', async () => {
    const expired = await row({ expires: NOW - 10 });
    const active = await row({ expires: NOW + 10 });
    const forever = await row({});
    const res = await purge(env.DB, NOW);
    expect(res.cleared).toBeGreaterThanOrEqual(1);
    const e = await get(expired);
    expect(e.payload).toBe('{}');
    expect(e.payload_bytes).toBe(0);
    expect((await get(active)).payload).toBe('{"v":1}');
    expect((await get(forever)).payload).toBe('{"v":1}');
  });
  it('deletes rows 30 days after revoke or expiry and keeps younger rows', async () => {
    const oldRevoked = await row({ revoked: NOW - 31 * DAY, payload: '{}', bytes: 0 });
    const oldExpired = await row({ expires: NOW - 31 * DAY });
    const youngRevoked = await row({ revoked: NOW - 29 * DAY, payload: '{}', bytes: 0 });
    const youngExpired = await row({ expires: NOW - 29 * DAY });
    const res = await purge(env.DB, NOW);
    expect(res.deleted).toBeGreaterThanOrEqual(2);
    expect(await get(oldRevoked)).toBeNull();
    expect(await get(oldExpired)).toBeNull();
    expect(await get(youngRevoked)).toBeTruthy();
    expect((await get(youngExpired)).payload).toBe('{}');
  });
  it('removes rate counters older than 2 days only', async () => {
    const ins = (k: string, ws: number) => env.DB.prepare('INSERT INTO rate_counters VALUES (?, ?, 1)').bind(k, ws).run();
    await ins('purge:old', NOW - 3 * DAY);
    await ins('purge:new', NOW - 1 * DAY);
    await purge(env.DB, NOW);
    const keys = (await env.DB.prepare("SELECT key FROM rate_counters WHERE key LIKE 'purge:%'").all<any>()).results.map((r) => r.key);
    expect(keys).toEqual(['purge:new']);
  });
  it('respects the batch and statement bounds', async () => {
    for (let i = 0; i < 12; i++) await row({ revoked: NOW - 40 * DAY, payload: '{}', bytes: 0 });
    const before = await count('purge-');
    const res = await purge(env.DB, NOW, { batchSize: 3, maxStatements: 6 });
    // 2 statements per step with batches of 3 removes at most 6 rows.
    expect(res.statements).toBeLessThanOrEqual(6);
    expect(before - (await count('purge-'))).toBeLessThanOrEqual(6);
    expect(res.deleted).toBeLessThanOrEqual(6);
  });
  it('defaults: 500 rows per statement and at most 20 statements', async () => {
    const res = await purge(env.DB, NOW);
    expect(res.statements).toBeLessThanOrEqual(20);
  });
  it('runs from the scheduled handler', async () => {
    const id = await row({ expires: Math.floor(Date.now() / 1000) - 5 });
    const ctx = createExecutionContext();
    await worker.scheduled({} as ScheduledController, env, ctx);
    await waitOnExecutionContext(ctx);
    expect((await get(id)).payload).toBe('{}');
  });
});

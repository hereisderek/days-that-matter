const DAY = 86400;

export interface PurgeOptions {
  batchSize?: number;
  maxStatements?: number;
}

export interface PurgeResult {
  cleared: number;
  deleted: number;
  countersDeleted: number;
  statements: number;
}

async function runBounded(db: D1Database, sql: string, binds: unknown[], max: number): Promise<{ changes: number; statements: number }> {
  let changes = 0;
  let statements = 0;
  const batchSize = binds[binds.length - 1] as number;
  while (statements < max) {
    const res = await db.prepare(sql).bind(...binds).run();
    statements++;
    changes += res.meta.changes;
    if (res.meta.changes < batchSize) break;
  }
  return { changes, statements };
}

/**
 * Nightly purge. Each DELETE or UPDATE touches at most `batchSize` rows and the whole run issues at most
 * `maxStatements` statements, split evenly over the three steps.
 */
export async function purge(db: D1Database, now: number, opts: PurgeOptions = {}): Promise<PurgeResult> {
  const batchSize = opts.batchSize ?? 500;
  const maxStatements = opts.maxStatements ?? 20;
  const per = Math.max(1, Math.floor(maxStatements / 3));
  const cutoff = now - 30 * DAY;

  // 1. Clear payloads of expired rows right away.
  const clear = await runBounded(
    db,
    `UPDATE shares SET payload = '{}', payload_bytes = 0
      WHERE id IN (SELECT id FROM shares WHERE expires_at < ?1 AND payload_bytes > 0 AND revoked_at IS NULL LIMIT ?2)`,
    [now, batchSize],
    per,
  );
  // 2. Delete rows 30 days after revoke or expiry.
  const del = await runBounded(
    db,
    `DELETE FROM shares
      WHERE id IN (SELECT id FROM shares WHERE revoked_at < ?1 OR expires_at < ?1 LIMIT ?2)`,
    [cutoff, batchSize],
    per,
  );
  // 3. Old rate counters.
  const counters = await runBounded(
    db,
    `DELETE FROM rate_counters
      WHERE (key, window_start) IN (SELECT key, window_start FROM rate_counters WHERE window_start < ?1 LIMIT ?2)`,
    [now - 2 * DAY, batchSize],
    Math.max(1, maxStatements - 2 * per),
  );
  return {
    cleared: clear.changes,
    deleted: del.changes,
    countersDeleted: counters.changes,
    statements: clear.statements + del.statements + counters.statements,
  };
}

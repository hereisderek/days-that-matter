// Applies backend/core/migrations/*.sql through an SqlDriver, for drivers without their own migration
// tool (node:sqlite, libSQL). D1 can use `wrangler d1 migrations apply` on the same files instead.
import type { SqlDriver } from '../ports/sql.ts';

export interface Migration {
  /** File name, for example `0001_init.sql`; applied in name order. */
  readonly name: string;
  readonly sql: string;
}

/** Applies the migrations not applied yet, each in one transaction. Returns the names it applied. */
export async function applyMigrations(driver: SqlDriver, migrations: readonly Migration[]): Promise<string[]> {
  await driver.batch([
    { sql: 'CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)' },
  ]);
  const done = new Set((await driver.query<{ name: string }>('SELECT name FROM _migrations')).map((r) => r.name));
  const applied: string[] = [];
  for (const m of [...migrations].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    if (done.has(m.name)) continue;
    await driver.batch([
      ...splitSqlStatements(m.sql).map((sql) => ({ sql })),
      { sql: "INSERT INTO _migrations (name, applied_at) VALUES (?, CAST(strftime('%s','now') AS INTEGER))", args: [m.name] },
    ]);
    applied.push(m.name);
  }
  return applied;
}

/**
 * Splits a migration into statements at `;`, outside quotes and comments, and drops comments.
 * Enough for plain DDL; migrations with triggers would need `BEGIN ... END` handling.
 */
export function splitSqlStatements(sql: string): string[] {
  const out: string[] = [];
  let current = '';
  let i = 0;
  while (i < sql.length) {
    const c = sql[i] as string;
    if (c === '-' && sql[i + 1] === '-') {
      const end = sql.indexOf('\n', i);
      i = end === -1 ? sql.length : end;
      continue;
    }
    if (c === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2);
      i = end === -1 ? sql.length : end + 2;
      continue;
    }
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < sql.length && !(sql[j] === c && sql[j + 1] !== c)) j += sql[j] === c ? 2 : 1;
      current += sql.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (c === ';') {
      if (current.trim()) out.push(current.trim());
      current = '';
    } else {
      current += c;
    }
    i++;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

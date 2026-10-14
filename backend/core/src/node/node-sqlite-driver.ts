// SqlDriver over Node's built-in SQLite (`node:sqlite`, unflagged since Node 22.13). Used by the core
// tests and, later, the self-host variant. Node prints an ExperimentalWarning on first use.
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import type { StatementSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import type { SqlDriver, SqlRow, SqlStatement, SqlValue } from '../ports/sql.ts';
import { applyMigrations } from '../store/migrations.ts';
import type { Migration } from '../store/migrations.ts';
import { SqlStore } from '../store/sql-store.ts';

export class NodeSqliteDriver implements SqlDriver {
  readonly db: DatabaseSync;
  readonly #statements = new Map<string, StatementSync>();

  /** `path` is a database file, or `:memory:`. Files use WAL. */
  constructor(path = ':memory:') {
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA busy_timeout = 5000');
    if (path !== ':memory:') this.db.exec('PRAGMA journal_mode = WAL');
  }

  async query<T extends SqlRow = SqlRow>(sql: string, args: readonly SqlValue[] = []): Promise<T[]> {
    return this.#prepare(sql).all(...args) as T[];
  }

  async batch(statements: readonly SqlStatement[]): Promise<number[]> {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const changes = statements.map((s) => Number(this.#prepare(s.sql).run(...(s.args ?? [])).changes));
      this.db.exec('COMMIT');
      return changes;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  close(): void {
    this.db.close();
  }

  #prepare(sql: string): StatementSync {
    let statement = this.#statements.get(sql);
    if (!statement) {
      statement = this.db.prepare(sql);
      this.#statements.set(sql, statement);
    }
    return statement;
  }
}

/** The migrations in backend/core/migrations/. */
export function readMigrations(dir = fileURLToPath(new URL('../../migrations/', import.meta.url))): Migration[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => ({ name, sql: readFileSync(`${dir}/${name}`, 'utf8') }));
}

/** A migrated SQLite database and its SqlStore. */
export async function openSqliteStore(path = ':memory:'): Promise<{ driver: NodeSqliteDriver; store: SqlStore }> {
  const driver = new NodeSqliteDriver(path);
  await applyMigrations(driver, readMigrations());
  return { driver, store: new SqlStore(driver) };
}

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { NodeSqliteDriver, openSqliteStore, readMigrations } from '../../src/node/node-sqlite-driver.ts';
import { applyMigrations, splitSqlStatements } from '../../src/store/migrations.ts';
import { SqlStore } from '../../src/store/sql-store.ts';
import type { SqlDriver } from '../../src/ports/sql.ts';

const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

describe('migrations 0001_init.sql and 0002_accounts.sql', () => {
  it('creates the tables of this wave and leaves later ones to their tasks', async () => {
    const { driver } = await openSqliteStore();
    const tables = (await driver.query<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")).map((r) => r.name);
    expect(tables).toEqual([
      '_migrations', 'accounts', 'devices', 'email_codes', 'events', 'exports', 'grants', 'identities', 'links', 'media', 'members', 'memos',
      'revisions', 'sessions',
    ]);
    for (const later of ['invites', 'purchases', 'rate_counters']) expect(tables).not.toContain(later);
  });

  it('matches the columns and indexes of BACKEND.md section 6.1', async () => {
    const { driver } = await openSqliteStore();
    const columns = async (t: string) => (await driver.query<{ name: string }>(`SELECT name FROM pragma_table_info('${t}')`)).map((r) => r.name);
    expect(await columns('accounts')).toEqual([
      'id', 'display_name', 'plan', 'plan_expires_at', 'audio_blocked', 'media_bytes', 'media_files', 'last_active_at',
      'inactive_notice_1_at', 'inactive_notice_2_at', 'created_at',
    ]);
    expect(await columns('events')).toEqual([
      'id', 'owner_id', 'rev', 'doc', 'audio_kind', 'audio_set_by', 'audio_media_id', 'child_seq', 'child_purged_seq', 'updated_at', 'deleted_at',
      'first_upload_at',
    ]);
    expect(await columns('identities')).toEqual(['provider', 'subject', 'account_id', 'email', 'email_verified', 'created_at']);
    expect(await columns('email_codes')).toEqual(['email_hash', 'code_mac', 'expires_at', 'attempts']);
    expect(await columns('sessions')).toEqual(['token_hash', 'account_id', 'created_at', 'last_used_at']);
    expect(await columns('revisions')).toEqual(['event_id', 'rev', 'author_id', 'created_at', 'patch', 'inverse', 'overwrote', 'restored_from']);
    expect(await columns('members')).toEqual(['event_id', 'account_id', 'role', 'invite_id', 'archived_at', 'reminders', 'created_at']);
    expect(await columns('media')).toEqual([
      'id', 'uploader_id', 'event_id', 'kind', 'content_type', 'bytes', 'width', 'height', 'duration_ms', 'title', 'library_removed_at', 'created_at', 'unused_since',
    ]);
    const indexes = (await driver.query<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%' ORDER BY name")).map((r) => r.name);
    expect(indexes).toEqual([
      'idx_accounts_last_active', 'idx_accounts_media_bytes', 'idx_accounts_media_files', 'idx_devices_account', 'idx_events_audio_media',
      'idx_events_owner', 'idx_events_spotify', 'idx_exports_account', 'idx_grants_account', 'idx_identities_account', 'idx_identities_email',
      'idx_links_event', 'idx_media_unused', 'idx_media_uploader', 'idx_members_account', 'idx_memos_event_seq', 'idx_sessions_account',
    ]);
  });

  it('enforces the CHECK constraints', async () => {
    const { driver } = await openSqliteStore();
    await expect(driver.batch([{ sql: "INSERT INTO accounts (id, display_name, plan, last_active_at, created_at) VALUES ('a', 'A', 'gold', 0, 0)" }])).rejects.toThrow();
    await expect(driver.batch([{ sql: "INSERT INTO members (event_id, account_id, role, created_at) VALUES ('e', 'a', 'owner', 0)" }])).rejects.toThrow();
    await expect(driver.batch([{ sql: "INSERT INTO media (id, uploader_id, kind, content_type, bytes, created_at) VALUES ('m', 'a', 'gif', 'x', 1, 0)" }])).rejects.toThrow();
  });

  it('applies once, in name order', async () => {
    const driver = new NodeSqliteDriver();
    expect(await applyMigrations(driver, readMigrations())).toEqual(['0001_init.sql', '0002_accounts.sql']);
    expect(await applyMigrations(driver, readMigrations())).toEqual([]);
    const later = [{ name: '0004_c.sql', sql: 'CREATE TABLE c (x INTEGER);' }, { name: '0003_b.sql', sql: 'CREATE TABLE b (x INTEGER);' }];
    expect(await applyMigrations(driver, later)).toEqual(['0003_b.sql', '0004_c.sql']);
  });

  it('rolls back a failing migration whole', async () => {
    const driver = new NodeSqliteDriver();
    await expect(applyMigrations(driver, [{ name: '0001_bad.sql', sql: 'CREATE TABLE ok (x INTEGER); CREATE TABLE ok (x INTEGER);' }])).rejects.toThrow();
    expect(await driver.query("SELECT name FROM sqlite_master WHERE name = 'ok'")).toEqual([]);
    expect(await driver.query('SELECT name FROM _migrations')).toEqual([]);
  });
});

describe('splitSqlStatements', () => {
  it('splits at semicolons outside quotes and comments', () => {
    const sql = `-- header; with a semicolon
CREATE TABLE a (x TEXT DEFAULT 'a;b'); /* block; comment */
INSERT INTO a VALUES ('it''s; fine');
INSERT INTO a VALUES ("q;"); -- trailing
`;
    expect(splitSqlStatements(sql)).toEqual([
      "CREATE TABLE a (x TEXT DEFAULT 'a;b')",
      "INSERT INTO a VALUES ('it''s; fine')",
      'INSERT INTO a VALUES ("q;")',
    ]);
    expect(splitSqlStatements('SELECT 1')).toEqual(['SELECT 1']);
    expect(splitSqlStatements('  ;; -- only comments')).toEqual([]);
  });
});

describe('NodeSqliteDriver', () => {
  it('batches atomically and reports changed rows', async () => {
    const driver = new NodeSqliteDriver();
    await driver.batch([{ sql: 'CREATE TABLE t (k TEXT PRIMARY KEY, v INTEGER)' }]);
    expect(await driver.batch([{ sql: 'INSERT INTO t VALUES (?, ?)', args: ['a', 1] }, { sql: 'UPDATE t SET v = v + 1' }])).toEqual([1, 1]);
    await expect(driver.batch([{ sql: 'INSERT INTO t VALUES (?, ?)', args: ['b', 1] }, { sql: 'INSERT INTO t VALUES (?, ?)', args: ['a', 9] }])).rejects.toThrow();
    expect(await driver.query('SELECT k, v FROM t ORDER BY k')).toEqual([{ k: 'a', v: 2 }]);
    expect(await driver.query('SELECT ? AS b', [new Uint8Array([1, 2])])).toEqual([{ b: new Uint8Array([1, 2]) }]);
    driver.close();
  });

  it('works on a database file with WAL and keeps data across connections', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dtm-sqlite-'));
    dirs.push(dir);
    const path = join(dir, 'db.sqlite');
    const first = await openSqliteStore(path);
    await first.store.createAccount({ id: 'a1', displayName: 'A', now: 1 });
    expect(await first.driver.query('PRAGMA journal_mode')).toEqual([{ journal_mode: 'wal' }]);
    first.driver.close();
    const second = await openSqliteStore(path);
    expect((await second.store.getAccount('a1'))?.displayName).toBe('A');
    second.driver.close();
  });
});

describe('SqlStore under contention', () => {
  it('reports StoreBusyError when every attempt loses the race', async () => {
    const { driver } = await openSqliteStore();
    const store = new SqlStore(driver);
    await store.createAccount({ id: 'o', displayName: 'O', now: 1 });
    await store.createEvent({ id: 'e', ownerId: 'o', doc: { title: 'T' }, now: 1 });
    // A driver whose writes always find the row changed by someone else.
    const losing: SqlDriver = { query: (sql, args) => driver.query(sql, args), batch: async (s) => s.map(() => 0) };
    await expect(new SqlStore(losing).applyPatch({ eventId: 'e', authorId: 'o', baseRev: 1, patch: { title: 'U' }, now: 2 })).rejects.toThrow('store busy');
  });
});

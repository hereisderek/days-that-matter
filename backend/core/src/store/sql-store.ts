// Store over an SqlDriver (D1, node:sqlite, libSQL), schema in backend/core/migrations/.
//
// D1 and libSQL over HTTP have no interactive transactions, so a write reads, computes, then commits
// one batch whose statements only apply while the row is still at the rev it read. When another
// write got there first, the batch changes nothing and the write starts again.
import type { Plan, SignInMethod } from '../contract/index.ts';
import { applyEventPatch, applyPatch, overwrittenFields } from '../rules/merge.ts';
import type { JsonObject } from '../rules/merge.ts';
import type { SqlDriver, SqlValue } from '../ports/sql.ts';
import { StoreBusyError } from '../ports/store.ts';
import type {
  AccountDeletion,
  AccountRecord,
  AccountUsage,
  AddIdentityInput,
  AddIdentityOutcome,
  AudioKind,
  ChildrenPage,
  CreateAccountResult,
  CreateEventResult,
  EmailCodeInput,
  EventRecord,
  IdentityInput,
  IdentityRecord,
  ManifestRow,
  MediaKindValue,
  MediaRef,
  MemberRecord,
  MemberRoleValue,
  MemoRecord,
  MemoWriteOutcome,
  NewAccount,
  NewEvent,
  PatchInput,
  PatchMemoInput,
  PatchOutcome,
  PersonOnEvent,
  PutMemberInput,
  PutMemoInput,
  PutMemoOutcome,
  ReaderEvent,
  RevisionQuery,
  RevisionRecord,
  SessionRecord,
  SignInInput,
  SignInOutcome,
  Store,
} from '../ports/store.ts';
import { WRITE_ATTEMPTS, audioColumns, docBytes } from './records.ts';

interface AccountRow {
  [key: string]: SqlValue;
  id: string;
  display_name: string;
  plan: string;
  plan_expires_at: number | null;
  audio_blocked: number;
  media_bytes: number;
  media_files: number;
  last_active_at: number;
  inactive_notice_1_at: number | null;
  inactive_notice_2_at: number | null;
  created_at: number;
}

interface EventRow {
  [key: string]: SqlValue;
  id: string;
  owner_id: string;
  rev: number;
  doc: string;
  audio_kind: string | null;
  audio_set_by: string | null;
  audio_media_id: string | null;
  child_seq: number;
  child_purged_seq: number;
  updated_at: number;
  deleted_at: number | null;
}

interface RevisionRow {
  [key: string]: SqlValue;
  event_id: string;
  rev: number;
  author_id: string | null;
  created_at: number;
  patch: string;
  inverse: string;
  overwrote: string | null;
  restored_from: number | null;
}

interface IdentityRow {
  [key: string]: SqlValue;
  provider: string;
  subject: string;
  account_id: string;
  email: string | null;
  email_verified: number;
  created_at: number;
}

interface SessionRow {
  [key: string]: SqlValue;
  token_hash: string;
  account_id: string;
  created_at: number;
  last_used_at: number;
}

interface MemberRow {
  [key: string]: SqlValue;
  event_id: string;
  account_id: string;
  role: string;
  invite_id: string | null;
  archived_at: number | null;
  reminders: string | null;
  created_at: number;
}

interface MemoRow {
  [key: string]: SqlValue;
  id: string;
  event_id: string;
  author_id: string;
  seq: number;
  doc: string;
  updated_at: number;
  deleted_at: number | null;
}

const EVENT_COLUMNS =
  'id, owner_id, rev, doc, audio_kind, audio_set_by, audio_media_id, child_seq, child_purged_seq, updated_at, deleted_at';
const E_EVENT_COLUMNS = EVENT_COLUMNS.split(', ').map((c) => `e.${c}`).join(', ');
const OWNED = 'SELECT id FROM events WHERE owner_id = ?';

export class SqlStore implements Store {
  readonly #db: SqlDriver;

  constructor(driver: SqlDriver) {
    this.#db = driver;
  }

  async createAccount(input: NewAccount): Promise<CreateAccountResult> {
    const [changed] = await this.#db.batch([
      {
        sql: `INSERT INTO accounts (id, display_name, last_active_at, created_at) VALUES (?, ?, ?, ?)
              ON CONFLICT (id) DO NOTHING`,
        args: [input.id, input.displayName, input.now, input.now],
      },
    ]);
    const account = await this.getAccount(input.id);
    if (!account) throw new Error('account missing after insert');
    return { status: changed === 1 ? 'created' : 'exists', account };
  }

  async getAccount(id: string): Promise<AccountRecord | null> {
    const [row] = await this.#db.query<AccountRow>('SELECT * FROM accounts WHERE id = ?', [id]);
    return row ? toAccount(row) : null;
  }

  async createEvent(input: NewEvent): Promise<CreateEventResult> {
    const audio = audioColumns(input.doc, input.ownerId);
    const max = input.maxOwned ?? null;
    const since = input.firstUpload?.since ?? null;
    const [changed] = await this.#db.batch([
      {
        sql: `INSERT INTO events (id, owner_id, rev, doc, audio_kind, audio_set_by, audio_media_id, updated_at, first_upload_at)
              SELECT ?, ?, 1, ?, ?, ?, ?, ?, CASE WHEN first THEN ? END
              FROM (SELECT ? IS NOT NULL AND (SELECT COUNT(*) FROM events WHERE owner_id = ? AND first_upload_at >= ?) < ? AS first,
                           ? IS NULL OR (SELECT COUNT(*) FROM events WHERE owner_id = ? AND deleted_at IS NULL) < ? AS within)
              WHERE first OR within
              ON CONFLICT (id) DO NOTHING`,
        args: [
          input.id, input.ownerId, JSON.stringify(input.doc), audio.audioKind, audio.audioSetBy, audio.audioMediaId, input.now, input.now,
          since, input.ownerId, since, input.firstUpload?.max ?? 0,
          max, input.ownerId, max,
        ],
      },
    ]);
    const event = await this.getEvent(input.id);
    if (!event) return { status: 'limit' };
    if (event.ownerId !== input.ownerId) return { status: 'conflict' };
    return { status: changed === 1 ? 'created' : 'exists', event };
  }

  async getEvent(id: string): Promise<EventRecord | null> {
    const [row] = await this.#db.query<EventRow>(`SELECT ${EVENT_COLUMNS} FROM events WHERE id = ?`, [id]);
    return row ? toEvent(row) : null;
  }

  async applyPatch(input: PatchInput): Promise<PatchOutcome> {
    for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt++) {
      const current = await this.getEvent(input.eventId);
      if (!current) return { status: 'not_found' };
      if (current.deletedAt !== null) return { status: 'deleted' };
      const result = applyEventPatch(current.doc, input.patch);
      const changed = Object.keys(result.applied);
      if (changed.length === 0) return { status: 'ok', event: current, applied: {}, overwritten: [] };
      if (input.maxDocBytes !== undefined && docBytes(result.doc) > input.maxDocBytes) return { status: 'too_large' };

      const since = await this.#db.query<RevisionRow>(
        'SELECT rev, author_id, patch FROM revisions WHERE event_id = ? AND rev > ? ORDER BY rev',
        [input.eventId, input.baseRev],
      );
      const overwritten = overwrittenFields(
        changed,
        input.baseRev,
        since.map((r) => ({ rev: r.rev, authorId: r.author_id, fields: Object.keys(JSON.parse(r.patch) as JsonObject) })),
        input.authorId,
      );
      const rev = current.rev + 1;
      const audio = 'audio' in result.applied
        ? audioColumns(result.doc, input.authorId)
        : { audioKind: current.audioKind, audioSetBy: current.audioSetBy, audioMediaId: current.audioMediaId };
      const guard = [input.eventId, current.rev] as const;
      const [, updated] = await this.#db.batch([
        {
          sql: `INSERT INTO revisions (event_id, rev, author_id, created_at, patch, inverse, overwrote, restored_from)
                SELECT ?, ?, ?, ?, ?, ?, ?, NULL
                WHERE EXISTS (SELECT 1 FROM events WHERE id = ? AND rev = ? AND deleted_at IS NULL)`,
          args: [
            input.eventId, rev, input.authorId, input.now, JSON.stringify(result.applied), JSON.stringify(result.inverse),
            overwritten.length > 0 ? JSON.stringify(overwritten) : null, ...guard,
          ],
        },
        {
          sql: `UPDATE events SET rev = ?, doc = ?, audio_kind = ?, audio_set_by = ?, audio_media_id = ?, updated_at = ?
                WHERE id = ? AND rev = ? AND deleted_at IS NULL`,
          args: [rev, JSON.stringify(result.doc), audio.audioKind, audio.audioSetBy, audio.audioMediaId, input.now, ...guard],
        },
      ]);
      if (updated === 1) {
        const event: EventRecord = { ...current, ...audio, rev, doc: result.doc, updatedAt: input.now };
        return { status: 'ok', event, applied: result.applied, overwritten };
      }
    }
    throw new StoreBusyError();
  }

  async deleteEvent(eventId: string, now: number): Promise<boolean> {
    const [changed] = await this.#db.batch([
      { sql: 'UPDATE events SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL', args: [now, now, eventId] },
    ]);
    return changed === 1;
  }

  async listRevisions(eventId: string, query: RevisionQuery): Promise<RevisionRecord[]> {
    const rows = await this.#db.query<RevisionRow>(
      `SELECT * FROM revisions WHERE event_id = ? AND rev < ? ORDER BY rev DESC LIMIT ?`,
      [eventId, query.before ?? Number.MAX_SAFE_INTEGER, query.limit],
    );
    return rows.map(toRevision);
  }

  // ---- Accounts ----

  async signIn(input: SignInInput): Promise<SignInOutcome> {
    const { identity, newAccount } = input;
    const known = await this.#identityAccount(identity.provider, identity.subject);
    if (known !== null) return { status: 'existing', account: await this.#account(known) };
    if (identity.emailVerified && identity.email !== null) {
      const [match] = await this.#db.query<{ account_id: string }>(
        `SELECT account_id FROM identities WHERE email = ? AND email_verified = 1
         ORDER BY created_at, provider, subject LIMIT 1`,
        [identity.email],
      );
      if (match) {
        const [added] = await this.#db.batch([insertIdentity(identity, match.account_id, newAccount.now)]);
        const owner = (await this.#identityAccount(identity.provider, identity.subject)) as string;
        return { status: added === 1 ? 'linked' : 'existing', account: await this.#account(owner) };
      }
    }
    const absent = 'NOT EXISTS (SELECT 1 FROM identities WHERE provider = ? AND subject = ?)';
    const [created] = await this.#db.batch([
      {
        sql: `INSERT INTO accounts (id, display_name, last_active_at, created_at) SELECT ?, ?, ?, ? WHERE ${absent}`,
        args: [newAccount.id, newAccount.displayName, newAccount.now, newAccount.now, identity.provider, identity.subject],
      },
      insertIdentity(identity, newAccount.id, newAccount.now),
    ]);
    const owner = (await this.#identityAccount(identity.provider, identity.subject)) as string;
    return { status: created === 1 ? 'created' : 'existing', account: await this.#account(owner) };
  }

  async addIdentity(input: AddIdentityInput): Promise<AddIdentityOutcome> {
    const [added] = await this.#db.batch([insertIdentity(input.identity, input.accountId, input.now)]);
    if (added === 1) return 'added';
    const owner = await this.#identityAccount(input.identity.provider, input.identity.subject);
    return owner === input.accountId ? 'exists' : 'conflict';
  }

  async listIdentities(accountId: string): Promise<IdentityRecord[]> {
    const rows = await this.#db.query<IdentityRow>(
      'SELECT * FROM identities WHERE account_id = ? ORDER BY created_at, provider, subject',
      [accountId],
    );
    return rows.map((r) => ({
      provider: r.provider as SignInMethod,
      subject: r.subject,
      accountId: r.account_id,
      email: r.email,
      emailVerified: r.email_verified !== 0,
      createdAt: r.created_at,
    }));
  }

  async updateDisplayName(accountId: string, displayName: string): Promise<AccountRecord | null> {
    await this.#db.batch([{ sql: 'UPDATE accounts SET display_name = ? WHERE id = ?', args: [displayName, accountId] }]);
    return this.getAccount(accountId);
  }

  async usage(accountId: string): Promise<AccountUsage> {
    const media = (kind: MediaKindValue): string =>
      `(SELECT COUNT(*) FROM media WHERE uploader_id = ?1 AND kind = '${kind}' AND unused_since IS NULL)`;
    const [row] = await this.#db.query<{ events: number; spotify: number; photos: number; motion: number; audio: number }>(
      `SELECT (SELECT COUNT(*) FROM events WHERE owner_id = ?1 AND deleted_at IS NULL) AS events,
              (SELECT COUNT(*) FROM events WHERE audio_set_by = ?1 AND audio_kind = 'spotify' AND deleted_at IS NULL) AS spotify,
              ${media('still')} AS photos, ${media('motion')} AS motion, ${media('audio')} AS audio`,
      [accountId],
    );
    const r = row as { events: number; spotify: number; photos: number; motion: number; audio: number };
    return { events: r.events, photos: r.photos, animatedBackdrop: r.motion, customAudio: r.audio, spotifyEvents: r.spotify };
  }

  async deleteAccount(accountId: string, now: number): Promise<AccountDeletion | null> {
    if (!(await this.getAccount(accountId))) return null;
    const owned = (await this.#db.query<{ id: string }>(`${OWNED} ORDER BY id`, [accountId])).map((r) => r.id);
    const memberOf = (
      await this.#db.query<{ event_id: string }>(
        "SELECT event_id FROM members WHERE account_id = ? AND role <> 'removed' ORDER BY event_id",
        [accountId],
      )
    ).map((r) => r.event_id);
    const ownedMedia = `event_id IN (${OWNED})`;
    const media = await this.#db.query<{ id: string; kind: string; content_type: string }>(
      `SELECT id, kind, content_type FROM media WHERE uploader_id = ? OR ${ownedMedia} ORDER BY id`,
      [accountId, accountId],
    );
    await this.#db.batch([
      // Other uploaders' files on the owned events go too: their counters follow in the same write.
      {
        sql: `UPDATE accounts SET
                media_bytes = media_bytes - (SELECT COALESCE(SUM(bytes), 0) FROM media WHERE uploader_id = accounts.id AND ${ownedMedia}),
                media_files = media_files - (SELECT COUNT(*) FROM media WHERE uploader_id = accounts.id AND ${ownedMedia})
              WHERE id <> ? AND id IN (SELECT uploader_id FROM media WHERE ${ownedMedia})`,
        args: [accountId, accountId, accountId, accountId],
      },
      { sql: `DELETE FROM media WHERE uploader_id = ? OR ${ownedMedia}`, args: [accountId, accountId] },
      { sql: `DELETE FROM revisions WHERE event_id IN (${OWNED})`, args: [accountId] },
      { sql: `DELETE FROM memos WHERE event_id IN (${OWNED})`, args: [accountId] },
      { sql: `DELETE FROM members WHERE event_id IN (${OWNED}) OR account_id = ?`, args: [accountId, accountId] },
      {
        sql: `UPDATE events SET doc = '{}', audio_kind = NULL, audio_set_by = NULL, audio_media_id = NULL,
                deleted_at = COALESCE(deleted_at, ?), updated_at = ? WHERE owner_id = ?`,
        args: [now, now, accountId],
      },
      { sql: 'UPDATE revisions SET author_id = NULL WHERE author_id = ?', args: [accountId] },
      { sql: 'DELETE FROM identities WHERE account_id = ?', args: [accountId] },
      { sql: 'DELETE FROM sessions WHERE account_id = ?', args: [accountId] },
      { sql: 'DELETE FROM grants WHERE account_id = ?', args: [accountId] },
      { sql: 'DELETE FROM exports WHERE account_id = ?', args: [accountId] },
      { sql: 'DELETE FROM devices WHERE account_id = ?', args: [accountId] },
      { sql: 'DELETE FROM accounts WHERE id = ?', args: [accountId] },
    ]);
    return {
      ownedEventIds: owned,
      memberEventIds: memberOf,
      media: media.map((m): MediaRef => ({ id: m.id, kind: m.kind as MediaKindValue, contentType: m.content_type })),
    };
  }

  async putEmailCode(input: EmailCodeInput): Promise<void> {
    await this.#db.batch([
      {
        sql: `INSERT INTO email_codes (email_hash, code_mac, expires_at, attempts) VALUES (?, ?, ?, 0)
              ON CONFLICT (email_hash) DO UPDATE SET code_mac = excluded.code_mac, expires_at = excluded.expires_at, attempts = 0`,
        args: [input.emailHash, input.codeMac, input.expiresAt],
      },
    ]);
  }

  async takeEmailCodeAttempt(emailHash: string, now: number, maxAttempts: number): Promise<string | null> {
    const [counted] = await this.#db.batch([
      {
        sql: 'UPDATE email_codes SET attempts = attempts + 1 WHERE email_hash = ? AND expires_at > ? AND attempts < ?',
        args: [emailHash, now, maxAttempts],
      },
    ]);
    if (counted !== 1) return null;
    const [row] = await this.#db.query<{ code_mac: string }>('SELECT code_mac FROM email_codes WHERE email_hash = ?', [emailHash]);
    return row?.code_mac ?? null;
  }

  async consumeEmailCode(emailHash: string, codeMac: string): Promise<boolean> {
    const [deleted] = await this.#db.batch([
      { sql: 'DELETE FROM email_codes WHERE email_hash = ? AND code_mac = ?', args: [emailHash, codeMac] },
    ]);
    return deleted === 1;
  }

  async createSession(session: SessionRecord): Promise<void> {
    await this.#db.batch([
      {
        sql: 'INSERT INTO sessions (token_hash, account_id, created_at, last_used_at) VALUES (?, ?, ?, ?)',
        args: [session.tokenHash, session.accountId, session.createdAt, session.lastUsedAt],
      },
    ]);
  }

  async getSession(tokenHash: string): Promise<SessionRecord | null> {
    const [row] = await this.#db.query<SessionRow>('SELECT * FROM sessions WHERE token_hash = ?', [tokenHash]);
    return row ? { tokenHash: row.token_hash, accountId: row.account_id, createdAt: row.created_at, lastUsedAt: row.last_used_at } : null;
  }

  async markActive(tokenHash: string, accountId: string, now: number): Promise<void> {
    await this.#db.batch([
      { sql: 'UPDATE sessions SET last_used_at = ? WHERE token_hash = ?', args: [now, tokenHash] },
      {
        sql: 'UPDATE accounts SET last_active_at = ?, inactive_notice_1_at = NULL, inactive_notice_2_at = NULL WHERE id = ?',
        args: [now, accountId],
      },
    ]);
  }

  async deleteSession(tokenHash: string): Promise<boolean> {
    const [deleted] = await this.#db.batch([{ sql: 'DELETE FROM sessions WHERE token_hash = ?', args: [tokenHash] }]);
    return deleted === 1;
  }

  // ---- Sync ----

  async manifest(accountId: string): Promise<ManifestRow[]> {
    const rows = await this.#db.query<{ id: string; rev: number; role: string; child_seq: number }>(
      `SELECT id, rev, 'owner' AS role, child_seq FROM events WHERE owner_id = ?1 AND deleted_at IS NULL
       UNION ALL
       SELECT e.id, e.rev, m.role, 0 FROM members m JOIN events e ON e.id = m.event_id
       WHERE m.account_id = ?1 AND m.role IN ('viewer', 'editor') AND e.deleted_at IS NULL AND e.owner_id <> ?1
       ORDER BY id`,
      [accountId],
    );
    return rows.map((r) => ({ id: r.id, rev: r.rev, role: r.role as ManifestRow['role'], childSeq: r.child_seq }));
  }

  async readEvents(accountId: string, ids: readonly string[]): Promise<ReaderEvent[]> {
    if (ids.length === 0) return [];
    const rows = await this.#db.query<EventRow & { m_role: string | null; m_invite_id: string | null; m_archived_at: number | null; m_reminders: string | null; m_created_at: number | null }>(
      `SELECT ${E_EVENT_COLUMNS}, m.role AS m_role, m.invite_id AS m_invite_id, m.archived_at AS m_archived_at,
              m.reminders AS m_reminders, m.created_at AS m_created_at
       FROM events e LEFT JOIN members m ON m.event_id = e.id AND m.account_id = ?1
       WHERE e.id IN (SELECT value FROM json_each(?2)) AND (e.owner_id = ?1 OR m.role IN ('viewer', 'editor'))
       ORDER BY e.id`,
      [accountId, JSON.stringify([...new Set(ids)])],
    );
    const memberEvents = rows.filter((r) => r.owner_id !== accountId).map((r) => r.id);
    const people = await this.#people(memberEvents);
    return rows.map((r): ReaderEvent => {
      const event = toEvent(r);
      if (r.owner_id === accountId) return { event, role: 'owner', membership: null, people: [] };
      const membership = toMember({
        event_id: r.id, account_id: accountId, role: r.m_role as string, invite_id: r.m_invite_id, archived_at: r.m_archived_at,
        reminders: r.m_reminders, created_at: r.m_created_at as number,
      });
      return { event, role: membership.role as MemberRoleValue, membership, people: people.get(r.id) ?? [] };
    });
  }

  async putMember(input: PutMemberInput): Promise<void> {
    await this.#db.batch([
      {
        sql: `INSERT INTO members (event_id, account_id, role, invite_id, created_at) VALUES (?, ?, ?, ?, ?)
              ON CONFLICT (event_id, account_id) DO UPDATE SET role = excluded.role,
                invite_id = COALESCE(excluded.invite_id, members.invite_id)`,
        args: [input.eventId, input.accountId, input.role, input.inviteId, input.now],
      },
    ]);
  }

  async getMember(eventId: string, accountId: string): Promise<MemberRecord | null> {
    const [row] = await this.#db.query<MemberRow>('SELECT * FROM members WHERE event_id = ? AND account_id = ?', [eventId, accountId]);
    return row ? toMember(row) : null;
  }

  // ---- Memos ----

  async putMemo(input: PutMemoInput): Promise<PutMemoOutcome> {
    for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt++) {
      const existing = await this.getMemo(input.memoId);
      if (existing) return existing.eventId === input.eventId ? { status: 'exists', memo: existing } : { status: 'conflict' };
      const event = await this.getEvent(input.eventId);
      if (!event || event.deletedAt !== null) return { status: 'event_missing' };
      const [count] = await this.#db.query<{ n: number }>(
        'SELECT COUNT(*) AS n FROM memos WHERE event_id = ? AND deleted_at IS NULL',
        [input.eventId],
      );
      if ((count?.n ?? 0) >= input.maxMemos) return { status: 'limit' };
      const seq = event.childSeq + 1;
      const [, bumped] = await this.#db.batch([
        {
          sql: `INSERT INTO memos (id, event_id, author_id, seq, doc, updated_at)
                SELECT ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM events WHERE id = ? AND child_seq = ? AND deleted_at IS NULL)
                ON CONFLICT (id) DO NOTHING`,
          args: [input.memoId, input.eventId, input.authorId, seq, JSON.stringify(input.doc), input.now, input.eventId, event.childSeq],
        },
        bumpChildSeq(input.eventId, event.childSeq, input.memoId),
      ]);
      if (bumped === 1) {
        const memo: MemoRecord = {
          id: input.memoId, eventId: input.eventId, authorId: input.authorId, seq, doc: input.doc, updatedAt: input.now, deletedAt: null,
        };
        return { status: 'created', memo: structuredClone(memo) };
      }
    }
    throw new StoreBusyError();
  }

  async patchMemo(input: PatchMemoInput): Promise<MemoWriteOutcome> {
    return this.#writeMemo(input.eventId, input.memoId, (memo) => {
      const result = applyPatch(memo.doc, input.patch);
      if (Object.keys(result.applied).length === 0) return null;
      return { doc: result.doc, now: input.now, deleted: false };
    });
  }

  async deleteMemo(eventId: string, memoId: string, now: number): Promise<MemoWriteOutcome> {
    return this.#writeMemo(eventId, memoId, () => ({ doc: {}, now, deleted: true }));
  }

  async getMemo(memoId: string): Promise<MemoRecord | null> {
    const [row] = await this.#db.query<MemoRow>('SELECT * FROM memos WHERE id = ?', [memoId]);
    return row ? toMemo(row) : null;
  }

  async listChildren(eventId: string, after: number): Promise<ChildrenPage | null> {
    const event = await this.getEvent(eventId);
    if (!event) return null;
    const rows = await this.#db.query<MemoRow>('SELECT * FROM memos WHERE event_id = ? AND seq > ? ORDER BY seq', [eventId, after]);
    return { memos: rows.map(toMemo), seq: event.childSeq, purgedSeq: event.childPurgedSeq };
  }

  async listMemos(eventId: string): Promise<MemoRecord[]> {
    const rows = await this.#db.query<MemoRow>('SELECT * FROM memos WHERE event_id = ? AND deleted_at IS NULL ORDER BY seq', [eventId]);
    return rows.map(toMemo);
  }

  async purgeMemoTombstones(before: number, limit: number): Promise<number> {
    const rows = await this.#db.query<{ id: string; event_id: string; seq: number }>(
      'SELECT id, event_id, seq FROM memos WHERE deleted_at IS NOT NULL AND deleted_at < ? ORDER BY deleted_at, id LIMIT ?',
      [before, limit],
    );
    if (rows.length === 0) return 0;
    const highest = new Map<string, number>();
    for (const r of rows) highest.set(r.event_id, Math.max(highest.get(r.event_id) ?? 0, r.seq));
    await this.#db.batch([
      { sql: 'DELETE FROM memos WHERE id IN (SELECT value FROM json_each(?))', args: [JSON.stringify(rows.map((r) => r.id))] },
      ...[...highest].map(([eventId, seq]) => ({
        sql: 'UPDATE events SET child_purged_seq = MAX(child_purged_seq, ?) WHERE id = ?',
        args: [seq, eventId],
      })),
    ]);
    return rows.length;
  }

  // ---- Helpers ----

  async #identityAccount(provider: string, subject: string): Promise<string | null> {
    const [row] = await this.#db.query<{ account_id: string }>(
      'SELECT account_id FROM identities WHERE provider = ? AND subject = ?',
      [provider, subject],
    );
    return row?.account_id ?? null;
  }

  async #account(id: string): Promise<AccountRecord> {
    const account = await this.getAccount(id);
    if (!account) throw new Error('identity without an account');
    return account;
  }

  /** Display names of the owner and the members of each event, owner first. */
  async #people(eventIds: readonly string[]): Promise<Map<string, PersonOnEvent[]>> {
    const out = new Map<string, PersonOnEvent[]>();
    if (eventIds.length === 0) return out;
    const rows = await this.#db.query<{ event_id: string; name: string; role: string }>(
      `SELECT e.id AS event_id, a.display_name AS name, 'owner' AS role, 0 AS joined, '' AS account_id
       FROM events e JOIN accounts a ON a.id = e.owner_id WHERE e.id IN (SELECT value FROM json_each(?1))
       UNION ALL
       SELECT m.event_id, a.display_name, m.role, m.created_at + 1, m.account_id
       FROM members m JOIN accounts a ON a.id = m.account_id
       WHERE m.event_id IN (SELECT value FROM json_each(?1)) AND m.role IN ('viewer', 'editor')
       ORDER BY event_id, joined, account_id`,
      [JSON.stringify(eventIds)],
    );
    for (const r of rows) {
      const list = out.get(r.event_id) ?? [];
      list.push({ name: r.name, role: r.role as PersonOnEvent['role'] });
      out.set(r.event_id, list);
    }
    return out;
  }

  /** A memo write that bumps the child sequence; `change` returns null when nothing changes. */
  async #writeMemo(
    eventId: string,
    memoId: string,
    change: (memo: MemoRecord) => { doc: JsonObject; now: number; deleted: boolean } | null,
  ): Promise<MemoWriteOutcome> {
    for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt++) {
      const memo = await this.getMemo(memoId);
      const event = await this.getEvent(eventId);
      if (!memo || memo.eventId !== eventId || memo.deletedAt !== null || !event || event.deletedAt !== null) return { status: 'not_found' };
      const next = change(memo);
      if (next === null) return { status: 'ok', memo, changed: false };
      const seq = event.childSeq + 1;
      const [, bumped] = await this.#db.batch([
        {
          sql: `UPDATE memos SET doc = ?, seq = ?, updated_at = ?, deleted_at = ?
                WHERE id = ? AND seq = ? AND deleted_at IS NULL
                AND EXISTS (SELECT 1 FROM events WHERE id = ? AND child_seq = ? AND deleted_at IS NULL)`,
          args: [JSON.stringify(next.doc), seq, next.now, next.deleted ? next.now : null, memoId, memo.seq, eventId, event.childSeq],
        },
        bumpChildSeq(eventId, event.childSeq, memoId),
      ]);
      if (bumped === 1) {
        const written: MemoRecord = { ...memo, doc: next.doc, seq, updatedAt: next.now, deletedAt: next.deleted ? next.now : null };
        return { status: 'ok', memo: structuredClone(written), changed: true };
      }
    }
    throw new StoreBusyError();
  }
}

function insertIdentity(identity: IdentityInput, accountId: string, now: number): { sql: string; args: SqlValue[] } {
  return {
    sql: `INSERT INTO identities (provider, subject, account_id, email, email_verified, created_at) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT (provider, subject) DO NOTHING`,
    args: [identity.provider, identity.subject, accountId, identity.email, identity.emailVerified ? 1 : 0, now],
  };
}

/** Raises the child sequence from `from`, only when the memo statement before it wrote the memo at the new seq. */
function bumpChildSeq(eventId: string, from: number, memoId: string): { sql: string; args: SqlValue[] } {
  return {
    sql: `UPDATE events SET child_seq = ? WHERE id = ? AND child_seq = ? AND deleted_at IS NULL
          AND EXISTS (SELECT 1 FROM memos WHERE id = ? AND event_id = ? AND seq = ?)`,
    args: [from + 1, eventId, from, memoId, eventId, from + 1],
  };
}

function toMember(r: MemberRow): MemberRecord {
  return {
    eventId: r.event_id,
    accountId: r.account_id,
    role: r.role as MemberRecord['role'],
    inviteId: r.invite_id,
    archivedAt: r.archived_at,
    reminders: r.reminders === null ? null : (JSON.parse(r.reminders) as JsonObject),
    createdAt: r.created_at,
  };
}

function toMemo(r: MemoRow): MemoRecord {
  return {
    id: r.id,
    eventId: r.event_id,
    authorId: r.author_id,
    seq: r.seq,
    doc: JSON.parse(r.doc) as JsonObject,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  };
}

function toAccount(r: AccountRow): AccountRecord {
  return {
    id: r.id,
    displayName: r.display_name,
    plan: r.plan as Plan,
    planExpiresAt: r.plan_expires_at,
    audioBlocked: r.audio_blocked !== 0,
    mediaBytes: r.media_bytes,
    mediaFiles: r.media_files,
    lastActiveAt: r.last_active_at,
    inactiveNotice1At: r.inactive_notice_1_at,
    inactiveNotice2At: r.inactive_notice_2_at,
    createdAt: r.created_at,
  };
}

function toEvent(r: EventRow): EventRecord {
  return {
    id: r.id,
    ownerId: r.owner_id,
    rev: r.rev,
    doc: JSON.parse(r.doc) as JsonObject,
    audioKind: r.audio_kind as AudioKind | null,
    audioSetBy: r.audio_set_by,
    audioMediaId: r.audio_media_id,
    childSeq: r.child_seq,
    childPurgedSeq: r.child_purged_seq,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  };
}

function toRevision(r: RevisionRow): RevisionRecord {
  return {
    eventId: r.event_id,
    rev: r.rev,
    authorId: r.author_id,
    createdAt: r.created_at,
    patch: JSON.parse(r.patch) as JsonObject,
    inverse: JSON.parse(r.inverse) as JsonObject,
    overwrote: r.overwrote === null ? [] : (JSON.parse(r.overwrote) as string[]),
    restoredFrom: r.restored_from,
  };
}

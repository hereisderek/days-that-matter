// Store over an SqlDriver (D1, node:sqlite, libSQL), schema in backend/core/migrations/.
//
// D1 and libSQL over HTTP have no interactive transactions, so a write reads, computes, then commits
// one batch whose statements only apply while the row is still at the rev it read. When another
// write got there first, the batch changes nothing and the write starts again.
import type { Plan } from '../contract/index.ts';
import { applyEventPatch, overwrittenFields } from '../rules/merge.ts';
import type { JsonObject } from '../rules/merge.ts';
import type { SqlDriver, SqlValue } from '../ports/sql.ts';
import { StoreBusyError } from '../ports/store.ts';
import type {
  AccountRecord,
  AudioKind,
  CreateAccountResult,
  CreateEventResult,
  EventRecord,
  NewAccount,
  NewEvent,
  PatchInput,
  PatchOutcome,
  RevisionQuery,
  RevisionRecord,
  Store,
} from '../ports/store.ts';
import { WRITE_ATTEMPTS, audioColumns } from './records.ts';

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

const EVENT_COLUMNS =
  'id, owner_id, rev, doc, audio_kind, audio_set_by, audio_media_id, child_seq, child_purged_seq, updated_at, deleted_at';

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
    const [changed] = await this.#db.batch([
      {
        sql: `INSERT INTO events (id, owner_id, rev, doc, audio_kind, audio_set_by, audio_media_id, updated_at)
              VALUES (?, ?, 1, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`,
        args: [input.id, input.ownerId, JSON.stringify(input.doc), audio.audioKind, audio.audioSetBy, audio.audioMediaId, input.now],
      },
    ]);
    const event = await this.getEvent(input.id);
    if (!event) throw new Error('event missing after insert');
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

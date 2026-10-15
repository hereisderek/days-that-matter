# Persistence & Synchronization Specification

Behavior requirements: `event-sync` and `event-history` specs in the OpenSpec change [`pluggable-backend-live-sharing`](../../openspec/changes/pluggable-backend-live-sharing/); archive, pins and reminders in the change [`design-v2-features`](../../openspec/changes/design-v2-features/). Backend side: [`BACKEND.md`](BACKEND.md).

## 1. Offline-First Principles
- All event creations, edits, deletions, and memo logs execute locally first against the SQLite database via **Room KMP**.
- User actions return immediate optimistic UI updates without blocking on network round-trips.
- Signed-in users sync everything: events and memos now, comments when they ship. Local mode syncs nothing; Sync, Share and Invite show the sign-in prompt (see [`auth/SPEC.md`](../features/auth/SPEC.md)).
- Sync runs automatically within 2 seconds of each saved edit, on app start and on foreground. The **Sync button** runs it at once, shows "Synced just now" and the hint "Changes sync automatically after each edit".

---

## 2. Local Database: Room Multiplatform (Room KMP 2.7+)

### 2.1 Database Schema Definition
Implemented in `:core:database` (schema version 2, exported to `core/database/schemas/`). Version 1 held only `app_meta`, a key-value table kept for sync cursors; version 2 adds `events` and `memos` by an automatic, additive migration.

```kotlin
package dev.derek.daysthatmatter.core.database.event

@Entity(tableName = "events", indices = [Index("archived_at"), Index("pinned_at")])
data class EventEntity(
    @PrimaryKey val id: String,                                             // uuid, generated on the device
    val title: String,
    val emoji: String?,
    val notes: String?,                                                     // owner only, never received for shared-with-me events
    @ColumnInfo(name = "target_date") val targetDateEpochDays: Int,
    @ColumnInfo(name = "target_time_seconds") val targetTimeSeconds: Int?,
    @ColumnInfo(name = "time_zone") val timeZone: String?,                  // IANA id, null = floating
    @ColumnInfo(name = "unit_mode") val unitMode: String,                   // auto, days, weeks, hours, calendar, workdays
    @ColumnInfo(name = "recurrence_json") val recurrenceJson: String,
    @ColumnInfo(name = "theme_json") val themeJson: String,                 // includes size (small, medium, large)
    @ColumnInfo(name = "backdrop_json") val backdropJson: String?,          // kind, stillId, motionId, dim, blur, local cache paths
    @ColumnInfo(name = "audio_json") val audioJson: String?,                // built-in trackId, custom mediaId/title, or Spotify url/title/artist
    @ColumnInfo(name = "pinned_at") val pinnedAtEpochMillis: Long?,         // owner only; null = not pinned; always null for shared-with-me events
    @ColumnInfo(name = "archived_at") val archivedAtEpochMillis: Long?,     // owner-only field, or the member's own archive (membership)
    @ColumnInfo(name = "reminders_json") val remindersJson: String?,        // owner-only field, or the member's own reminders (membership)
    @ColumnInfo(name = "category_id") val categoryId: String?,              // local only for shared-with-me events
    @ColumnInfo(name = "role") val role: String,                            // owner, editor, viewer
    @ColumnInfo(name = "server_rev") val serverRev: Long?,                  // null = never on the backend
    @ColumnInfo(name = "child_seq") val childSeq: Long = 0,                 // last memo seq applied (owner only)
    @ColumnInfo(name = "pending_patch") val pendingPatch: String?,          // JSON: fields changed since server_rev
    @ColumnInfo(name = "is_deleted") val isDeleted: Boolean = false,        // pending delete (or leave, for shared-with-me events)
    @ColumnInfo(name = "created_at") val createdAtEpochMillis: Long,
    @ColumnInfo(name = "updated_at") val updatedAtEpochMillis: Long
)

@Entity(tableName = "memos", indices = [Index("event_id")])
data class MemoEntity(
    @PrimaryKey val id: String,                                             // uuid, generated on the device
    @ColumnInfo(name = "event_id") val eventId: String,
    val content: String,
    @ColumnInfo(name = "milestone_tag") val milestoneTag: String?,
    @ColumnInfo(name = "seq") val seq: Long?,                               // null = never on the backend
    @ColumnInfo(name = "pending_patch") val pendingPatch: String?,
    @ColumnInfo(name = "is_deleted") val isDeleted: Boolean = false,
    @ColumnInfo(name = "created_at") val createdAtEpochMillis: Long,
    @ColumnInfo(name = "updated_at") val updatedAtEpochMillis: Long
)

@Dao
abstract class EventDao {
    // Home: not deleted, not archived; category and title filters; pinned first, newest pin first, then by date.
    // The user's sort (closest, furthest, A to Z, recently added) is applied on top with the countdown engine.
    @Query("""SELECT * FROM events WHERE is_deleted = 0 AND archived_at IS NULL
        AND (:categoryId IS NULL OR category_id = :categoryId) AND title LIKE :titlePattern ESCAPE '\'
        ORDER BY pinned_at IS NULL, pinned_at DESC, target_date ASC, title ASC""")
    abstract fun observeHome(titlePattern: String = "%", categoryId: String? = null): Flow<List<EventEntity>>

    abstract fun observeArchived(): Flow<List<EventEntity>>                 // archived_at DESC
    abstract fun observeArchivedCount(): Flow<Int>                          // the "Archived · N" row
    abstract fun observeById(id: String): Flow<EventEntity?>                // hides deleted rows
    abstract suspend fun getById(id: String): EventEntity?                  // includes deleted rows (undo, sync)
    abstract suspend fun upsert(event: EventEntity)
    abstract suspend fun markDeleted(id: String, now: Long)
    abstract suspend fun restore(id: String, now: Long)                     // undo of markDeleted
    abstract suspend fun getPending(): List<EventEntity>                    // server_rev IS NULL OR pending_patch IS NOT NULL OR is_deleted = 1
    @Transaction open suspend fun update(id: String, transform: (EventEntity) -> EventEntity?): EventEntity?
}
```

- Nested objects are JSON columns in the API form of `:core:model` (`ModelJson`), so the sync engine sends them unchanged. Mappers `EventEntity.toEventDoc()` and `EventDoc.toEntity(EventRowMeta)` convert rows to and from `EventDoc`; `Memo` maps the same way.
- A local edit (`EventEntity.withLocalEdit`) writes the new document and `updated_at`, and, for a row that is on the backend (`server_rev` set), adds the changed writable fields to `pending_patch` (a cleared field is `null`). A row never synced keeps no patch: the sync engine sends it whole with `PUT`.
- Archiving writes `archivedAt` and clears `pinnedAt` in the same edit; unarchiving clears only `archivedAt` (design-v2 D4).
- `MemoDao`: memos of a day oldest first, the count, upsert, `markDeleted`, `getPending`.

The session token is kept in secure storage (Keychain, EncryptedSharedPreferences), never in Room. Links, invites and people are not cached in Room; the share screen loads them from the backend. The custom audio library is not in Room either: the audio picker loads `GET /me/library` (ETag) and keeps the last response for offline use. Push registration (`PUT /me/devices/{installId}`) is not part of sync.

---

## 3. Sync Protocol

Shared rules (`:core:model`): field sets, validation, patch apply, plan table. The app and the backend apply the same rules.

1. **Push** (signed in only), in order of `updated_at`:
   - Pending backdrop files are uploaded first (`POST /events/{id}/media`), and pending custom audio files to the library (`POST /me/library`); the returned ids replace the local paths in the patch.
   - Events with `server_rev == null`: `PUT /events/{id}` with the full document. Events created while signed in and offline are sent together with `POST /events/batch` (up to 100 per request). Local-mode events are never pushed this way; they reach an account only through the import (section 5).
   - `is_deleted`: `DELETE /events/{id}` (owner), or leave (`DELETE /events/{id}/members/me`) for shared-with-me events. On success the row is removed.
   - For shared-with-me events, `archivedAt` and `reminders` in `pending_patch` go to `PATCH /events/{id}/membership` (`{archived, reminders}`); they never reach the event.
   - Otherwise: `PATCH /events/{id}` with `{baseRev: server_rev, patch: pending_patch}`. On success, store the returned document and `rev`, clear `pending_patch`. If `overwritten` is not empty, show a notice naming the replaced fields.
   - Memos: `PUT`, `PATCH` or `DELETE /events/{id}/memos/{memoId}` the same way.
2. **Pull**:
   - `GET /sync` with `If-None-Match`. A `304` ends the sync.
   - Fetch every event whose manifest `rev` differs from `server_rev` with `POST /events/fetch` in batches of 100. Write each, then re-apply the local `pending_patch` on top so the screen keeps showing the user's unsent change.
   - For owned events whose `childSeq` differs: `GET /events/{id}/children?after={child_seq}`, apply memos and deletions, store the new `child_seq`. On `reset: true`, replace that event's synced memos with the returned list (unsent local memos stay).
   - Remove local rows with a `server_rev` that are missing from the manifest (deleted by the owner, or access removed).
3. **Merge**: the backend keeps the newest write per field and records every event write as a revision (see `BACKEND.md` section 7). The app never shows a conflict dialog.
4. **Errors**: `401` asks the user to sign in again and keeps local data. `403 field_not_allowed` or `400 invalid_payload` drops the patch fields named in `details` and reports it. `402 premium_required` reverts that field locally and shows the paywall. `429` and `503` retry with backoff.
5. **Live**: while a shared event is open, the app listens for change notices (WebSocket or polling, from `GET /health`) and refetches that event.
6. **Network-only actions**: creating and revoking links and invites, member changes, joining through an invite and history restore need a connection. The app disables them offline.

---

## 4. Shared Events
An event is shared through links and people grants that point at the backend copy of the event. There are no snapshots and no manage tokens. Details: [`docs/features/sharing/SPEC.md`](../features/sharing/SPEC.md).

---

## 5. Local and account databases, the sync flag and the import journal

Normative: `local-mode` spec; decision D20 in the change design. Task 12.5 and 12.9.

### 5.1 Two kinds of database
- **Local database:** the events, memos and settings of local mode. It never syncs and exists once per install.
- **Account database:** one per signed-in account, holding that account's events, memos, sync cursors and pending changes. Signing in opens it; signing out syncs and hides it, and it is removed once nothing is pending. Widgets, reminders and notifications follow the database they belong to.
- Events move between them only by the import (5.3); nothing is merged field by field.

### 5.2 The sync flag on changes
Every change is stored with a flag saying whether the server has it, until the server confirms it. Options:
1. **Keep `pending_patch` and `is_deleted` as the flag** (as now): a row is unsent when `server_rev IS NULL OR pending_patch IS NOT NULL OR is_deleted = 1` (`getPending`). No schema change; the flag is derived, so it cannot disagree with the data.
2. **Add an explicit `sync_state`** (`synced`, `pending`, `failed`): one indexed column, simple "N changes not sent" counts and a place to record a rejected change. It must be kept in step with `pending_patch` in every write, which is a source of bugs.

Recommendation: option 1, plus a derived `observePendingCount()` query. Add `sync_state` later only if a rejected-change state is needed. Sign-out waits until `getPending()` is empty for events and memos, or the user accepts the "not everything has been sent" message.

### 5.3 The import journal
A table `import_journal` in the account database (one row per import): `id`, `started_at`, `source` (local mode or a file), `event_ids`, and `state`:
- `pending`: confirmed, nothing sent.
- `uploaded`: `POST /events/import` answered.
- `verified`: the answer lists every id and no unstored field.
- `copied`: the events are written to the account database in one transaction.
- `removed`: the local events are gone.
A crash resumes from the recorded state: `pending` retries (the endpoint is idempotent by id), `uploaded` verifies again, `verified` copies, `copied` removes. Local events are removed only from `copied`, which follows `verified`. Any failure before that leaves them untouched and shows Try again; an unrecoverable failure is explained, skipped, kept local and recorded for diagnostics (analytics to-do in [`docs/plans/TODO.md`](../plans/TODO.md)).

# Persistence & Synchronization Specification

Behavior requirements: `event-sync` and `event-history` specs in the OpenSpec change [`pluggable-backend-live-sharing`](../../openspec/changes/pluggable-backend-live-sharing/). Backend side: [`BACKEND.md`](BACKEND.md).

## 1. Offline-First Principles
- All event creations, edits, deletions, and memo logs execute locally first against the SQLite database via **Room KMP**.
- User actions return immediate optimistic UI updates without blocking on network round-trips.
- The sync engine talks to our backend API (Ktor). It runs when the network is available, on app start and foreground, and within 2 seconds of saving a shared event.
- Which events go to the backend: all events of a signed-in user with sync on; only shared events of an anonymous account; none for a guest who has not shared.

---

## 2. Local Database: Room Multiplatform (Room KMP 2.7+)

### 2.1 Database Schema Definition
```kotlin
package dev.derek.daysthatmatter.core.database

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "events")
data class EventEntity(
    @PrimaryKey val id: String,                                             // uuid, generated on the device
    val title: String,
    val emoji: String?,
    val notes: String?,                                                     // owner only, never received for shared-with-me events
    @ColumnInfo(name = "target_date") val targetDateEpochDays: Int,
    @ColumnInfo(name = "target_time_seconds") val targetTimeSeconds: Int?,
    @ColumnInfo(name = "time_zone") val timeZone: String?,                  // IANA id, null = floating
    @ColumnInfo(name = "unit_mode") val unitMode: String,                   // auto, days, calendar
    @ColumnInfo(name = "recurrence_json") val recurrenceJson: String,
    @ColumnInfo(name = "theme_json") val themeJson: String,
    @ColumnInfo(name = "backdrop_json") val backdropJson: String?,          // mediaId, posterId, dim, local cache paths
    @ColumnInfo(name = "is_pinned") val isPinned: Boolean,                  // local only for shared-with-me events
    @ColumnInfo(name = "category_id") val categoryId: String?,              // local only for shared-with-me events
    @ColumnInfo(name = "role") val role: String,                            // owner, editor, viewer
    @ColumnInfo(name = "server_rev") val serverRev: Int?,                   // null = never on the backend
    @ColumnInfo(name = "pending_patch") val pendingPatch: String?,          // JSON: fields changed since server_rev
    @ColumnInfo(name = "is_deleted") val isDeleted: Boolean = false,        // pending delete
    @ColumnInfo(name = "created_at") val createdAtEpochMillis: Long,
    @ColumnInfo(name = "updated_at") val updatedAtEpochMillis: Long
)

@Dao
interface EventDao {
    @Query("SELECT * FROM events WHERE is_deleted = 0 ORDER BY is_pinned DESC, target_date ASC")
    fun observeEvents(): Flow<List<EventEntity>>

    @Query("SELECT * FROM events WHERE id = :id AND is_deleted = 0")
    fun observeEventById(id: String): Flow<EventEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(event: EventEntity)

    @Query("UPDATE events SET is_deleted = 1, updated_at = :now WHERE id = :id")
    suspend fun markDeleted(id: String, now: Long)

    @Query("SELECT * FROM events WHERE pending_patch IS NOT NULL OR is_deleted = 1")
    suspend fun getPending(): List<EventEntity>
}
```

The session token and the install secret are kept in secure storage (Keychain, EncryptedSharedPreferences), never in Room. Links, invites and people are not cached in Room; the share screen loads them from the backend.

---

## 3. Sync Protocol

Shared rules (`:core:model`): field sets, validation, patch apply. The same code runs in the app and on the server.

1. **Push**, for each event from `getPending()`, in order of `updated_at`:
   - Pending backdrop files are uploaded first (`POST /events/{id}/media`); the returned `mediaId` replaces the local path in the patch.
   - `server_rev == null`: `PUT /events/{id}` with the full document. The response sets `server_rev`.
   - `is_deleted`: `DELETE /events/{id}` (owner), or leave (`DELETE /events/{id}/people/me`) for shared-with-me events. On success the row is removed.
   - Otherwise: `PATCH /events/{id}` with `{baseRev: server_rev, patch: pending_patch}`. On success, store the returned document and `rev`, clear `pending_patch`. If `overwritten` is not empty, show a notice naming the replaced fields.
2. **Pull**:
   - `GET /events` with `If-None-Match`. A `304` ends the sync.
   - Fetch every id whose manifest `rev` differs from `server_rev` with `POST /events/fetch` in batches of 100.
   - For each fetched document: write it, then re-apply the local `pending_patch` on top if there is one, so the screen keeps showing the user's unsent change.
   - Remove local rows with a `server_rev` that are missing from the manifest (deleted by the owner, or access removed). Local-only rows (`server_rev == null`) stay.
3. **Merge**: the backend keeps the newest write per field and records every write as a revision (see `BACKEND.md` section 7). The app never shows a conflict dialog.
4. **Errors**: `401` asks the user to sign in again and keeps local data. `403 field_not_allowed` or `400 invalid_payload` drops the patch fields named in `details` and reports it. `429` and `503` retry with backoff.
5. **Live**: while a shared event is open, the app listens for change notices (WebSocket or polling, from `GET /health`) and refetches that event.
6. **Network-only actions**: creating and revoking links, invites, people changes and history restore need a connection. The app disables them offline.

---

## 4. Shared Events
An event is shared through links and people grants that point at the backend copy of the event. There are no snapshots and no manage tokens. Details: [`docs/features/sharing/SPEC.md`](../features/sharing/SPEC.md).

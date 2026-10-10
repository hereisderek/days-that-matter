# Persistence & Cloud Synchronization Specification

## 1. Offline-First Principles
Days That Matter prioritizes complete offline functionality:
- All event creations, edits, deletions, and memo logs execute locally first against the SQLite database via **Room KMP**.
- User actions return immediate optimistic UI updates without blocking on network round-trips.
- Background sync engine synchronizes changes with Firebase Cloud Firestore when network connectivity is available.

---

## 2. Local Database: Room Multiplatform (Room KMP 2.7+)

### 2.1 Database Schema Definition
```kotlin
package dev.derek.daysthatmatter.core.database

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "events")
data class EventEntity(
    @PrimaryKey val id: String,
    val title: String,
    val notes: String?,
    @ColumnInfo(name = "target_date") val targetDateEpochDays: Int,
    @ColumnInfo(name = "target_time_seconds") val targetTimeSeconds: Int?,
    @ColumnInfo(name = "recurrence_type") val recurrenceType: String,
    @ColumnInfo(name = "recurrence_payload") val recurrencePayload: String?,
    @ColumnInfo(name = "is_pinned") val isPinned: Boolean,
    @ColumnInfo(name = "category_id") val categoryId: String?,
    @ColumnInfo(name = "customization_json") val customizationJson: String,
    @ColumnInfo(name = "owner_id") val ownerId: String,
    @ColumnInfo(name = "is_deleted") val isDeleted: Boolean = false,
    @ColumnInfo(name = "sync_status") val syncStatus: String, // Synced, PendingUpload, PendingDelete
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

    @Query("UPDATE events SET is_deleted = 1, sync_status = 'PendingDelete', updated_at = :now WHERE id = :id")
    suspend fun markDeleted(id: String, now: Long)

    @Query("SELECT * FROM events WHERE sync_status != 'Synced'")
    suspend fun getPendingSyncEvents(): List<EventEntity>
}
```

---

## 3. Remote Cloud Synchronization (Firestore)

### 3.1 Sync Protocol
1. **Push Phase:** Query all local entities where `sync_status != 'Synced'`.
   - If `PendingUpload`: Upsert to Firestore collection `/users/{userId}/events/{eventId}`. On success, update local `sync_status = 'Synced'`.
   - If `PendingDelete`: Delete Firestore document `/users/{userId}/events/{eventId}`. On success, permanently purge entity from local database.
2. **Pull Phase:** Listen to or query Firestore changes since `lastSyncTimestamp`.
   - For each remote document: compare `updated_at` against local `updated_at`.
   - **Conflict Resolution (Last-Write-Wins):** If remote `updated_at > local updated_at`, overwrite local cache. Otherwise, trigger local push to overwrite stale remote data.

---

## 4. Shared Event Links
Share links are not stored in Firestore. They are handled by the share service (Cloudflare Worker + D1), see [`SHARE_SERVICE.md`](SHARE_SERVICE.md). The local database keeps a `shares` table (eventId, shareToken, expiresAt, revokedAt, syncStatus). The `manageToken` is kept in secure storage, not in Room or Firestore. Creating, updating and revoking a share are queued as pending operations in the sync engine.

package dev.derek.daysthatmatter.core.database.memo

import androidx.room.Dao
import androidx.room.Query
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow

/** Reads and writes [MemoEntity] rows. Rows marked deleted are hidden from every read except [getPending]. */
@Dao
interface MemoDao {
    /** Memos of one day, oldest first (the timeline order of docs/features/memos/SPEC.md). */
    @Query("SELECT * FROM memos WHERE event_id = :eventId AND is_deleted = 0 ORDER BY created_at ASC, id ASC")
    fun observeByEvent(eventId: String): Flow<List<MemoEntity>>

    @Query("SELECT COUNT(*) FROM memos WHERE event_id = :eventId AND is_deleted = 0")
    fun observeCount(eventId: String): Flow<Int>

    @Upsert
    suspend fun upsert(memo: MemoEntity)

    @Query("UPDATE memos SET is_deleted = 1, updated_at = :now WHERE id = :id")
    suspend fun markDeleted(id: String, now: Long)

    @Query("SELECT * FROM memos WHERE seq IS NULL OR pending_patch IS NOT NULL OR is_deleted = 1 ORDER BY updated_at ASC")
    suspend fun getPending(): List<MemoEntity>
}

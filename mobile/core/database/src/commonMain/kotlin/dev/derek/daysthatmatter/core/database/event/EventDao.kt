package dev.derek.daysthatmatter.core.database.event

import androidx.room.Dao
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow

/**
 * Reads and writes [EventEntity] rows. Rows marked deleted are hidden from every read except [getPending].
 *
 * Home order: pinned days first, newest pin first (design-v2 D5), then by target date. The Home sort chosen
 * by the user is applied on top of this by the caller, because it needs the countdown engine.
 */
@Dao
abstract class EventDao {

    /**
     * Days shown on Home: not deleted, not archived. [categoryId] null means every category. [titlePattern]
     * is a LIKE pattern with `\` as the escape character (see [likePattern]); `%` matches every title.
     */
    @Query(
        """
        SELECT * FROM events
        WHERE is_deleted = 0 AND archived_at IS NULL
          AND (:categoryId IS NULL OR category_id = :categoryId)
          AND title LIKE :titlePattern ESCAPE '\'
        ORDER BY pinned_at IS NULL, pinned_at DESC, target_date ASC, title ASC
        """,
    )
    abstract fun observeHome(titlePattern: String = "%", categoryId: String? = null): Flow<List<EventEntity>>

    /** Archived days, most recently archived first. */
    @Query("SELECT * FROM events WHERE is_deleted = 0 AND archived_at IS NOT NULL ORDER BY archived_at DESC, title ASC")
    abstract fun observeArchived(): Flow<List<EventEntity>>

    @Query("SELECT COUNT(*) FROM events WHERE is_deleted = 0 AND archived_at IS NOT NULL")
    abstract fun observeArchivedCount(): Flow<Int>

    @Query("SELECT * FROM events WHERE id = :id AND is_deleted = 0")
    abstract fun observeById(id: String): Flow<EventEntity?>

    /** The row with [id], also when it is marked deleted (undo and the sync engine need it). */
    @Query("SELECT * FROM events WHERE id = :id")
    abstract suspend fun getById(id: String): EventEntity?

    /** Rows that are not deleted, archived ones included. */
    @Query("SELECT COUNT(*) FROM events WHERE is_deleted = 0")
    abstract suspend fun countVisible(): Int

    @Upsert
    abstract suspend fun upsert(event: EventEntity)

    @Upsert
    abstract suspend fun upsertAll(events: List<EventEntity>)

    @Query("UPDATE events SET is_deleted = 1, updated_at = :now WHERE id = :id")
    abstract suspend fun markDeleted(id: String, now: Long)

    @Query("UPDATE events SET is_deleted = 0, updated_at = :now WHERE id = :id")
    abstract suspend fun restore(id: String, now: Long)

    /** Rows the sync engine has to send: new, changed or deleted. */
    @Query("SELECT * FROM events WHERE server_rev IS NULL OR pending_patch IS NOT NULL OR is_deleted = 1 ORDER BY updated_at ASC")
    abstract suspend fun getPending(): List<EventEntity>

    /**
     * Reads the row with [id], lets [transform] change it and writes the result, in one transaction.
     * Returns the written row, or null when there is no row or [transform] returns null (nothing written).
     */
    @Transaction
    open suspend fun update(id: String, transform: (EventEntity) -> EventEntity?): EventEntity? {
        val current = getById(id) ?: return null
        val updated = transform(current) ?: return null
        upsert(updated)
        return updated
    }

    companion object {
        /** A LIKE pattern that matches titles containing [text] (ASCII case-insensitive), with `%`, `_` and `\` escaped. */
        fun likePattern(text: String): String {
            val escaped = buildString {
                text.trim().forEach { c ->
                    if (c == '%' || c == '_' || c == '\\') append('\\')
                    append(c)
                }
            }
            return "%$escaped%"
        }
    }
}

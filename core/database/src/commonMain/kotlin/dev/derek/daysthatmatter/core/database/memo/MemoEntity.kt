package dev.derek.daysthatmatter.core.database.memo

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/** A memo of one of the owner's days (docs/architecture/PERSISTENCE_AND_SYNC.md section 2.1). Owner only. */
@Entity(tableName = "memos", indices = [Index("event_id")])
data class MemoEntity(
    @PrimaryKey val id: String,
    @ColumnInfo(name = "event_id") val eventId: String,
    val content: String,
    @ColumnInfo(name = "milestone_tag") val milestoneTag: String?,
    /** null = never on the backend. */
    @ColumnInfo(name = "seq") val seq: Long?,
    @ColumnInfo(name = "pending_patch") val pendingPatch: String?,
    @ColumnInfo(name = "is_deleted") val isDeleted: Boolean = false,
    @ColumnInfo(name = "created_at") val createdAtEpochMillis: Long,
    @ColumnInfo(name = "updated_at") val updatedAtEpochMillis: Long,
)

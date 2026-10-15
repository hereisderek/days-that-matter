package dev.derek.daysthatmatter.core.database.event

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * One day (event) on this device: the owner's own days and days shared with the account
 * (docs/architecture/PERSISTENCE_AND_SYNC.md section 2.1). Nested objects are JSON columns in the API form
 * of `:core:model` ([dev.derek.daysthatmatter.core.model.ModelJson]), so the sync engine sends them as they are.
 */
@Entity(
    tableName = "events",
    indices = [Index("archived_at"), Index("pinned_at")],
)
data class EventEntity(
    @PrimaryKey val id: String,
    val title: String,
    val emoji: String?,
    /** Owner only; never received for shared-with-me events. */
    val notes: String?,
    @ColumnInfo(name = "target_date") val targetDateEpochDays: Int,
    @ColumnInfo(name = "target_time_seconds") val targetTimeSeconds: Int?,
    /** IANA id; null = floating. */
    @ColumnInfo(name = "time_zone") val timeZone: String?,
    /** API value: auto, days, weeks, hours, calendar, workdays. */
    @ColumnInfo(name = "unit_mode") val unitMode: String,
    @ColumnInfo(name = "recurrence_json") val recurrenceJson: String,
    /** Includes `size` (small, medium, large). */
    @ColumnInfo(name = "theme_json") val themeJson: String,
    @ColumnInfo(name = "backdrop_json") val backdropJson: String?,
    @ColumnInfo(name = "audio_json") val audioJson: String?,
    /** Owner only; null = not pinned; always null for shared-with-me events. */
    @ColumnInfo(name = "pinned_at") val pinnedAtEpochMillis: Long?,
    /** Owner-only field, or the member's own archive (membership). */
    @ColumnInfo(name = "archived_at") val archivedAtEpochMillis: Long?,
    /** Owner-only field, or the member's own reminders (membership). */
    @ColumnInfo(name = "reminders_json") val remindersJson: String?,
    /** Local only for shared-with-me events. */
    @ColumnInfo(name = "category_id") val categoryId: String?,
    /** API value: owner, editor, viewer. */
    @ColumnInfo(name = "role") val role: String,
    /** null = never on the backend. */
    @ColumnInfo(name = "server_rev") val serverRev: Long?,
    /** Last memo seq applied (owner only). */
    @ColumnInfo(name = "child_seq") val childSeq: Long = 0,
    /** JSON object: fields changed since [serverRev]. Only kept for rows that are on the backend. */
    @ColumnInfo(name = "pending_patch") val pendingPatch: String?,
    /** Pending delete: hidden everywhere, removed after the sync engine sends it. */
    @ColumnInfo(name = "is_deleted") val isDeleted: Boolean = false,
    @ColumnInfo(name = "created_at") val createdAtEpochMillis: Long,
    @ColumnInfo(name = "updated_at") val updatedAtEpochMillis: Long,
)

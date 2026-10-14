package dev.derek.daysthatmatter.core.database.memo

import dev.derek.daysthatmatter.core.model.event.Memo
import kotlin.time.Instant

/** The memo as a `:core:model` document. [Memo.seq] is 0 when it was never synced. */
fun MemoEntity.toMemo(): Memo = Memo(
    id = id,
    eventId = eventId,
    seq = seq ?: 0,
    content = content,
    milestoneTag = milestoneTag,
    createdAt = Instant.fromEpochMilliseconds(createdAtEpochMillis),
    updatedAt = Instant.fromEpochMilliseconds(updatedAtEpochMillis),
)

/** The row for [memo]. [seq] null means it was never on the backend; [updatedAt] defaults to the memo's own. */
fun Memo.toEntity(
    seq: Long? = this.seq.takeIf { it > 0 },
    updatedAt: Instant = this.updatedAt ?: createdAt,
    pendingPatch: String? = null,
    isDeleted: Boolean = false,
): MemoEntity = MemoEntity(
    id = id,
    eventId = eventId,
    content = content,
    milestoneTag = milestoneTag,
    seq = seq,
    pendingPatch = pendingPatch,
    isDeleted = isDeleted,
    createdAtEpochMillis = createdAt.toEpochMilliseconds(),
    updatedAtEpochMillis = updatedAt.toEpochMilliseconds(),
)

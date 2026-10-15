package dev.derek.daysthatmatter.feature.events.domain

import dev.derek.daysthatmatter.core.model.countdown.Countdown
import dev.derek.daysthatmatter.core.model.event.EventDoc
import dev.derek.daysthatmatter.core.model.event.Role
import kotlin.time.Instant

/** A day stored on this device: the `:core:model` document and when it was created here. */
data class StoredEvent(
    val doc: EventDoc,
    val createdAt: Instant,
) {
    val id: String get() = doc.id

    /** The reader's role; a day created on this device has none and belongs to its owner. */
    val role: Role get() = doc.role ?: Role.Owner

    val isOwner: Boolean get() = role == Role.Owner

    val isPinned: Boolean get() = doc.pinnedAt != null

    val isArchived: Boolean get() = doc.archivedAt != null
}

/** A day with its countdown at one instant. */
data class EventCountdown(
    val event: StoredEvent,
    val countdown: Countdown,
)

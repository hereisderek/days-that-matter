package dev.derek.daysthatmatter.core.model.event

import kotlinx.datetime.LocalDate
import kotlinx.datetime.LocalTime
import kotlinx.serialization.Serializable
import kotlin.time.Instant

/**
 * Names of the writable fields of an event document and the sets they belong to
 * (BACKEND.md section 7.2, `event-sync` and `event-sharing` specs).
 */
object EventFields {
    const val TITLE = "title"
    const val EMOJI = "emoji"
    const val TARGET_DATE = "targetDate"
    const val TARGET_TIME = "targetTime"
    const val TIME_ZONE = "timeZone"
    const val UNIT_MODE = "unitMode"
    const val RECURRENCE = "recurrence"
    const val THEME = "theme"
    const val BACKDROP = "backdrop"
    const val AUDIO = "audio"
    const val NOTES = "notes"
    const val PINNED_AT = "pinnedAt"
    const val CATEGORY_ID = "categoryId"
    const val ARCHIVED_AT = "archivedAt"
    const val REMINDERS = "reminders"

    /** Fields every role that can see the event receives; owners and editors write them. */
    val SHARED: Set<String> =
        setOf(TITLE, EMOJI, TARGET_DATE, TARGET_TIME, TIME_ZONE, UNIT_MODE, RECURRENCE, THEME, BACKDROP, AUDIO)

    /** Fields only the owner reads and writes. Memos are owner-only too, as event children. */
    val OWNER_ONLY: Set<String> = setOf(NOTES, PINNED_AT, CATEGORY_ID, ARCHIVED_AT, REMINDERS)

    /** Every field a write may contain. */
    val WRITABLE: Set<String> = SHARED + OWNER_ONLY

    /** Fields a document always has; a patch cannot clear them. */
    val REQUIRED: Set<String> = setOf(TITLE, TARGET_DATE, THEME)

    /** Fields with a default that a patch sets but cannot clear with null. */
    val NOT_NULL: Set<String> = REQUIRED + setOf(UNIT_MODE, RECURRENCE)

    /** Nested objects. A patch replaces them whole (design D5). */
    val OBJECTS: Set<String> = setOf(RECURRENCE, THEME, BACKDROP, AUDIO, REMINDERS)
}

/**
 * An event document as the API returns it (BACKEND.md section 7.2): shared fields, owner-only
 * fields in the owner's projection, and the member view's extras ([members], [archived] and the
 * member's own [reminders]).
 *
 * Owner-only fields: [notes], [pinnedAt] (null = not pinned), [categoryId], [archivedAt]
 * (null = not archived) and, for the owner, [reminders]. See [EventFields].
 */
@Serializable
data class EventDoc(
    val id: String,
    val rev: Long = 0,
    val role: Role? = null,
    val title: String,
    val emoji: String? = null,
    val targetDate: LocalDate,
    @Serializable(with = HmsTimeSerializer::class)
    val targetTime: LocalTime? = null,
    val timeZone: String? = null,
    val unitMode: UnitMode = UnitMode.Auto,
    val recurrence: Recurrence = Recurrence.None,
    val theme: Theme,
    val backdrop: Backdrop? = null,
    val audio: Audio? = null,
    val notes: String? = null,
    val pinnedAt: Instant? = null,
    val categoryId: String? = null,
    val archivedAt: Instant? = null,
    val reminders: Reminders? = null,
    val updatedAt: Instant? = null,
    val members: List<MemberName>? = null,
    val archived: Boolean? = null,
)

/** A person on a shared event, as members see them: display name and role, no account id. */
@Serializable
data class MemberName(val name: String, val role: Role)

/**
 * The event inside a public link view (`GET /links/{token}`): revision and shared fields only.
 * No id, names, account identifiers or custom audio (`event-sharing` spec).
 */
@Serializable
data class PublicEvent(
    val rev: Long,
    val title: String,
    val emoji: String? = null,
    val targetDate: LocalDate,
    @Serializable(with = HmsTimeSerializer::class)
    val targetTime: LocalTime? = null,
    val timeZone: String? = null,
    val unitMode: UnitMode = UnitMode.Auto,
    val recurrence: Recurrence = Recurrence.None,
    val theme: Theme,
    val backdrop: Backdrop? = null,
    val audio: Audio? = null,
)

/**
 * A memo (BACKEND.md section 7.2). Owner-only; synced as an event child with [seq].
 * The stored document holds [content], [milestoneTag] and [createdAt] ([MemoFields]).
 */
@Serializable
data class Memo(
    val id: String,
    val eventId: String,
    val seq: Long = 0,
    val content: String,
    val milestoneTag: String? = null,
    val createdAt: Instant,
    val updatedAt: Instant? = null,
)

/** Writable fields of a memo document. */
object MemoFields {
    const val CONTENT = "content"
    const val MILESTONE_TAG = "milestoneTag"
    const val CREATED_AT = "createdAt"

    val WRITABLE: Set<String> = setOf(CONTENT, MILESTONE_TAG, CREATED_AT)
    val REQUIRED: Set<String> = setOf(CONTENT, CREATED_AT)
}

/** A member's own settings on a shared event (`members.archived_at`, `members.reminders`). */
@Serializable
data class Membership(
    val archivedAt: Instant? = null,
    val reminders: Reminders? = null,
)

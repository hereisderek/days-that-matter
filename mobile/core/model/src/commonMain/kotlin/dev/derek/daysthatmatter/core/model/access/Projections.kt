package dev.derek.daysthatmatter.core.model.access

import dev.derek.daysthatmatter.core.model.api.ApiErrorCode
import dev.derek.daysthatmatter.core.model.event.Audio
import dev.derek.daysthatmatter.core.model.event.EventDoc
import dev.derek.daysthatmatter.core.model.event.EventFields
import dev.derek.daysthatmatter.core.model.event.MemberName
import dev.derek.daysthatmatter.core.model.event.MemberRole
import dev.derek.daysthatmatter.core.model.event.Membership
import dev.derek.daysthatmatter.core.model.event.PublicEvent
import dev.derek.daysthatmatter.core.model.event.Role

/**
 * What each reader of an event receives (`event-sharing` and `event-sync` specs, BACKEND.md 7.2).
 *
 * Only the owner's projection has notes, pin state, category, archive state, the owner's reminders
 * and (as event children) memos. No projection has account identifiers. Public links also drop
 * custom audio, which never plays on the web.
 */
object Projections {
    /** The owner's view: every field. */
    fun owner(doc: EventDoc): EventDoc = doc.copy(role = Role.Owner, members = null, archived = null)

    /**
     * A member's view: shared fields, the member's [role], display names of the owner and members,
     * and the member's own archive and reminders from [membership].
     */
    fun member(doc: EventDoc, role: MemberRole, members: List<MemberName>, membership: Membership): EventDoc =
        EventDoc(
            id = doc.id,
            rev = doc.rev,
            role = role.role,
            title = doc.title,
            emoji = doc.emoji,
            targetDate = doc.targetDate,
            targetTime = doc.targetTime,
            timeZone = doc.timeZone,
            unitMode = doc.unitMode,
            recurrence = doc.recurrence,
            theme = doc.theme,
            backdrop = doc.backdrop,
            audio = doc.audio,
            reminders = membership.reminders,
            updatedAt = doc.updatedAt,
            members = members,
            archived = membership.archivedAt != null,
        )

    /** A public link's view: revision and shared fields, without custom audio. */
    fun publicLink(doc: EventDoc): PublicEvent =
        PublicEvent(
            rev = doc.rev,
            title = doc.title,
            emoji = doc.emoji,
            targetDate = doc.targetDate,
            targetTime = doc.targetTime,
            timeZone = doc.timeZone,
            unitMode = doc.unitMode,
            recurrence = doc.recurrence,
            theme = doc.theme,
            backdrop = doc.backdrop,
            audio = doc.audio.takeUnless { it is Audio.Custom },
        )
}

/** Who may write which event fields (`event-sharing` spec "Members", `event-sync` "Owner-only fields"). */
object WriteAccess {
    /**
     * The error for a write of [fields] by [role], or null when it is allowed: viewers write nothing
     * (`403 forbidden`); editors write shared fields only (`403 field_not_allowed` for owner-only ones).
     */
    fun checkEventWrite(role: Role, fields: Set<String>): ApiErrorCode? = when {
        role == Role.Viewer -> ApiErrorCode.Forbidden
        role == Role.Editor && fields.any { it in EventFields.OWNER_ONLY } -> ApiErrorCode.FieldNotAllowed
        else -> null
    }

    /** Links, invites and members: owner only. */
    fun canManageSharing(role: Role): Boolean = role == Role.Owner

    /** Memos are owner-only. */
    fun canWriteMemos(role: Role): Boolean = role == Role.Owner

    /** History and restore: owner and editors. */
    fun canSeeHistory(role: Role): Boolean = role != Role.Viewer

    fun canDeleteEvent(role: Role): Boolean = role == Role.Owner

    /** Pin and archive on the event are owner-only; members archive on their membership. */
    fun canPin(role: Role): Boolean = role == Role.Owner
}

package dev.derek.daysthatmatter.core.model.event

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * How a day shows its countdown or count-up (`unitMode`, a shared field).
 * Spec: `countdown-units` of the change `design-v2-features`; docs/features/events/SPEC.md section 2.1.
 */
@Serializable
enum class UnitMode {
    /** Days; hours and minutes when less than 48 hours remain. The default. */
    @SerialName("auto") Auto,

    /** Total days. */
    @SerialName("days") Days,

    /** Weeks and days ("22 w 4 d"). */
    @SerialName("weeks") Weeks,

    /** Whole hours to the exact time. */
    @SerialName("hours") Hours,

    /** Years, months and days, shown "Y·M·D". */
    @SerialName("calendar") Calendar,

    /** Monday to Friday only. Public holidays are not skipped yet. */
    @SerialName("workdays") Workdays,
}

/** Home list size of a day's card (`theme.size`). A missing size reads as [Medium]. */
@Serializable
enum class CardSize {
    @SerialName("small") Small,
    @SerialName("medium") Medium,
    @SerialName("large") Large,
}

/**
 * The shared look of a day (`theme`), the API form of the app's `EventCustomization`
 * together with [Backdrop] (BACKEND.md section 7.2).
 *
 * @property gradient two `#RRGGBB` colours, or null for the palette's own colours.
 * @property size Home list size; other views ignore it.
 */
@Serializable
data class Theme(
    val paletteId: String,
    val cardStyle: String,
    val typography: String,
    val gradient: List<String>? = null,
    val size: CardSize = CardSize.Medium,
)

/** A day's role for the account reading it. */
@Serializable
enum class Role {
    @SerialName("owner") Owner,
    @SerialName("editor") Editor,
    @SerialName("viewer") Viewer,
    ;

    /** Owners and editors change shared fields; viewers change nothing. */
    val canEditSharedFields: Boolean get() = this != Viewer

    /** Only the owner reads and writes owner-only fields and memos. */
    val canSeeOwnerFields: Boolean get() = this == Owner
}

/** The role a member holds through an invite: never owner. */
@Serializable
enum class MemberRole {
    @SerialName("editor") Editor,
    @SerialName("viewer") Viewer,
    ;

    val role: Role get() = if (this == Editor) Role.Editor else Role.Viewer
}

/**
 * Reminder choices (owner-only `reminders`, or a member's own on their membership).
 *
 * @property daysBefore a subset of 0 (on the day), 1 and 7.
 * @property time local delivery time, `HH:MM`.
 */
@Serializable
data class Reminders(
    val daysBefore: List<Int>,
    @Serializable(with = HmTimeSerializer::class)
    val time: kotlinx.datetime.LocalTime = DEFAULT_TIME,
) {
    companion object {
        /** Days before a day that a reminder can fire. */
        val ALLOWED_DAYS_BEFORE: Set<Int> = setOf(0, 1, 7)

        val DEFAULT_TIME: kotlinx.datetime.LocalTime = kotlinx.datetime.LocalTime(9, 0)
    }
}

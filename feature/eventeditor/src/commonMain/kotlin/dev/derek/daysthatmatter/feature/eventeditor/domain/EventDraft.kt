package dev.derek.daysthatmatter.feature.eventeditor.domain

import dev.derek.daysthatmatter.core.model.event.CardSize
import dev.derek.daysthatmatter.core.model.event.EventDoc
import dev.derek.daysthatmatter.core.model.event.Recurrence
import dev.derek.daysthatmatter.core.model.event.Role
import dev.derek.daysthatmatter.core.model.event.Theme
import dev.derek.daysthatmatter.core.model.event.UnitMode
import kotlinx.datetime.LocalDate
import kotlinx.datetime.LocalTime
import kotlin.time.Instant

/** Repeat choices of the editor (`REPEATS` in design/v2/app.js; docs/features/events/SPEC.md section 2.3). */
enum class RepeatKind { None, Yearly, Monthly, Weekly, EveryNDays }

/**
 * The editor's working copy of a day: the fields the editor changes, as the user typed them. Everything else of the
 * stored document (backdrop, audio, reminders, archive state, server fields) is carried over from the original on
 * save by [toEventDoc].
 *
 * @property timeZone an IANA zone id, or null for a floating day (each viewer's own zone).
 * @property everyDays the "Every N days" input as typed; it is checked by `EventValidation` on save.
 * @property originalYear the anchor year of a yearly day loaded from storage; null means the target date's year.
 * @property gradient a custom two-color gradient of a stored day. Picking a palette clears it.
 */
data class EventDraft(
    val title: String = "",
    val emoji: String? = DEFAULT_EMOJI,
    val date: LocalDate,
    val time: LocalTime? = null,
    val timeZone: String?,
    val repeat: RepeatKind = RepeatKind.None,
    val everyDays: String = DEFAULT_EVERY_DAYS,
    val originalYear: Int? = null,
    val categoryId: String? = DEFAULT_CATEGORY,
    val notes: String = "",
    val pinned: Boolean = false,
    val unitMode: UnitMode = UnitMode.Auto,
    val paletteId: String = DEFAULT_PALETTE,
    val gradient: List<String>? = null,
    val cardStyle: String = DEFAULT_STYLE,
    val typography: String = DEFAULT_TYPOGRAPHY,
    val size: CardSize = CardSize.Medium,
) {
    /** The recurrence this draft describes. An "Every N days" text that is not a whole number reads as 0 days. */
    val recurrence: Recurrence
        get() = when (repeat) {
            RepeatKind.None -> Recurrence.None
            RepeatKind.Yearly -> Recurrence.Yearly(originalYear ?: date.year)
            RepeatKind.Monthly -> Recurrence.Monthly
            RepeatKind.Weekly -> Recurrence.Weekly
            RepeatKind.EveryNDays -> Recurrence.CustomDays(everyDays.trim().toIntOrNull() ?: 0)
        }

    /**
     * The document this draft saves as. [base] is the stored original (null when creating): its server fields, role,
     * shared extras and the fields the editor does not show are kept. A newly switched-on pin gets [now].
     */
    fun toEventDoc(id: String, base: EventDoc?, now: Instant): EventDoc = EventDoc(
        id = id,
        rev = base?.rev ?: 0,
        role = base?.role ?: Role.Owner,
        title = title.trim(),
        emoji = emoji,
        targetDate = date,
        targetTime = time,
        timeZone = timeZone,
        unitMode = unitMode,
        recurrence = recurrence,
        theme = Theme(paletteId = paletteId, cardStyle = cardStyle, typography = typography, gradient = gradient, size = size),
        backdrop = base?.backdrop,
        audio = base?.audio,
        notes = notes.takeUnless { it.isBlank() },
        pinnedAt = if (pinned) base?.pinnedAt ?: now else null,
        categoryId = categoryId,
        archivedAt = base?.archivedAt,
        reminders = base?.reminders,
        updatedAt = base?.updatedAt,
        members = base?.members,
        archived = base?.archived,
    )

    companion object {
        /** `✨`, the emoji of a new day in design/v2 (`openEditor`). */
        const val DEFAULT_EMOJI = "✨"
        const val DEFAULT_EVERY_DAYS = "10"
        const val DEFAULT_CATEGORY = "life"

        /** v2 `defaultLook()`: the Lagoon gradient, Glass style, Modern (sans) typeface, Medium size. */
        const val DEFAULT_PALETTE = "lagoon"
        const val DEFAULT_STYLE = "glass"
        const val DEFAULT_TYPOGRAPHY = "sans"

        /** The draft of a new day on [date] (v2 opens on today + 30 days), counting in [deviceZone] (events spec 2.4). */
        fun new(date: LocalDate, deviceZone: String): EventDraft = EventDraft(date = date, timeZone = deviceZone)

        /** The draft of a stored day. */
        fun of(doc: EventDoc): EventDraft {
            val recurrence = doc.recurrence
            return EventDraft(
                title = doc.title,
                emoji = doc.emoji,
                date = doc.targetDate,
                time = doc.targetTime,
                timeZone = doc.timeZone,
                repeat = when (recurrence) {
                    Recurrence.None -> RepeatKind.None
                    is Recurrence.Yearly -> RepeatKind.Yearly
                    Recurrence.Monthly -> RepeatKind.Monthly
                    Recurrence.Weekly -> RepeatKind.Weekly
                    is Recurrence.CustomDays -> RepeatKind.EveryNDays
                },
                everyDays = (recurrence as? Recurrence.CustomDays)?.days?.toString() ?: DEFAULT_EVERY_DAYS,
                originalYear = (recurrence as? Recurrence.Yearly)?.originalYear,
                categoryId = doc.categoryId,
                notes = doc.notes.orEmpty(),
                pinned = doc.pinnedAt != null,
                unitMode = doc.unitMode,
                paletteId = doc.theme.paletteId,
                gradient = doc.theme.gradient,
                cardStyle = doc.theme.cardStyle,
                typography = doc.theme.typography,
                size = doc.theme.size,
            )
        }
    }
}

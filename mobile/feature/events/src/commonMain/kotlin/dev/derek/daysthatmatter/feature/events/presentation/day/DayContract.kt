package dev.derek.daysthatmatter.feature.events.presentation.day

import dev.derek.daysthatmatter.core.designsystem.components.CardBackground
import dev.derek.daysthatmatter.core.designsystem.components.CardStyle
import dev.derek.daysthatmatter.core.designsystem.components.CardTypeface
import dev.derek.daysthatmatter.core.model.event.Role
import dev.derek.daysthatmatter.core.model.event.UnitMode

/** A label and value of the Details block ("Time zone", "Fixed · Oslo"). */
data class DetailRow(val label: String, val value: String)

sealed interface DayUiState {
    data object Loading : DayUiState

    /** The day does not exist or was deleted. */
    data object NotFound : DayUiState

    data class Content(
        val id: String,
        val title: String,
        val emoji: String,
        /** "✈️ Travel · Every year", or "Shared · Editor" for a day shared with the reader. */
        val badge: String,
        val dateLine: String,
        val number: String,
        val unit: String,
        val longNumber: Boolean,
        val tick: String,
        val unitMode: UnitMode,
        /** Owners and editors get the tap-to-switch number and the unit list; viewers get neither. */
        val canChangeUnit: Boolean,
        /** Workdays: "Public holidays are not skipped yet." */
        val showWorkdaysNote: Boolean,
        val archived: Boolean,
        val role: Role,
        val background: CardBackground,
        val style: CardStyle,
        val typeface: CardTypeface,
        val details: List<DetailRow>,
    ) : DayUiState
}

sealed interface DayIntent {
    /** Tap on the number: the next unit (Auto, Days, Weeks, Hours, Y·M·D, Workdays). */
    data object CycleUnit : DayIntent
    data class SelectUnit(val mode: UnitMode) : DayIntent
    data object Unarchive : DayIntent
    data object Delete : DayIntent
    data object Back : DayIntent
}

sealed interface DayEffect {
    data object Close : DayEffect
    data class Message(val text: String) : DayEffect
}

/** Shown under the unit list while Workdays is selected (design-v2 D1). */
const val WORKDAYS_NOTE = "Workdays counts Monday to Friday. Public holidays are not skipped yet."

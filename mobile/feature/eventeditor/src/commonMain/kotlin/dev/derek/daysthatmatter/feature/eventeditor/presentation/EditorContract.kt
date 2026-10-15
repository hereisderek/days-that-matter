package dev.derek.daysthatmatter.feature.eventeditor.presentation

import dev.derek.daysthatmatter.core.designsystem.components.DayCardState
import dev.derek.daysthatmatter.core.model.event.CardSize
import dev.derek.daysthatmatter.core.model.event.UnitMode
import dev.derek.daysthatmatter.feature.eventeditor.domain.DraftField
import dev.derek.daysthatmatter.feature.eventeditor.domain.EventDraft
import dev.derek.daysthatmatter.feature.eventeditor.domain.RepeatKind
import kotlinx.datetime.LocalDate
import kotlinx.datetime.LocalTime

/** Create a new day, or edit the stored day [Edit.id]. */
sealed interface EditorMode {
    data object Create : EditorMode
    data class Edit(val id: String) : EditorMode
}

/** The editor's tabs (design/v2 `editorView`). Sound comes with the audio work. */
enum class EditorTab(val label: String) { Details("Details"), Background("Background"), Style("Style") }

/** Background > type. Photo and Art come with the backdrop work. */
enum class BackgroundKind(val label: String) { Color("Color"), Gradient("Gradient") }

/** One choice of the time zone chips: a fixed [zoneId], or floating when it is null. */
data class ZoneChoice(val zoneId: String?, val label: String)

/** A plan limit the editor ran into (the owned-event gate), as v2's paywall sheet words it. */
data class GateNotice(val title: String, val text: String)

/** The live preview card and what the contrast check says about it. */
data class PreviewState(
    val card: DayCardState,
    val contrastText: String,
    val contrastOk: Boolean,
)

sealed interface EditorUiState {
    data object Loading : EditorUiState

    /** The day does not exist (or was deleted). */
    data object NotFound : EditorUiState

    /** The day is shared with the reader as editor or viewer; only its owner edits it here. */
    data object NotAllowed : EditorUiState

    /**
     * @property errors inline errors of the fields the user changed, from `EventValidation`; all of them after a
     *   save the use case rejected.
     * @property canSave the draft is valid, changed (or new) and no save is running.
     * @property gate a plan limit to show; set for a new day when the owned-event limit is reached.
     */
    data class Editing(
        val mode: EditorMode,
        val draft: EventDraft,
        val tab: EditorTab = EditorTab.Details,
        val background: BackgroundKind = BackgroundKind.Gradient,
        val errors: Map<DraftField, String> = emptyMap(),
        val canSave: Boolean = false,
        val dirty: Boolean = false,
        val saving: Boolean = false,
        val confirmDiscard: Boolean = false,
        val gate: GateNotice? = null,
        val zoneChoices: List<ZoneChoice> = emptyList(),
        /** True when the day is archived: it cannot be pinned. */
        val archived: Boolean = false,
        val preview: PreviewState,
    ) : EditorUiState {
        val isNew: Boolean get() = mode == EditorMode.Create
        val title: String get() = if (isNew) "New day" else "Edit day"
    }
}

sealed interface EditorIntent {
    data class TitleChanged(val text: String) : EditorIntent
    data class EmojiPicked(val emoji: String) : EditorIntent
    data class DatePicked(val date: LocalDate) : EditorIntent
    data class TimePicked(val time: LocalTime) : EditorIntent
    data object TimeCleared : EditorIntent

    /** A fixed zone id, or null for floating. */
    data class ZonePicked(val zoneId: String?) : EditorIntent
    data class RepeatPicked(val repeat: RepeatKind) : EditorIntent
    data class EveryDaysChanged(val text: String) : EditorIntent

    /** Selects a category, or clears it when it is already selected. */
    data class CategoryPicked(val id: String) : EditorIntent
    data class NotesChanged(val text: String) : EditorIntent
    data class PinnedChanged(val pinned: Boolean) : EditorIntent
    data class UnitPicked(val mode: UnitMode) : EditorIntent
    data class TabPicked(val tab: EditorTab) : EditorIntent
    data class BackgroundPicked(val kind: BackgroundKind) : EditorIntent

    /** A palette id (`mint`, `deep-sea`): a color swatch or a gradient preset. */
    data class PalettePicked(val paletteId: String) : EditorIntent
    data class StylePicked(val cardStyle: String) : EditorIntent
    data class TypefacePicked(val typography: String) : EditorIntent
    data class SizePicked(val size: CardSize) : EditorIntent
    data object Save : EditorIntent

    /** Cancel or system back: closes at once, or asks first when there are unsaved changes. */
    data object Cancel : EditorIntent
    data object ConfirmDiscard : EditorIntent
    data object KeepEditing : EditorIntent

    /** Closes the plan limit notice. For a new day the editor closes with it. */
    data object DismissGate : EditorIntent
}

sealed interface EditorEffect {
    data object Close : EditorEffect

    /** The draft was stored. A new day opens its day page (v2 `save`); an edit returns to where it came from. */
    data class Saved(val id: String, val created: Boolean) : EditorEffect

    data class Message(val text: String) : EditorEffect
}

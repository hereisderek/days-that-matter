package dev.derek.daysthatmatter.feature.eventeditor.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.derek.daysthatmatter.core.model.event.EventDoc
import dev.derek.daysthatmatter.feature.eventeditor.domain.CheckNewEventGateUseCase
import dev.derek.daysthatmatter.feature.eventeditor.domain.DraftField
import dev.derek.daysthatmatter.feature.eventeditor.domain.EditableEvent
import dev.derek.daysthatmatter.feature.eventeditor.domain.EventDraft
import dev.derek.daysthatmatter.feature.eventeditor.domain.EventWriteChecks
import dev.derek.daysthatmatter.feature.eventeditor.domain.LoadEditableEventUseCase
import dev.derek.daysthatmatter.feature.eventeditor.domain.SaveResult
import dev.derek.daysthatmatter.feature.eventeditor.domain.UpsertEventUseCase
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch
import kotlinx.datetime.DatePeriod
import kotlinx.datetime.TimeZone
import kotlinx.datetime.plus
import kotlinx.datetime.toLocalDateTime
import kotlin.time.Clock

/**
 * The event editor (docs/features/events/SPEC.md section 4.3, design/v2 `editorView`): create a day or edit one the
 * reader owns. State goes Loading -> Editing, or NotFound / NotAllowed for an edit. Every change recomputes the
 * validation errors (`EventValidation` through [EventWriteChecks]), whether Save is possible and the live preview.
 * Errors show for the fields the user changed, and for every field after a rejected save.
 */
class EventEditorViewModel(
    private val mode: EditorMode,
    private val loadEvent: LoadEditableEventUseCase,
    private val upsertEvent: UpsertEventUseCase,
    private val checkGate: CheckNewEventGateUseCase,
    private val clock: Clock,
    private val zone: () -> TimeZone,
) : ViewModel() {

    private val _state = MutableStateFlow<EditorUiState>(EditorUiState.Loading)
    val state: StateFlow<EditorUiState> = _state.asStateFlow()

    private val effects = Channel<EditorEffect>(Channel.BUFFERED)
    val effect: Flow<EditorEffect> = effects.receiveAsFlow()

    /** The stored document of an edit; null when creating. */
    private var original: EventDoc? = null

    /** The draft as loaded, to tell whether anything changed. */
    private var initial: EventDraft? = null

    /** Fields whose errors are shown; [showAll] shows every error. */
    private val touched = mutableSetOf<DraftField>()
    private var showAll = false

    init {
        viewModelScope.launch { load() }
    }

    private suspend fun load() {
        when (mode) {
            EditorMode.Create -> {
                val today = clock.now().toLocalDateTime(zone()).date
                val draft = EventDraft.new(today.plus(DatePeriod(days = NEW_DAY_OFFSET_DAYS)), zone().id)
                initial = draft
                val gate = EditorText.gateNotice(checkGate())
                _state.value = editing(draft, gate = gate)
            }
            is EditorMode.Edit -> when (val found = loadEvent(mode.id)) {
                EditableEvent.NotFound -> _state.value = EditorUiState.NotFound
                EditableEvent.NotAllowed -> _state.value = EditorUiState.NotAllowed
                is EditableEvent.Found -> {
                    original = found.doc
                    val draft = EventDraft.of(found.doc)
                    initial = draft
                    _state.value = editing(draft)
                }
            }
        }
    }

    fun onIntent(intent: EditorIntent) {
        val current = _state.value as? EditorUiState.Editing
        if (current == null) {
            if (intent == EditorIntent.Cancel) close()
            return
        }
        val draft = current.draft
        when (intent) {
            is EditorIntent.TitleChanged -> change(DraftField.Title) { draft.copy(title = intent.text) }
            is EditorIntent.EmojiPicked -> change(DraftField.Emoji) { draft.copy(emoji = intent.emoji) }
            // A new date drops a stored anchor year: a yearly day counts its years from the date picked.
            is EditorIntent.DatePicked -> change(DraftField.Date) { draft.copy(date = intent.date, originalYear = null) }
            is EditorIntent.TimePicked -> change(DraftField.Time) { draft.copy(time = intent.time) }
            EditorIntent.TimeCleared -> change(DraftField.Time) { draft.copy(time = null) }
            is EditorIntent.ZonePicked -> change(DraftField.TimeZone) { draft.copy(timeZone = intent.zoneId) }
            is EditorIntent.RepeatPicked -> change(DraftField.Repeat) { draft.copy(repeat = intent.repeat) }
            is EditorIntent.EveryDaysChanged -> change(DraftField.EveryDays) { draft.copy(everyDays = intent.text) }
            is EditorIntent.CategoryPicked -> change(DraftField.Category) {
                draft.copy(categoryId = intent.id.takeUnless { it == draft.categoryId })
            }
            is EditorIntent.NotesChanged -> change(DraftField.Notes) { draft.copy(notes = intent.text) }
            is EditorIntent.PinnedChanged -> if (!current.archived) change(DraftField.Other) { draft.copy(pinned = intent.pinned) }
            is EditorIntent.UnitPicked -> change(DraftField.Unit) { draft.copy(unitMode = intent.mode) }
            is EditorIntent.PalettePicked -> change(DraftField.Look) { draft.copy(paletteId = intent.paletteId, gradient = null) }
            is EditorIntent.StylePicked -> change(DraftField.Look) { draft.copy(cardStyle = intent.cardStyle) }
            is EditorIntent.TypefacePicked -> change(DraftField.Look) { draft.copy(typography = intent.typography) }
            is EditorIntent.SizePicked -> change(DraftField.Look) { draft.copy(size = intent.size) }
            is EditorIntent.TabPicked -> _state.value = current.copy(tab = intent.tab)
            is EditorIntent.BackgroundPicked -> _state.value = current.copy(background = intent.kind)
            EditorIntent.Save -> save(current)
            EditorIntent.Cancel -> if (current.dirty) _state.value = current.copy(confirmDiscard = true) else close()
            EditorIntent.ConfirmDiscard -> close()
            EditorIntent.KeepEditing -> _state.value = current.copy(confirmDiscard = false)
            EditorIntent.DismissGate -> if (current.isNew) close() else _state.value = current.copy(gate = null)
        }
    }

    private fun change(field: DraftField, update: () -> EventDraft) {
        val current = _state.value as? EditorUiState.Editing ?: return
        touched += field
        _state.value = editing(update(), current)
    }

    private fun save(current: EditorUiState.Editing) {
        if (!current.canSave) return
        _state.value = current.copy(saving = true, canSave = false)
        viewModelScope.launch {
            when (val result = upsertEvent(current.draft, original)) {
                is SaveResult.Saved -> effects.send(EditorEffect.Saved(result.id, result.created))
                is SaveResult.Invalid -> {
                    showAll = true
                    _state.value = editing(current.draft, current).copy(
                        errors = result.errors.associate { DraftField.of(it.field) to EventWriteChecks.message(it) },
                        canSave = false,
                    )
                }
                is SaveResult.Blocked -> _state.value = editing(current.draft, current, gate = EditorText.gateNotice(result.gate))
                SaveResult.NotFound -> _state.value = EditorUiState.NotFound
                SaveResult.NotAllowed -> _state.value = EditorUiState.NotAllowed
            }
        }
    }

    private fun close() {
        viewModelScope.launch { effects.send(EditorEffect.Close) }
    }

    /** The Editing state for [draft], keeping the screen choices of [previous]. */
    private fun editing(
        draft: EventDraft,
        previous: EditorUiState.Editing? = null,
        gate: GateNotice? = previous?.gate,
    ): EditorUiState.Editing {
        val now = clock.now()
        val doc = draft.toEventDoc(id = original?.id ?: DRAFT_ID, base = original, now = now)
        val all = EventWriteChecks.errorsOf(doc)
            .groupBy { DraftField.of(it.field) }
            .mapValues { (_, errors) -> EventWriteChecks.message(errors.first()) }
        val shown = if (showAll) all else all.filterKeys { it in touched || it == DraftField.Other }
        val dirty = draft != initial
        val isNew = mode == EditorMode.Create
        return EditorUiState.Editing(
            mode = mode,
            draft = draft,
            tab = previous?.tab ?: EditorTab.Details,
            background = previous?.background ?: if (EditorText.isSwatch(draft.paletteId) && draft.gradient == null) {
                BackgroundKind.Color
            } else {
                BackgroundKind.Gradient
            },
            errors = shown,
            canSave = all.isEmpty() && (isNew || dirty) && gate == null,
            dirty = dirty,
            saving = false,
            confirmDiscard = false,
            gate = gate,
            zoneChoices = EditorText.zoneChoices(draft.timeZone, zone().id),
            archived = original?.archivedAt != null,
            preview = EditorText.preview(draft, original, now, zone()),
        )
    }

    companion object {
        /** A new day starts 30 days from today, as in design/v2 (`openEditor`). */
        const val NEW_DAY_OFFSET_DAYS = 30

        private const val DRAFT_ID = "draft"
    }
}

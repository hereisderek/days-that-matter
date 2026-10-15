package dev.derek.daysthatmatter.feature.events.presentation.day

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.derek.daysthatmatter.core.designsystem.components.CardStyle
import dev.derek.daysthatmatter.core.model.event.Recurrence
import dev.derek.daysthatmatter.core.model.event.Role
import dev.derek.daysthatmatter.core.model.event.UnitMode
import dev.derek.daysthatmatter.feature.events.domain.Categories
import dev.derek.daysthatmatter.feature.events.domain.DeleteEventUseCase
import dev.derek.daysthatmatter.feature.events.domain.EventCountdown
import dev.derek.daysthatmatter.feature.events.domain.EventWriteResult
import dev.derek.daysthatmatter.feature.events.domain.ObserveEventUseCase
import dev.derek.daysthatmatter.feature.events.domain.SetUnitModeUseCase
import dev.derek.daysthatmatter.feature.events.domain.UnarchiveEventUseCase
import dev.derek.daysthatmatter.feature.events.presentation.common.CardLook
import dev.derek.daysthatmatter.feature.events.presentation.common.CountdownText
import dev.derek.daysthatmatter.feature.events.presentation.home.HomeViewModel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.datetime.TimeZone

/**
 * The day page: the big live countdown (ticking each second), tap the number to switch the unit through the six
 * unit modes, the unit list, the Workdays note, and the Details block (docs/features/events/SPEC.md section 4.2,
 * design-v2 `countdown-units`). State goes Loading -> Content, or NotFound.
 */
class EventDetailViewModel(
    private val eventId: String,
    observeEvent: ObserveEventUseCase,
    private val setUnitMode: SetUnitModeUseCase,
    private val unarchiveEvent: UnarchiveEventUseCase,
    private val deleteEvent: DeleteEventUseCase,
    private val zone: () -> TimeZone,
) : ViewModel() {

    /** Ticks each second while the screen collects it; stops 5 s after it leaves. */
    val state: StateFlow<DayUiState> = observeEvent(eventId)
        .map { day -> day?.let(::content) ?: DayUiState.NotFound }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(HomeViewModel.STOP_TIMEOUT_MS), DayUiState.Loading)

    private val effects = Channel<DayEffect>(Channel.BUFFERED)
    val effect: Flow<DayEffect> = effects.receiveAsFlow()

    fun onIntent(intent: DayIntent) {
        when (intent) {
            DayIntent.CycleUnit -> (state.value as? DayUiState.Content)?.let { changeUnit(SetUnitModeUseCase.next(it.unitMode)) }
            is DayIntent.SelectUnit -> changeUnit(intent.mode)
            DayIntent.Unarchive -> viewModelScope.launch {
                if (unarchiveEvent(eventId) == EventWriteResult.Done) effects.send(DayEffect.Message("Back on Home"))
            }
            DayIntent.Delete -> viewModelScope.launch {
                if (deleteEvent(eventId) == EventWriteResult.Done) effects.send(DayEffect.Close)
            }
            DayIntent.Back -> viewModelScope.launch { effects.send(DayEffect.Close) }
        }
    }

    private fun changeUnit(mode: UnitMode) {
        val current = state.value as? DayUiState.Content ?: return
        if (!current.canChangeUnit || mode == current.unitMode) return
        viewModelScope.launch { setUnitMode(eventId, mode) }
    }

    private fun content(day: EventCountdown): DayUiState.Content {
        val doc = day.event.doc
        val countdown = day.countdown
        val value = CountdownText.value(doc, countdown)
        val role = day.event.role
        val owner = role == Role.Owner
        val category = Categories.byId(doc.categoryId)
        val repeat = repeatLabel(doc.recurrence)
        val badge = if (owner) {
            listOfNotNull(category?.let { "${it.emoji} ${it.name}" } ?: "${CardLook.DEFAULT_EMOJI} Day", repeat.takeIf { doc.recurrence != Recurrence.None })
                .joinToString(" · ")
        } else {
            "Shared · ${if (role == Role.Editor) "Editor" else "Viewer"}"
        }
        val deviceZone = zone()
        val zoneText = when (val id = doc.timeZone) {
            null -> "Floating · each viewer’s local time"
            deviceZone.id -> "Fixed · ${CountdownText.city(id)} (this device)"
            else -> "Fixed · ${CountdownText.city(id)}"
        }
        val details = buildList {
            add(DetailRow("Date", CountdownText.dateLong(doc.targetDate)))
            add(DetailRow("Time", doc.targetTime?.let(CountdownText::time) ?: "All day"))
            add(DetailRow("Time zone", zoneText))
            add(DetailRow("Repeats", repeat))
            add(DetailRow("Count in", CountdownText.unitLabel(doc.unitMode)))
            if (owner) add(DetailRow("Pinned", if (doc.pinnedAt != null) "Yes" else "No"))
            if (owner && !doc.notes.isNullOrBlank()) add(DetailRow("Notes", doc.notes!!))
        }
        return DayUiState.Content(
            id = doc.id,
            title = doc.title,
            emoji = doc.emoji ?: CardLook.DEFAULT_EMOJI,
            badge = badge,
            dateLine = listOfNotNull(
                CountdownText.metaLong(doc, countdown, deviceZone),
                CountdownText.occurrence(doc, countdown)?.takeIf { !countdown.isToday },
            ).joinToString(" · "),
            number = value.number,
            unit = value.unit,
            longNumber = value.long,
            tick = CountdownText.tick(countdown),
            unitMode = doc.unitMode,
            canChangeUnit = SetUnitModeUseCase.canChange(role),
            showWorkdaysNote = doc.unitMode == UnitMode.Workdays,
            archived = day.event.isArchived,
            role = role,
            background = CardLook.background(doc.theme),
            // Outline is drawn as Clean on full-bleed views (design/v2 section 3).
            style = CardLook.style(doc.theme).let { if (it == CardStyle.Outline) CardStyle.Clean else it },
            typeface = CardLook.typeface(doc.theme),
            details = details,
        )
    }

    private fun repeatLabel(recurrence: Recurrence): String = when (recurrence) {
        Recurrence.None -> "Never"
        is Recurrence.Yearly -> "Every year"
        Recurrence.Monthly -> "Every month"
        Recurrence.Weekly -> "Every week"
        is Recurrence.CustomDays -> "Every ${recurrence.days} days"
    }
}

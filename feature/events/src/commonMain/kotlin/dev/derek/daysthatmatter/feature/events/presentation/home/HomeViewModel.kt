package dev.derek.daysthatmatter.feature.events.presentation.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.derek.daysthatmatter.feature.events.domain.ArchiveEventUseCase
import dev.derek.daysthatmatter.feature.events.domain.Categories
import dev.derek.daysthatmatter.feature.events.domain.DeleteEventUseCase
import dev.derek.daysthatmatter.feature.events.domain.EventCountdown
import dev.derek.daysthatmatter.feature.events.domain.EventWriteResult
import dev.derek.daysthatmatter.feature.events.domain.HomeDays
import dev.derek.daysthatmatter.feature.events.domain.HomeFilter
import dev.derek.daysthatmatter.feature.events.domain.HomeQuery
import dev.derek.daysthatmatter.feature.events.domain.ObserveArchivedCountUseCase
import dev.derek.daysthatmatter.feature.events.domain.ObserveEventsUseCase
import dev.derek.daysthatmatter.feature.events.domain.PinEventUseCase
import dev.derek.daysthatmatter.feature.events.domain.RestoreEventUseCase
import dev.derek.daysthatmatter.feature.events.presentation.common.CardLook
import dev.derek.daysthatmatter.feature.events.presentation.common.CountdownText
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.datetime.TimeZone
import kotlin.time.Clock

/**
 * Home: the user's days in Pinned, Upcoming and Since sections, with search, filter chips, sort, list or grid,
 * and the "Archived · N" row (docs/features/events/SPEC.md section 4.1, design-v2 `home-screen`). Counts tick
 * every second. State goes Loading -> Content; actions on a day (pin, archive, delete with undo) come from the
 * card's menu.
 */
class HomeViewModel(
    private val observeEvents: ObserveEventsUseCase,
    private val observeArchivedCount: ObserveArchivedCountUseCase,
    private val pinEvent: PinEventUseCase,
    private val archiveEvent: ArchiveEventUseCase,
    private val deleteEvent: DeleteEventUseCase,
    private val restoreEvent: RestoreEventUseCase,
    private val clock: Clock,
    private val zone: () -> TimeZone,
) : ViewModel() {

    private val homeQuery = MutableStateFlow(HomeQuery())

    /** What the user set on screen (search, filter, sort, layout); the days are combined in below. */
    private val controls = MutableStateFlow(HomeUiState(chips = chips()))

    /** Ticks only while the screen collects it (stops 5 s after it leaves, so nothing ticks in the background). */
    val state: StateFlow<HomeUiState> =
        combine(controls, observeEvents(homeQuery), observeArchivedCount()) { ui, days, archived -> ui.withDays(days, archived) }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS), controls.value)

    private val effects = Channel<HomeEffect>(Channel.BUFFERED)
    val effect: Flow<HomeEffect> = effects.receiveAsFlow()

    fun onIntent(intent: HomeIntent) {
        when (intent) {
            HomeIntent.ToggleSearch -> {
                val closing = controls.value.searching
                controls.update { it.copy(searching = !closing, query = if (closing) "" else it.query) }
                if (closing) homeQuery.update { it.copy(text = "") }
            }
            is HomeIntent.QueryChanged -> {
                controls.update { it.copy(query = intent.text) }
                homeQuery.update { it.copy(text = intent.text) }
            }
            is HomeIntent.SelectFilter -> {
                controls.update { it.copy(filter = intent.filter) }
                homeQuery.update { it.copy(filter = intent.filter) }
            }
            is HomeIntent.SelectSort -> {
                controls.update { it.copy(sort = intent.sort) }
                homeQuery.update { it.copy(sort = intent.sort) }
            }
            HomeIntent.ToggleLayout -> controls.update {
                it.copy(layout = if (it.layout == HomeLayout.List) HomeLayout.Grid else HomeLayout.List)
            }
            is HomeIntent.OpenDay -> send(HomeEffect.OpenDay(intent.id))
            HomeIntent.OpenArchived -> send(HomeEffect.OpenArchived)
            is HomeIntent.SetPinned -> viewModelScope.launch {
                if (pinEvent(intent.id, intent.pinned) == EventWriteResult.NotAllowed) {
                    effects.send(HomeEffect.Message("Only the owner can pin this day"))
                }
            }
            is HomeIntent.Archive -> viewModelScope.launch {
                if (archiveEvent(intent.id) == EventWriteResult.Done) effects.send(HomeEffect.Message("Archived"))
            }
            is HomeIntent.Delete -> viewModelScope.launch {
                if (deleteEvent(intent.id) == EventWriteResult.Done) {
                    effects.send(HomeEffect.Message("Deleted", undoDeleteId = intent.id))
                }
            }
            is HomeIntent.UndoDelete -> viewModelScope.launch { restoreEvent(intent.id) }
        }
    }

    private fun send(effect: HomeEffect) {
        viewModelScope.launch { effects.send(effect) }
    }

    private fun HomeUiState.withDays(days: HomeDays, archived: Int): HomeUiState {
        val sections = listOf(
            HomeSectionKind.Pinned to days.pinned,
            HomeSectionKind.Upcoming to days.upcoming,
            HomeSectionKind.Since to days.since,
        ).filter { it.second.isNotEmpty() }.map { (kind, list) -> HomeSection(kind, list.map(::item)) }
        val filtered = query.isNotBlank() || filter != HomeFilter.All
        return copy(
            loading = false,
            kicker = CountdownText.todayKicker(clock.now(), zone()),
            sections = sections,
            archivedCount = archived,
            empty = when {
                sections.isNotEmpty() -> null
                filtered -> HomeEmpty.NoMatches
                else -> HomeEmpty.NothingYet
            },
        )
    }

    private fun item(day: EventCountdown) = HomeDayItem(
        id = day.event.id,
        card = CardLook.card(day),
        pinned = day.event.isPinned && day.event.isOwner,
        canPin = day.event.isOwner,
        isOwner = day.event.isOwner,
    )

    companion object {
        /** How long the ticking flows keep running after the screen stops collecting (configuration changes). */
        const val STOP_TIMEOUT_MS = 5_000L

        fun chips(): List<FilterChip> = listOf(
            FilterChip(HomeFilter.All, "All"),
            FilterChip(HomeFilter.Upcoming, "Upcoming"),
            FilterChip(HomeFilter.Since, "Since"),
        ) + Categories.all.map { FilterChip(HomeFilter.Category(it.id), it.name) }
    }
}

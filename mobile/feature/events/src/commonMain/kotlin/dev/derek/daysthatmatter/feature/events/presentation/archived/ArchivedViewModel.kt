package dev.derek.daysthatmatter.feature.events.presentation.archived

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.derek.daysthatmatter.core.designsystem.components.DayCardState
import dev.derek.daysthatmatter.feature.events.domain.DeleteEventUseCase
import dev.derek.daysthatmatter.feature.events.domain.EventWriteResult
import dev.derek.daysthatmatter.feature.events.domain.ObserveArchivedUseCase
import dev.derek.daysthatmatter.feature.events.domain.RestoreEventUseCase
import dev.derek.daysthatmatter.feature.events.domain.UnarchiveEventUseCase
import dev.derek.daysthatmatter.feature.events.presentation.common.CardLook
import dev.derek.daysthatmatter.feature.events.presentation.home.HomeViewModel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/** An archived day. Days shared with the reader offer Leave instead of Delete. */
data class ArchivedItem(val id: String, val card: DayCardState, val isOwner: Boolean)

data class ArchivedUiState(
    val loading: Boolean = true,
    val items: List<ArchivedItem> = emptyList(),
)

sealed interface ArchivedIntent {
    data class Open(val id: String) : ArchivedIntent
    data class Unarchive(val id: String) : ArchivedIntent
    data class Delete(val id: String) : ArchivedIntent
    data class UndoDelete(val id: String) : ArchivedIntent
    data object Back : ArchivedIntent
}

sealed interface ArchivedEffect {
    data class OpenDay(val id: String) : ArchivedEffect
    data object Close : ArchivedEffect
    data class Message(val text: String, val undoDeleteId: String? = null) : ArchivedEffect
}

/**
 * The Archived screen (design-v2 task 2.6): archived days, most recently archived first. Days open normally;
 * the card menu offers Unarchive and Delete (Leave for days shared with the reader). State goes Loading -> Content.
 */
class ArchivedViewModel(
    observeArchived: ObserveArchivedUseCase,
    private val unarchiveEvent: UnarchiveEventUseCase,
    private val deleteEvent: DeleteEventUseCase,
    private val restoreEvent: RestoreEventUseCase,
) : ViewModel() {

    /** Ticks while the screen collects it; stops 5 s after it leaves. */
    val state: StateFlow<ArchivedUiState> = observeArchived()
        .map { days -> ArchivedUiState(loading = false, items = days.map { ArchivedItem(it.event.id, CardLook.card(it), it.event.isOwner) }) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(HomeViewModel.STOP_TIMEOUT_MS), ArchivedUiState())

    private val effects = Channel<ArchivedEffect>(Channel.BUFFERED)
    val effect: Flow<ArchivedEffect> = effects.receiveAsFlow()

    fun onIntent(intent: ArchivedIntent) {
        viewModelScope.launch {
            when (intent) {
                is ArchivedIntent.Open -> effects.send(ArchivedEffect.OpenDay(intent.id))
                is ArchivedIntent.Unarchive ->
                    if (unarchiveEvent(intent.id) == EventWriteResult.Done) effects.send(ArchivedEffect.Message("Back on Home"))
                is ArchivedIntent.Delete -> {
                    val owner = state.value.items.firstOrNull { it.id == intent.id }?.isOwner ?: true
                    if (deleteEvent(intent.id) == EventWriteResult.Done) {
                        effects.send(ArchivedEffect.Message(if (owner) "Deleted" else "Left the day", undoDeleteId = intent.id))
                    }
                }
                is ArchivedIntent.UndoDelete -> restoreEvent(intent.id)
                ArchivedIntent.Back -> effects.send(ArchivedEffect.Close)
            }
        }
    }
}

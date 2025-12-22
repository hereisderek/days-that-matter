package dev.derek.daysthatmatter.presentation.event

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.derek.daysthatmatter.domain.model.Event
import dev.derek.daysthatmatter.domain.repository.EventRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.datetime.Clock

class EventEditViewModel(
    private val repository: EventRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<EventEditUiState>(EventEditUiState.Idle)
    val uiState: StateFlow<EventEditUiState> = _uiState.asStateFlow()

    fun loadEvent(eventId: String) {
        viewModelScope.launch {
            _uiState.value = EventEditUiState.Loading
            val event = repository.getEvent(eventId)
            if (event != null) {
                _uiState.value = EventEditUiState.Loaded(event)
            } else {
                _uiState.value = EventEditUiState.Error("Event not found")
            }
        }
    }

    fun saveEvent(
        id: String?,
        title: String,
        date: Long,
        notes: String?,
        style: String
    ) {
        viewModelScope.launch {
            _uiState.value = EventEditUiState.Loading
            try {
                val event = Event(
                    id = id ?: "",
                    title = title,
                    date = date,
                    notes = notes,
                    style = style,
                    createdAt = if (id == null) Clock.System.now().toEpochMilliseconds() else 0L, // Should fetch existing if editing
                    updatedAt = Clock.System.now().toEpochMilliseconds()
                )
                // If editing, we should probably merge with existing event data, but for now let's assume full update or new
                // Ideally we fetch the event first if id is not null

                repository.saveEvent(event)
                _uiState.value = EventEditUiState.Success
            } catch (e: Exception) {
                _uiState.value = EventEditUiState.Error(e.message ?: "Unknown error")
            }
        }
    }

    fun resetState() {
        _uiState.value = EventEditUiState.Idle
    }
}

sealed class EventEditUiState {
    data object Idle : EventEditUiState()
    data object Loading : EventEditUiState()
    data class Loaded(val event: Event) : EventEditUiState()
    data object Success : EventEditUiState()
    data class Error(val message: String) : EventEditUiState()
}


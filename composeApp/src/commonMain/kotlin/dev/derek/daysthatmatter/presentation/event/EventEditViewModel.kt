package dev.derek.daysthatmatter.presentation.event

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.derek.daysthatmatter.domain.model.Event
import dev.derek.daysthatmatter.domain.repository.EventRepository
import dev.derek.daysthatmatter.domain.repository.StorageRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlin.time.Clock

class EventEditViewModel(
    private val repository: EventRepository,
    private val storageRepository: StorageRepository
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
        style: String,
        backgroundMusicUrl: String? = null,
        backgroundMusicName: String? = null,
        includeTime: Boolean = false
    ) {
        viewModelScope.launch {
            _uiState.value = EventEditUiState.Loading
            try {
                // Fetch existing event to preserve creation date if editing
                val existingEvent = if (id != null) repository.getEvent(id) else null

                val event = Event(
                    id = id ?: "",
                    title = title,
                    date = date,
                    notes = notes,
                    style = style,
                    backgroundMusicUrl = backgroundMusicUrl ?: existingEvent?.backgroundMusicUrl,
                    backgroundMusicName = backgroundMusicName ?: existingEvent?.backgroundMusicName,
                    includeTime = includeTime,
                    createdAt = existingEvent?.createdAt ?: Clock.System.now().toEpochMilliseconds(),
                    updatedAt = Clock.System.now().toEpochMilliseconds()
                )

                repository.saveEvent(event)
                _uiState.value = EventEditUiState.Success
            } catch (e: Exception) {
                _uiState.value = EventEditUiState.Error(e.message ?: "Unknown error")
            }
        }
    }

    fun uploadMusic(bytes: ByteArray, fileName: String, onResult: (String) -> Unit) {
        viewModelScope.launch {
            _uiState.value = EventEditUiState.Loading
            val result = storageRepository.uploadFile("music/${Clock.System.now().toEpochMilliseconds()}_$fileName", bytes)
            if (result.isSuccess) {
                onResult(result.getOrThrow())
                _uiState.value = EventEditUiState.Idle // Or keep loading if we want to block
            } else {
                _uiState.value = EventEditUiState.Error(result.exceptionOrNull()?.message ?: "Upload failed")
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

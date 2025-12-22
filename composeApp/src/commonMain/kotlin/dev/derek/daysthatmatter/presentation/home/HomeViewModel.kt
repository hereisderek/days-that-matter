package dev.derek.daysthatmatter.presentation.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.derek.daysthatmatter.domain.model.Event
import dev.derek.daysthatmatter.domain.repository.EventRepository
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn

class HomeViewModel(
    private val repository: EventRepository
) : ViewModel() {

    val events: StateFlow<List<Event>> = repository.getEvents()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )
}


package dev.derek.daysthatmatter.data.repository

import dev.derek.daysthatmatter.domain.model.Event
import dev.derek.daysthatmatter.domain.repository.EventRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map

class FakeEventRepository : EventRepository {
    private val events = MutableStateFlow<List<Event>>(emptyList())

    override fun getEvents(): Flow<List<Event>> = events

    override suspend fun getEvent(id: String): Event? {
        return events.value.find { it.id == id }
    }

    override suspend fun saveEvent(event: Event) {
        val currentList = events.value.toMutableList()
        val index = currentList.indexOfFirst { it.id == event.id }
        if (index != -1) {
            currentList[index] = event
        } else {
            currentList.add(event)
        }
        events.value = currentList
    }

    override suspend fun deleteEvent(id: String) {
        val currentList = events.value.toMutableList()
        currentList.removeAll { it.id == id }
        events.value = currentList
    }
}


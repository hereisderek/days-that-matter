package dev.derek.daysthatmatter.domain.repository

import dev.derek.daysthatmatter.domain.model.Event
import kotlinx.coroutines.flow.Flow

interface EventRepository {
    fun getEvents(): Flow<List<Event>>
    suspend fun getEvent(id: String): Event?
    suspend fun saveEvent(event: Event)
    suspend fun deleteEvent(id: String)
}


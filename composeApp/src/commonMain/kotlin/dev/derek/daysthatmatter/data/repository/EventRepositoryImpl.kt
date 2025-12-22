package dev.derek.daysthatmatter.data.repository

import dev.derek.daysthatmatter.domain.model.Event
import dev.derek.daysthatmatter.domain.repository.EventRepository
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.auth.auth
import dev.gitlive.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.flow.map

class EventRepositoryImpl(
    private val firestore: FirebaseFirestore
) : EventRepository {

    private val collection get() = firestore.collection("events")
    private val auth get() = Firebase.auth

    override fun getEvents(): Flow<List<Event>> {
        val userId = auth.currentUser?.uid ?: return emptyFlow()
        return collection.where { "ownerId" equalTo userId }.snapshots.map { snapshot ->
            snapshot.documents.map { it.data() }
        }
    }

    override suspend fun getEvent(id: String): Event? {
        return try {
            collection.document(id).get().data()
        } catch (e: Exception) {
            null
        }
    }

    override suspend fun saveEvent(event: Event) {
        val userId = auth.currentUser?.uid ?: throw IllegalStateException("User not logged in")
        val eventToSave = if (event.ownerId.isEmpty()) event.copy(ownerId = userId) else event

        if (eventToSave.id.isEmpty()) {
            val docRef = collection.add(eventToSave)
            // Update the event with the generated ID
            docRef.updateFields { "id" to docRef.id }
        } else {
            collection.document(eventToSave.id).set(eventToSave)
        }
    }

    override suspend fun deleteEvent(id: String) {
        collection.document(id).delete()
    }
}


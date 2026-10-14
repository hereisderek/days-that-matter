package dev.derek.daysthatmatter.feature.events.domain

import dev.derek.daysthatmatter.core.model.event.EventDoc
import kotlinx.coroutines.flow.Flow
import kotlin.time.Instant

/**
 * The days on this device (offline first: every write is local and immediate; the sync engine sends it later).
 * Deleted days are hidden from every read.
 */
interface EventRepository {
    /**
     * Days for Home: not archived, pinned first (newest pin first), then by target date. [text] filters by title
     * (blank = all), [categoryId] by category (null = all).
     */
    fun observeHome(text: String = "", categoryId: String? = null): Flow<List<StoredEvent>>

    /** Archived days, most recently archived first. */
    fun observeArchived(): Flow<List<StoredEvent>>

    fun observeArchivedCount(): Flow<Int>

    fun observeEvent(id: String): Flow<StoredEvent?>

    suspend fun get(id: String): StoredEvent?

    /** Replaces the document of [id] with [change] of it. Returns false when there is no such day. */
    suspend fun edit(id: String, change: (EventDoc) -> EventDoc): Boolean

    /** Marks [id] deleted (or left, for a shared day). Returns false when there is no such day. */
    suspend fun delete(id: String): Boolean

    /** Undoes [delete]. Returns false when there is no such day. */
    suspend fun restore(id: String): Boolean

    /** True when no day is stored, archived ones included. */
    suspend fun isEmpty(): Boolean

    /** Stores new days created on this device at [createdAt]. */
    suspend fun add(docs: List<EventDoc>, createdAt: Instant)
}

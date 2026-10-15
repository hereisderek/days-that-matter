package dev.derek.daysthatmatter.feature.events.data

import dev.derek.daysthatmatter.core.database.event.EventDao
import dev.derek.daysthatmatter.core.database.event.EventEntity
import dev.derek.daysthatmatter.core.database.event.EventRowMeta
import dev.derek.daysthatmatter.core.database.event.rowMeta
import dev.derek.daysthatmatter.core.database.event.toEntity
import dev.derek.daysthatmatter.core.database.event.toEventDoc
import dev.derek.daysthatmatter.core.database.event.withLocalEdit
import dev.derek.daysthatmatter.core.model.event.EventDoc
import dev.derek.daysthatmatter.feature.events.domain.EventRepository
import dev.derek.daysthatmatter.feature.events.domain.StoredEvent
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlin.time.Clock
import kotlin.time.Instant

/**
 * [EventRepository] on the Room database. Offline first and local only: every write lands in the database at once
 * and, for days already on the backend, adds the changed fields to `pending_patch` for the sync engine (a later
 * wave). No network.
 */
class RoomEventRepository(
    private val dao: EventDao,
    private val clock: Clock,
) : EventRepository {

    override fun observeHome(text: String, categoryId: String?): Flow<List<StoredEvent>> =
        dao.observeHome(EventDao.likePattern(text), categoryId).map { rows -> rows.map { it.toStored() } }

    override fun observeArchived(): Flow<List<StoredEvent>> =
        dao.observeArchived().map { rows -> rows.map { it.toStored() } }

    override fun observeArchivedCount(): Flow<Int> = dao.observeArchivedCount()

    override fun observeEvent(id: String): Flow<StoredEvent?> = dao.observeById(id).map { it?.toStored() }

    override suspend fun get(id: String): StoredEvent? = dao.getById(id)?.takeUnless { it.isDeleted }?.toStored()

    override suspend fun edit(id: String, change: (EventDoc) -> EventDoc): Boolean {
        var found = false
        val now = clock.now().toEpochMilliseconds()
        dao.update(id) { row ->
            if (row.isDeleted) return@update null
            found = true
            val before = row.toEventDoc()
            val after = change(before)
            if (after == before) null else row.withLocalEdit(after, now)
        }
        return found
    }

    override suspend fun delete(id: String): Boolean {
        if (get(id) == null) return false
        dao.markDeleted(id, clock.now().toEpochMilliseconds())
        return true
    }

    override suspend fun restore(id: String): Boolean {
        if (dao.getById(id) == null) return false
        dao.restore(id, clock.now().toEpochMilliseconds())
        return true
    }

    override suspend fun isEmpty(): Boolean = dao.countVisible() == 0

    override suspend fun add(docs: List<EventDoc>, createdAt: Instant) {
        dao.upsertAll(docs.map { it.toEntity(EventRowMeta(createdAt = createdAt, updatedAt = createdAt)) })
    }

    private fun EventEntity.toStored(): StoredEvent = StoredEvent(toEventDoc(), rowMeta().createdAt)
}

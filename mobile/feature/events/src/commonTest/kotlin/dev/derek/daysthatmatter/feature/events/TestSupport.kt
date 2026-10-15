package dev.derek.daysthatmatter.feature.events

import dev.derek.daysthatmatter.core.model.event.CardSize
import dev.derek.daysthatmatter.core.model.event.EventDoc
import dev.derek.daysthatmatter.core.model.event.Recurrence
import dev.derek.daysthatmatter.core.model.event.Role
import dev.derek.daysthatmatter.core.model.event.Theme
import dev.derek.daysthatmatter.core.model.event.UnitMode
import dev.derek.daysthatmatter.feature.events.domain.EventRepository
import dev.derek.daysthatmatter.feature.events.domain.StoredEvent
import dev.derek.daysthatmatter.feature.events.domain.Ticker
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update
import kotlinx.datetime.LocalDate
import kotlinx.datetime.LocalTime
import kotlinx.datetime.TimeZone
import kotlin.time.Clock
import kotlin.time.Duration
import kotlin.time.Duration.Companion.days
import kotlin.time.Instant

/** Wednesday 14 October 2026, 09:00 UTC. Tests use UTC as the device zone. */
val NOW: Instant = Instant.parse("2026-10-14T09:00:00Z")
val UTC: () -> TimeZone = { TimeZone.UTC }

fun event(
    id: String,
    title: String = id,
    date: LocalDate = LocalDate(2026, 12, 1),
    time: LocalTime? = null,
    zone: String? = null,
    role: Role? = Role.Owner,
    pinnedAt: Instant? = null,
    archivedAt: Instant? = null,
    category: String? = null,
    size: CardSize = CardSize.Medium,
    unitMode: UnitMode = UnitMode.Auto,
    recurrence: Recurrence = Recurrence.None,
    emoji: String? = "🎉",
    palette: String = "mint",
): EventDoc = EventDoc(
    id = id,
    role = role,
    title = title,
    emoji = emoji,
    targetDate = date,
    targetTime = time,
    timeZone = zone,
    unitMode = unitMode,
    recurrence = recurrence,
    theme = Theme(paletteId = palette, cardStyle = "glass", typography = "sans", size = size),
    pinnedAt = pinnedAt,
    archivedAt = archivedAt,
    categoryId = category,
)

/** A clock that reads a mutable instant. */
class FakeClock(var now: Instant = NOW) : Clock {
    override fun now(): Instant = now
}

/** A ticker the test drives: [tick] emits a new instant to every collector. */
class FakeTicker(start: Instant = NOW) : Ticker {
    val time = MutableStateFlow(start)
    override fun every(period: Duration): Flow<Instant> = time

    fun tick(by: Duration) = time.update { it + by }
}

/** In-memory [EventRepository] with the same rules as the Room one (order, filters, soft delete). */
class FakeEventRepository(vararg docs: EventDoc, createdAt: Instant = NOW - 30.days) : EventRepository {
    private data class Row(val event: StoredEvent, val deleted: Boolean = false)

    private val rows = MutableStateFlow(docs.associate { it.id to Row(StoredEvent(it, createdAt)) })

    var edits = 0
        private set

    fun put(doc: EventDoc, createdAt: Instant = NOW) = rows.update { it + (doc.id to Row(StoredEvent(doc, createdAt))) }

    private val visible get() = rows.map { map -> map.values.filter { !it.deleted }.map { it.event } }

    override fun observeHome(text: String, categoryId: String?): Flow<List<StoredEvent>> = visible.map { list ->
        list.filter { it.doc.archivedAt == null }
            .filter { categoryId == null || it.doc.categoryId == categoryId }
            .filter { text.isBlank() || it.doc.title.contains(text.trim(), ignoreCase = true) }
            .sortedWith(
                compareBy<StoredEvent> { it.doc.pinnedAt == null }
                    .thenByDescending { it.doc.pinnedAt }
                    .thenBy { it.doc.targetDate }
                    .thenBy { it.doc.title },
            )
    }.distinctUntilChanged()

    override fun observeArchived(): Flow<List<StoredEvent>> =
        visible.map { list -> list.filter { it.doc.archivedAt != null }.sortedByDescending { it.doc.archivedAt } }.distinctUntilChanged()

    override fun observeArchivedCount(): Flow<Int> = observeArchived().map { it.size }.distinctUntilChanged()

    override fun observeEvent(id: String): Flow<StoredEvent?> =
        rows.map { map -> map[id]?.takeUnless { it.deleted }?.event }.distinctUntilChanged()

    override suspend fun get(id: String): StoredEvent? = rows.value[id]?.takeUnless { it.deleted }?.event

    override suspend fun edit(id: String, change: (EventDoc) -> EventDoc): Boolean {
        val row = rows.value[id]?.takeUnless { it.deleted } ?: return false
        val after = change(row.event.doc)
        if (after != row.event.doc) {
            edits++
            rows.update { it + (id to row.copy(event = row.event.copy(doc = after))) }
        }
        return true
    }

    override suspend fun delete(id: String): Boolean {
        val row = rows.value[id]?.takeUnless { it.deleted } ?: return false
        rows.update { it + (id to row.copy(deleted = true)) }
        return true
    }

    override suspend fun restore(id: String): Boolean {
        val row = rows.value[id] ?: return false
        rows.update { it + (id to row.copy(deleted = false)) }
        return true
    }

    override suspend fun isEmpty(): Boolean = rows.value.values.none { !it.deleted }

    override suspend fun add(docs: List<EventDoc>, createdAt: Instant) {
        rows.update { map -> map + docs.associate { it.id to Row(StoredEvent(it, createdAt)) } }
    }

    fun doc(id: String): EventDoc? = rows.value[id]?.event?.doc

    fun isDeleted(id: String): Boolean = rows.value[id]?.deleted == true
}

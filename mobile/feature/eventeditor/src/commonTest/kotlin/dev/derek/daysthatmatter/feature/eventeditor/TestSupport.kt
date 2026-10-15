package dev.derek.daysthatmatter.feature.eventeditor

import dev.derek.daysthatmatter.core.model.event.CardSize
import dev.derek.daysthatmatter.core.model.event.EventDoc
import dev.derek.daysthatmatter.core.model.event.Recurrence
import dev.derek.daysthatmatter.core.model.event.Role
import dev.derek.daysthatmatter.core.model.event.Theme
import dev.derek.daysthatmatter.core.model.event.UnitMode
import dev.derek.daysthatmatter.core.model.plan.Plan
import dev.derek.daysthatmatter.feature.eventeditor.domain.CheckNewEventGateUseCase
import dev.derek.daysthatmatter.feature.eventeditor.domain.EventIdGenerator
import dev.derek.daysthatmatter.feature.eventeditor.domain.PlanProvider
import dev.derek.daysthatmatter.feature.eventeditor.domain.UpsertEventUseCase
import dev.derek.daysthatmatter.feature.events.domain.EventRepository
import dev.derek.daysthatmatter.feature.events.domain.StoredEvent
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import kotlinx.datetime.LocalDate
import kotlinx.datetime.LocalTime
import kotlinx.datetime.TimeZone
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.time.Clock
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
    rev: Long = 0,
    pinnedAt: Instant? = null,
    archivedAt: Instant? = null,
    category: String? = null,
    size: CardSize = CardSize.Medium,
    unitMode: UnitMode = UnitMode.Auto,
    recurrence: Recurrence = Recurrence.None,
    emoji: String? = "🎉",
    palette: String = "mint",
    gradient: List<String>? = null,
    notes: String? = null,
): EventDoc = EventDoc(
    id = id,
    rev = rev,
    role = role,
    title = title,
    emoji = emoji,
    targetDate = date,
    targetTime = time,
    timeZone = zone,
    unitMode = unitMode,
    recurrence = recurrence,
    theme = Theme(paletteId = palette, cardStyle = "glass", typography = "sans", gradient = gradient, size = size),
    notes = notes,
    pinnedAt = pinnedAt,
    archivedAt = archivedAt,
    categoryId = category,
)

/** A clock that reads a mutable instant. */
class FakeClock(var now: Instant = NOW) : Clock {
    override fun now(): Instant = now
}

/** Ids "id-1", "id-2", ... */
class SequentialIds : EventIdGenerator {
    private var n = 0
    override fun next(): String = "id-${++n}"
}

/** A plan the test sets. */
class FakePlans(var plan: Plan = Plan.Free) : PlanProvider {
    override suspend fun current(): Plan = plan
}

/** In-memory [EventRepository]: not archived on Home, archived apart, soft delete. Counts [edits] and [adds]. */
class FakeEventRepository(vararg docs: EventDoc) : EventRepository {
    private data class Row(val event: StoredEvent, val deleted: Boolean = false)

    private val rows = MutableStateFlow(docs.associate { it.id to Row(StoredEvent(it, NOW)) })

    var edits = 0
        private set
    var adds = 0
        private set

    fun put(doc: EventDoc) = rows.update { it + (doc.id to Row(StoredEvent(doc, NOW))) }

    private val visible get() = rows.map { map -> map.values.filter { !it.deleted }.map { it.event } }

    override fun observeHome(text: String, categoryId: String?): Flow<List<StoredEvent>> =
        visible.map { list -> list.filter { it.doc.archivedAt == null } }

    override fun observeArchived(): Flow<List<StoredEvent>> = visible.map { list -> list.filter { it.doc.archivedAt != null } }

    override fun observeArchivedCount(): Flow<Int> = observeArchived().map { it.size }

    override fun observeEvent(id: String): Flow<StoredEvent?> = rows.map { it[id]?.takeUnless { r -> r.deleted }?.event }

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
        adds++
        rows.update { map -> map + docs.associate { it.id to Row(StoredEvent(it, createdAt)) } }
    }

    fun doc(id: String): EventDoc? = rows.value[id]?.event?.doc

    fun stored(id: String): StoredEvent? = rows.value[id]?.event

}

/** The editor's use cases on [repository]. */
fun upsert(
    repository: EventRepository,
    clock: Clock = FakeClock(),
    plans: PlanProvider = FakePlans(),
    ids: EventIdGenerator = SequentialIds(),
): UpsertEventUseCase = UpsertEventUseCase(repository, clock, CheckNewEventGateUseCase(repository, plans), ids)

/** [count] owned days, for the owned-event limit. */
fun ownedDays(count: Int, archived: Int = 0): Array<EventDoc> =
    (Array(count) { event("owned-$it") } + Array(archived) { event("archived-$it", archivedAt = NOW) })

/** ViewModel tests: `viewModelScope` runs on a [StandardTestDispatcher] shared with `runTest(dispatcher)`. */
@OptIn(ExperimentalCoroutinesApi::class)
abstract class MainDispatcherTest {
    protected val dispatcher: TestDispatcher = StandardTestDispatcher()

    @BeforeTest
    fun setMainDispatcher() {
        Dispatchers.setMain(dispatcher)
    }

    @AfterTest
    fun resetMainDispatcher() {
        Dispatchers.resetMain()
    }
}

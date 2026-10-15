package dev.derek.daysthatmatter.feature.events.domain

import dev.derek.daysthatmatter.core.model.countdown.CountdownEngine
import dev.derek.daysthatmatter.core.model.countdown.CountdownTarget
import dev.derek.daysthatmatter.core.model.countdown.Direction
import dev.derek.daysthatmatter.core.model.event.Role
import dev.derek.daysthatmatter.core.model.event.UnitMode
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.datetime.TimeZone
import kotlin.time.Clock
import kotlin.time.Duration
import kotlin.time.Duration.Companion.seconds
import kotlin.time.Instant

/** Computes a day's countdown with the shared engine in `:core:model`. */
fun StoredEvent.countdownAt(now: Instant, viewerZone: TimeZone): EventCountdown =
    EventCountdown(this, CountdownEngine.compute(CountdownTarget.of(doc), now, viewerZone))

/**
 * Home's days for [HomeQuery]: search and category filter in the database, then the countdowns at each tick of
 * [ticker], the Upcoming / Since filter, sections and the sort. Pinned days come first, newest pin first.
 */
class ObserveEventsUseCase(
    private val repository: EventRepository,
    private val ticker: Ticker,
    private val zone: () -> TimeZone,
) {
    @OptIn(ExperimentalCoroutinesApi::class)
    operator fun invoke(query: Flow<HomeQuery>, period: Duration = 1.seconds): Flow<HomeDays> =
        query.distinctUntilChanged().flatMapLatest { q ->
            val category = (q.filter as? HomeFilter.Category)?.id
            combine(repository.observeHome(q.text.trim(), category), ticker.every(period)) { events, now ->
                sections(events.map { it.countdownAt(now, zone()) }, q)
            }
        }

    companion object {
        /** Splits and sorts [days] (already in database order: pinned first, newest pin first). */
        fun sections(days: List<EventCountdown>, query: HomeQuery): HomeDays {
            val shown = days.filter {
                when (query.filter) {
                    HomeFilter.Upcoming -> !it.countdown.isPast
                    HomeFilter.Since -> it.countdown.isPast
                    else -> true
                }
            }
            val (pinned, rest) = shown.partition { it.event.isPinned && it.event.isOwner }
            val sorted = rest.sortedWith(comparator(query.sort))
            return HomeDays(
                pinned = pinned.sortedByDescending { it.event.doc.pinnedAt },
                upcoming = sorted.filter { !it.countdown.isPast },
                since = sorted.filter { it.countdown.isPast },
            )
        }

        private fun comparator(sort: HomeSort): Comparator<EventCountdown> = when (sort) {
            HomeSort.Closest -> compareBy<EventCountdown> { distance(it) }.thenBy { it.event.doc.title.lowercase() }
            HomeSort.Furthest -> compareByDescending<EventCountdown> { distance(it) }.thenBy { it.event.doc.title.lowercase() }
            HomeSort.AToZ -> compareBy<EventCountdown> { it.event.doc.title.lowercase() }.thenBy { it.event.id }
            HomeSort.RecentlyAdded -> compareByDescending<EventCountdown> { it.event.createdAt }.thenBy { it.event.id }
        }

        /** Time between now and the occurrence; a day happening today is closest. */
        private fun distance(day: EventCountdown): Long =
            if (day.countdown.direction == Direction.Today) -1 else day.countdown.totalSeconds
    }
}

/** One day with its live countdown, or null when it does not exist (or was deleted). */
class ObserveEventUseCase(
    private val repository: EventRepository,
    private val ticker: Ticker,
    private val zone: () -> TimeZone,
) {
    operator fun invoke(id: String, period: Duration = 1.seconds): Flow<EventCountdown?> =
        combine(repository.observeEvent(id), ticker.every(period)) { event, now -> event?.countdownAt(now, zone()) }
}

/** Archived days with their countdowns, most recently archived first. */
class ObserveArchivedUseCase(
    private val repository: EventRepository,
    private val ticker: Ticker,
    private val zone: () -> TimeZone,
) {
    operator fun invoke(period: Duration = 1.seconds): Flow<List<EventCountdown>> =
        combine(repository.observeArchived(), ticker.every(period)) { events, now ->
            events.map { it.countdownAt(now, zone()) }
        }
}

/** The number on Home's "Archived · N" row. */
class ObserveArchivedCountUseCase(private val repository: EventRepository) {
    operator fun invoke(): Flow<Int> = repository.observeArchivedCount().distinctUntilChanged()
}

/**
 * Archives a day for the reader (design-v2 D4): hidden from Home, and unpinned in the same write. Every role may
 * archive; for a shared day it is the member's own archive, which the sync engine sends to the membership.
 */
class ArchiveEventUseCase(private val repository: EventRepository, private val clock: Clock) {
    suspend operator fun invoke(id: String): EventWriteResult {
        val now = clock.now()
        val found = repository.edit(id) { doc ->
            if (doc.archivedAt != null) doc else doc.copy(archivedAt = now, pinnedAt = null)
        }
        return if (found) EventWriteResult.Done else EventWriteResult.NotFound
    }
}

/** Brings an archived day back to Home. It is not pinned again (design-v2 D4). */
class UnarchiveEventUseCase(private val repository: EventRepository) {
    suspend operator fun invoke(id: String): EventWriteResult {
        val found = repository.edit(id) { it.copy(archivedAt = null) }
        return if (found) EventWriteResult.Done else EventWriteResult.NotFound
    }
}

/**
 * Pins or unpins one of the owner's days (`pinnedAt`, newest pin first). Members cannot pin days shared with them,
 * and archived days cannot be pinned.
 */
class PinEventUseCase(private val repository: EventRepository, private val clock: Clock) {
    suspend operator fun invoke(id: String, pinned: Boolean): EventWriteResult {
        val event = repository.get(id) ?: return EventWriteResult.NotFound
        if (!event.isOwner || (pinned && event.isArchived)) return EventWriteResult.NotAllowed
        val now = clock.now()
        repository.edit(id) { it.copy(pinnedAt = if (pinned) now else null) }
        return EventWriteResult.Done
    }
}

/** Deletes a day (for a shared day: leaves it). The row stays marked until the sync engine sends it. */
class DeleteEventUseCase(private val repository: EventRepository) {
    suspend operator fun invoke(id: String): EventWriteResult =
        if (repository.delete(id)) EventWriteResult.Done else EventWriteResult.NotFound
}

/** Undoes [DeleteEventUseCase]. */
class RestoreEventUseCase(private val repository: EventRepository) {
    suspend operator fun invoke(id: String): EventWriteResult =
        if (repository.restore(id)) EventWriteResult.Done else EventWriteResult.NotFound
}

/**
 * Sets a day's unit mode (`unitMode`, a shared field): the owner and editors may, viewers may not
 * (`countdown-units` spec).
 */
class SetUnitModeUseCase(private val repository: EventRepository) {
    suspend operator fun invoke(id: String, mode: UnitMode): EventWriteResult {
        val event = repository.get(id) ?: return EventWriteResult.NotFound
        if (!event.role.canEditSharedFields) return EventWriteResult.NotAllowed
        repository.edit(id) { it.copy(unitMode = mode) }
        return EventWriteResult.Done
    }

    companion object {
        /** The unit after [mode] when the number is tapped: Auto, Days, Weeks, Hours, Calendar, Workdays, Auto. */
        fun next(mode: UnitMode): UnitMode = UnitMode.entries[(mode.ordinal + 1) % UnitMode.entries.size]

        /** Whether [role] gets the unit control on the day page. */
        fun canChange(role: Role): Boolean = role.canEditSharedFields
    }
}

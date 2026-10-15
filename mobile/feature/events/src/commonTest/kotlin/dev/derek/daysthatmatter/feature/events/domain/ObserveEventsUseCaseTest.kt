package dev.derek.daysthatmatter.feature.events.domain

import app.cash.turbine.test
import dev.derek.daysthatmatter.core.model.event.Role
import dev.derek.daysthatmatter.feature.events.FakeEventRepository
import dev.derek.daysthatmatter.feature.events.FakeTicker
import dev.derek.daysthatmatter.feature.events.NOW
import dev.derek.daysthatmatter.feature.events.UTC
import dev.derek.daysthatmatter.feature.events.event
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import kotlinx.datetime.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.time.Duration.Companion.days
import kotlin.time.Duration.Companion.hours

class ObserveEventsUseCaseTest {

    private val repository = FakeEventRepository(
        event("a", title = "Alpha", date = LocalDate(2026, 10, 20)),
        event("b", title = "Bravo", date = LocalDate(2027, 1, 1)),
        event("c", title = "Charlie", date = LocalDate(2026, 10, 1)),
        event("d", title = "Delta", date = LocalDate(2025, 1, 1), category = "life"),
        event("p1", title = "Pinned new", date = LocalDate(2027, 5, 1), pinnedAt = NOW - 1.hours),
        event("p2", title = "Pinned old", date = LocalDate(2026, 11, 1), pinnedAt = NOW - 2.hours),
        event("shared", title = "Shared", date = LocalDate(2026, 10, 16), role = Role.Editor, pinnedAt = NOW),
        event("today", title = "Today", date = LocalDate(2026, 10, 14), category = "life"),
        event("archived", date = LocalDate(2026, 10, 15), archivedAt = NOW - 1.days),
    )
    private val ticker = FakeTicker()
    private val useCase = ObserveEventsUseCase(repository, ticker, UTC)

    private fun HomeDays.ids() = Triple(pinned.map { it.event.id }, upcoming.map { it.event.id }, since.map { it.event.id })

    @Test
    fun closestFirstWithPinnedDaysFirstNewestPinFirst() = runTest {
        val days = useCase(MutableStateFlow(HomeQuery())).first()

        assertEquals(
            Triple(listOf("p1", "p2"), listOf("today", "shared", "a", "b"), listOf("c", "d")),
            days.ids(),
        )
    }

    @Test
    fun aSharedDayIsNeverInThePinnedSection() = runTest {
        val days = useCase(MutableStateFlow(HomeQuery())).first()

        assertTrue(days.pinned.none { it.event.id == "shared" })
    }

    @Test
    fun otherSorts() = runTest {
        val query = MutableStateFlow(HomeQuery(sort = HomeSort.Furthest))
        useCase(query).test {
            assertEquals(Triple(listOf("p1", "p2"), listOf("b", "a", "shared", "today"), listOf("d", "c")), awaitItem().ids())
            query.value = HomeQuery(sort = HomeSort.AToZ)
            assertEquals(Triple(listOf("p1", "p2"), listOf("a", "b", "shared", "today"), listOf("c", "d")), awaitItem().ids())
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun recentlyAddedSortsByCreationTime() = runTest {
        repository.put(event("new1", date = LocalDate(2027, 2, 1)), createdAt = NOW - 1.hours)
        repository.put(event("new2", date = LocalDate(2027, 3, 1)), createdAt = NOW)

        useCase(MutableStateFlow(HomeQuery(sort = HomeSort.RecentlyAdded))).test {
            assertEquals(listOf("new2", "new1"), awaitItem().upcoming.take(2).map { it.event.id })
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun upcomingAndSinceFilters() = runTest {
        val query = MutableStateFlow(HomeQuery(filter = HomeFilter.Upcoming))
        useCase(query).test {
            assertEquals(Triple(listOf("p1", "p2"), listOf("today", "shared", "a", "b"), emptyList()), awaitItem().ids())
            query.value = HomeQuery(filter = HomeFilter.Since)
            assertEquals(Triple(emptyList(), emptyList(), listOf("c", "d")), awaitItem().ids())
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun categoryAndSearchFilters() = runTest {
        val query = MutableStateFlow(HomeQuery(filter = HomeFilter.Category("life")))
        useCase(query).test {
            assertEquals(Triple(emptyList(), listOf("today"), listOf("d")), awaitItem().ids())
            query.value = HomeQuery(text = "  PINNED ")
            assertEquals(Triple(listOf("p1", "p2"), emptyList(), emptyList()), awaitItem().ids())
            query.value = HomeQuery(text = "nothing like this")
            assertTrue(awaitItem().isEmpty)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun countdownsFollowTheTicker() = runTest {
        useCase(MutableStateFlow(HomeQuery(text = "Alpha"))).test {
            assertEquals(5, awaitItem().upcoming.single().countdown.totalDays)
            ticker.tick(1.days)
            assertEquals(4, awaitItem().upcoming.single().countdown.totalDays)
            cancelAndIgnoreRemainingEvents()
        }
    }
}

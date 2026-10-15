package dev.derek.daysthatmatter.feature.events.presentation

import app.cash.turbine.test
import dev.derek.daysthatmatter.core.model.event.CardSize
import dev.derek.daysthatmatter.core.model.event.Role
import dev.derek.daysthatmatter.feature.events.FakeClock
import dev.derek.daysthatmatter.feature.events.FakeEventRepository
import dev.derek.daysthatmatter.feature.events.FakeTicker
import dev.derek.daysthatmatter.feature.events.NOW
import dev.derek.daysthatmatter.feature.events.UTC
import dev.derek.daysthatmatter.feature.events.domain.ArchiveEventUseCase
import dev.derek.daysthatmatter.feature.events.domain.DeleteEventUseCase
import dev.derek.daysthatmatter.feature.events.domain.HomeFilter
import dev.derek.daysthatmatter.feature.events.domain.HomeSort
import dev.derek.daysthatmatter.feature.events.domain.ObserveArchivedCountUseCase
import dev.derek.daysthatmatter.feature.events.domain.ObserveEventsUseCase
import dev.derek.daysthatmatter.feature.events.domain.PinEventUseCase
import dev.derek.daysthatmatter.feature.events.domain.RestoreEventUseCase
import dev.derek.daysthatmatter.feature.events.event
import dev.derek.daysthatmatter.feature.events.presentation.home.HomeEffect
import dev.derek.daysthatmatter.feature.events.presentation.home.HomeEmpty
import dev.derek.daysthatmatter.feature.events.presentation.home.HomeIntent
import dev.derek.daysthatmatter.feature.events.presentation.home.HomeLayout
import dev.derek.daysthatmatter.feature.events.presentation.home.HomeSectionKind
import dev.derek.daysthatmatter.feature.events.presentation.home.HomeUiState
import dev.derek.daysthatmatter.feature.events.presentation.home.HomeViewModel
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runTest
import kotlinx.datetime.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.time.Duration.Companion.hours
import kotlin.time.Duration.Companion.seconds

class HomeViewModelTest : MainDispatcherTest() {

    private val clock = FakeClock()
    private val ticker = FakeTicker()

    private fun repository() = FakeEventRepository(
        event("trip", title = "Norway trip", date = LocalDate(2026, 10, 20), pinnedAt = NOW - 1.hours, size = CardSize.Large),
        event("party", title = "Party", date = LocalDate(2026, 12, 1), category = "life"),
        event("shared", title = "Grandma's 90th", date = LocalDate(2026, 11, 1), role = Role.Editor),
        event("mochi", title = "Mochi came home", date = LocalDate(2024, 3, 9)),
        event("test", title = "Driving test", date = LocalDate(2026, 6, 1), archivedAt = NOW - 1.hours),
    )

    private fun viewModel(repository: FakeEventRepository) = HomeViewModel(
        observeEvents = ObserveEventsUseCase(repository, ticker, UTC),
        observeArchivedCount = ObserveArchivedCountUseCase(repository),
        pinEvent = PinEventUseCase(repository, clock),
        archiveEvent = ArchiveEventUseCase(repository, clock),
        deleteEvent = DeleteEventUseCase(repository),
        restoreEvent = RestoreEventUseCase(repository),
        clock = clock,
        zone = UTC,
    )

    private fun HomeUiState.ids() = sections.associate { it.kind to it.items.map { item -> item.id } }

    @Test
    fun loadingThenSectionsWithPinnedFirstAndTheArchivedRow() = runTest(dispatcher) {
        val vm = viewModel(repository())

        vm.state.test {
            val loading = awaitItem()
            assertTrue(loading.loading)
            assertTrue(loading.sections.isEmpty())

            val content = awaitItem()
            assertFalse(content.loading)
            assertEquals("Wednesday, October 14", content.kicker)
            assertEquals(
                mapOf(
                    HomeSectionKind.Pinned to listOf("trip"),
                    HomeSectionKind.Upcoming to listOf("shared", "party"),
                    HomeSectionKind.Since to listOf("mochi"),
                ),
                content.ids(),
            )
            assertEquals(1, content.archivedCount)
            assertTrue(content.showArchivedRow)
            assertNull(content.empty)
            val trip = content.sections.first().items.single()
            assertTrue(trip.pinned && trip.canPin)
            val shared = content.sections[1].items.first()
            assertFalse(shared.canPin)
            assertFalse(shared.isOwner)
            assertEquals(listOf("All", "Upcoming", "Since", "Birthdays", "Anniversaries", "Travel", "Holidays", "Work", "Life"), content.chips.map { it.label })
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun theLargeCardTicksEverySecond() = runTest(dispatcher) {
        val vm = viewModel(repository())

        vm.state.test {
            skipItems(1)
            assertEquals("5d 15h 00m 00s", awaitItem().sections.first().items.single().card.tick)
            ticker.tick(1.seconds)
            assertEquals("5d 14h 59m 59s", awaitItem().sections.first().items.single().card.tick)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun searchFiltersAndClosingSearchClearsIt() = runTest(dispatcher) {
        val vm = viewModel(repository())

        vm.state.test {
            skipItems(2)
            vm.onIntent(HomeIntent.ToggleSearch)
            assertTrue(awaitItem().searching)
            vm.onIntent(HomeIntent.QueryChanged("mochi"))
            assertEquals("mochi", awaitItem().query)
            val found = awaitItem()
            assertEquals(mapOf(HomeSectionKind.Since to listOf("mochi")), found.ids())
            assertFalse(found.showArchivedRow)

            vm.onIntent(HomeIntent.QueryChanged("zzz"))
            assertEquals("zzz", awaitItem().query)
            assertEquals(HomeEmpty.NoMatches, awaitItem().empty)

            vm.onIntent(HomeIntent.ToggleSearch)
            val closed = awaitItem()
            assertFalse(closed.searching)
            assertEquals("", closed.query)
            assertEquals(4, awaitItem().sections.sumOf { it.items.size })
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun filterSortAndLayout() = runTest(dispatcher) {
        val vm = viewModel(repository())

        vm.state.test {
            skipItems(2)
            vm.onIntent(HomeIntent.SelectFilter(HomeFilter.Since))
            assertEquals(HomeFilter.Since, awaitItem().filter)
            val since = awaitItem()
            assertEquals(mapOf(HomeSectionKind.Since to listOf("mochi")), since.ids())
            assertFalse(since.showArchivedRow)

            vm.onIntent(HomeIntent.SelectFilter(HomeFilter.All))
            skipItems(2)
            vm.onIntent(HomeIntent.SelectSort(HomeSort.Furthest))
            assertEquals(HomeSort.Furthest, awaitItem().sort)
            assertEquals(listOf("party", "shared"), awaitItem().ids()[HomeSectionKind.Upcoming])

            vm.onIntent(HomeIntent.ToggleLayout)
            assertEquals(HomeLayout.Grid, awaitItem().layout)
            vm.onIntent(HomeIntent.ToggleLayout)
            assertEquals(HomeLayout.List, awaitItem().layout)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun anEmptyDatabaseShowsNothingYet() = runTest(dispatcher) {
        val vm = viewModel(FakeEventRepository())

        vm.state.test {
            skipItems(1)
            val empty = awaitItem()
            assertEquals(HomeEmpty.NothingYet, empty.empty)
            assertFalse(empty.showArchivedRow)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun openingADayAndTheArchiveAreEffects() = runTest(dispatcher) {
        val vm = viewModel(repository())

        vm.effect.test {
            vm.onIntent(HomeIntent.OpenDay("trip"))
            assertEquals(HomeEffect.OpenDay("trip"), awaitItem())
            vm.onIntent(HomeIntent.OpenArchived)
            assertEquals(HomeEffect.OpenArchived, awaitItem())
        }
    }

    @Test
    fun archivingMovesTheDayToTheArchivedRow() = runTest(dispatcher) {
        val repository = repository()
        val vm = viewModel(repository)
        backgroundScope.launch { vm.state.collect {} }

        vm.effect.test {
            vm.onIntent(HomeIntent.Archive("trip"))
            assertEquals(HomeEffect.Message("Archived"), awaitItem())
        }
        testScheduler.runCurrent()
        vm.state.test {
            val state = expectMostRecentItem()
            assertEquals(2, state.archivedCount)
            assertNull(state.ids()[HomeSectionKind.Pinned])
            assertNull(repository.doc("trip")?.pinnedAt)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun deleteOffersUndo() = runTest(dispatcher) {
        val repository = repository()
        val vm = viewModel(repository)

        vm.effect.test {
            vm.onIntent(HomeIntent.Delete("party"))
            assertEquals(HomeEffect.Message("Deleted", undoDeleteId = "party"), awaitItem())
        }
        assertTrue(repository.isDeleted("party"))
        vm.onIntent(HomeIntent.UndoDelete("party"))
        testScheduler.runCurrent()
        assertFalse(repository.isDeleted("party"))
    }

    @Test
    fun pinningFollowsTheOwnerRule() = runTest(dispatcher) {
        val repository = repository()
        val vm = viewModel(repository)
        backgroundScope.launch { vm.state.collect {} }

        vm.effect.test {
            vm.onIntent(HomeIntent.SetPinned("shared", true))
            assertEquals(HomeEffect.Message("Only the owner can pin this day"), awaitItem())
        }
        vm.onIntent(HomeIntent.SetPinned("party", true))
        testScheduler.runCurrent()
        assertEquals(NOW, repository.doc("party")?.pinnedAt)
        testScheduler.runCurrent()
        vm.state.test {
            assertEquals(listOf("party", "trip"), expectMostRecentItem().ids()[HomeSectionKind.Pinned])
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun tickingStopsWhenTheScreenStopsCollecting() = runTest(dispatcher) {
        val vm = viewModel(repository())
        val screen = backgroundScope.launch { vm.state.collect {} }
        testScheduler.runCurrent()
        assertEquals(1, ticker.time.subscriptionCount.value)

        screen.cancel()
        testScheduler.advanceTimeBy(HomeViewModel.STOP_TIMEOUT_MS + 1)
        testScheduler.runCurrent()
        assertEquals(0, ticker.time.subscriptionCount.value)
    }
}

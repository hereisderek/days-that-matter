package dev.derek.daysthatmatter.feature.events.presentation

import app.cash.turbine.test
import dev.derek.daysthatmatter.core.model.event.Role
import dev.derek.daysthatmatter.core.model.event.UnitMode
import dev.derek.daysthatmatter.feature.events.FakeEventRepository
import dev.derek.daysthatmatter.feature.events.FakeTicker
import dev.derek.daysthatmatter.feature.events.NOW
import dev.derek.daysthatmatter.feature.events.UTC
import dev.derek.daysthatmatter.feature.events.domain.DeleteEventUseCase
import dev.derek.daysthatmatter.feature.events.domain.ObserveEventUseCase
import dev.derek.daysthatmatter.feature.events.domain.SetUnitModeUseCase
import dev.derek.daysthatmatter.feature.events.domain.UnarchiveEventUseCase
import dev.derek.daysthatmatter.feature.events.event
import dev.derek.daysthatmatter.feature.events.presentation.day.DayEffect
import dev.derek.daysthatmatter.feature.events.presentation.day.DayIntent
import dev.derek.daysthatmatter.feature.events.presentation.day.DayUiState
import dev.derek.daysthatmatter.feature.events.presentation.day.DetailRow
import dev.derek.daysthatmatter.feature.events.presentation.day.EventDetailViewModel
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runTest
import kotlinx.datetime.LocalDate
import kotlinx.datetime.LocalTime
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertTrue
import kotlin.time.Duration.Companion.hours
import kotlin.time.Duration.Companion.seconds

class EventDetailViewModelTest : MainDispatcherTest() {

    private val ticker = FakeTicker()
    private val repository = FakeEventRepository(
        event(
            "trip", title = "Norway trip", date = LocalDate(2026, 11, 21), time = LocalTime(9, 30), zone = "Europe/Oslo",
            category = "travel", unitMode = UnitMode.Hours, pinnedAt = NOW,
        ),
        event("edit", title = "Grandma's 90th", date = LocalDate(2026, 12, 17), role = Role.Editor),
        event("view", title = "Launch", date = LocalDate(2026, 12, 1), role = Role.Viewer),
        event("old", title = "Driving test", date = LocalDate(2026, 6, 16), archivedAt = NOW - 1.hours),
    )

    private fun viewModel(id: String) = EventDetailViewModel(
        eventId = id,
        observeEvent = ObserveEventUseCase(repository, ticker, UTC),
        setUnitMode = SetUnitModeUseCase(repository),
        unarchiveEvent = UnarchiveEventUseCase(repository),
        deleteEvent = DeleteEventUseCase(repository),
        zone = UTC,
    )

    @Test
    fun loadingThenTheOwnersDay() = runTest(dispatcher) {
        val vm = viewModel("trip")

        vm.state.test {
            assertEquals(DayUiState.Loading, awaitItem())
            val day = assertIs<DayUiState.Content>(awaitItem())
            assertEquals("Norway trip", day.title)
            assertEquals("✈️ Travel", day.badge)
            assertEquals("Saturday, November 21, 2026 · 9:30 AM Oslo time (8:30 AM here)", day.dateLine)
            assertEquals("911", day.number)
            assertEquals("hours left", day.unit)
            assertEquals("37d 23h 30m 00s", day.tick)
            assertTrue(day.canChangeUnit)
            assertFalse(day.showWorkdaysNote)
            assertFalse(day.archived)
            assertEquals(
                listOf(
                    DetailRow("Date", "Saturday, November 21, 2026"),
                    DetailRow("Time", "9:30 AM"),
                    DetailRow("Time zone", "Fixed · Oslo"),
                    DetailRow("Repeats", "Never"),
                    DetailRow("Count in", "Hours"),
                    DetailRow("Pinned", "Yes"),
                ),
                day.details,
            )
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun theNumberTicksEverySecond() = runTest(dispatcher) {
        val vm = viewModel("trip")

        vm.state.test {
            skipItems(1)
            assertEquals("37d 23h 30m 00s", assertIs<DayUiState.Content>(awaitItem()).tick)
            ticker.tick(1.seconds)
            assertEquals("37d 23h 29m 59s", assertIs<DayUiState.Content>(awaitItem()).tick)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun ownerTapsTheNumberToCycleUnitsAndPicksFromTheList() = runTest(dispatcher) {
        val vm = viewModel("trip")

        vm.state.test {
            skipItems(2)
            vm.onIntent(DayIntent.CycleUnit)
            val calendar = assertIs<DayUiState.Content>(awaitItem())
            assertEquals(UnitMode.Calendar, calendar.unitMode)
            assertEquals("1m 6d", calendar.number)
            assertEquals(UnitMode.Calendar, repository.doc("trip")?.unitMode)

            vm.onIntent(DayIntent.SelectUnit(UnitMode.Workdays))
            val workdays = assertIs<DayUiState.Content>(awaitItem())
            assertEquals("27", workdays.number)
            assertEquals("workdays left", workdays.unit)
            assertTrue(workdays.showWorkdaysNote)

            vm.onIntent(DayIntent.CycleUnit)
            assertEquals(UnitMode.Auto, assertIs<DayUiState.Content>(awaitItem()).unitMode)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun editorsCanChangeTheUnit() = runTest(dispatcher) {
        val vm = viewModel("edit")

        vm.state.test {
            skipItems(1)
            val day = assertIs<DayUiState.Content>(awaitItem())
            assertEquals("Shared · Editor", day.badge)
            assertTrue(day.canChangeUnit)
            assertTrue(day.details.none { it.label == "Pinned" })
            vm.onIntent(DayIntent.CycleUnit)
            assertEquals(UnitMode.Days, assertIs<DayUiState.Content>(awaitItem()).unitMode)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun viewersGetNoUnitControl() = runTest(dispatcher) {
        val vm = viewModel("view")

        vm.state.test {
            skipItems(1)
            val day = assertIs<DayUiState.Content>(awaitItem())
            assertEquals("Shared · Viewer", day.badge)
            assertFalse(day.canChangeUnit)
            vm.onIntent(DayIntent.CycleUnit)
            vm.onIntent(DayIntent.SelectUnit(UnitMode.Days))
            testScheduler.runCurrent()
            expectNoEvents()
            cancelAndIgnoreRemainingEvents()
        }
        assertEquals(UnitMode.Auto, repository.doc("view")?.unitMode)
        assertEquals(0, repository.edits)
    }

    @Test
    fun archivedDaysOfferUnarchive() = runTest(dispatcher) {
        val vm = viewModel("old")

        vm.state.test {
            skipItems(1)
            val day = assertIs<DayUiState.Content>(awaitItem())
            assertTrue(day.archived)
            assertEquals("Since Tuesday, June 16, 2026", day.dateLine)
            vm.effect.test {
                vm.onIntent(DayIntent.Unarchive)
                assertEquals(DayEffect.Message("Back on Home"), awaitItem())
            }
            assertFalse(assertIs<DayUiState.Content>(awaitItem()).archived)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun deleteClosesThePageAndAMissingDayIsNotFound() = runTest(dispatcher) {
        val vm = viewModel("edit")
        backgroundScope.launch { vm.state.collect {} }

        vm.effect.test {
            vm.onIntent(DayIntent.Delete)
            assertEquals(DayEffect.Close, awaitItem())
            vm.onIntent(DayIntent.Back)
            assertEquals(DayEffect.Close, awaitItem())
        }
        testScheduler.runCurrent()
        vm.state.test {
            assertEquals(DayUiState.NotFound, expectMostRecentItem())
            cancelAndIgnoreRemainingEvents()
        }
        viewModel("nope").state.test {
            assertEquals(DayUiState.Loading, awaitItem())
            assertEquals(DayUiState.NotFound, awaitItem())
            cancelAndIgnoreRemainingEvents()
        }
    }
}

package dev.derek.daysthatmatter.feature.events.presentation

import app.cash.turbine.test
import dev.derek.daysthatmatter.core.model.event.Role
import dev.derek.daysthatmatter.feature.events.FakeEventRepository
import dev.derek.daysthatmatter.feature.events.FakeTicker
import dev.derek.daysthatmatter.feature.events.NOW
import dev.derek.daysthatmatter.feature.events.UTC
import dev.derek.daysthatmatter.feature.events.domain.DeleteEventUseCase
import dev.derek.daysthatmatter.feature.events.domain.ObserveArchivedUseCase
import dev.derek.daysthatmatter.feature.events.domain.RestoreEventUseCase
import dev.derek.daysthatmatter.feature.events.domain.UnarchiveEventUseCase
import dev.derek.daysthatmatter.feature.events.event
import dev.derek.daysthatmatter.feature.events.presentation.archived.ArchivedEffect
import dev.derek.daysthatmatter.feature.events.presentation.archived.ArchivedIntent
import dev.derek.daysthatmatter.feature.events.presentation.archived.ArchivedViewModel
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.time.Duration.Companion.hours

class ArchivedViewModelTest : MainDispatcherTest() {

    private val repository = FakeEventRepository(
        event("home"),
        event("older", archivedAt = NOW - 2.hours),
        event("newer", archivedAt = NOW - 1.hours),
        event("shared", archivedAt = NOW - 3.hours, role = Role.Viewer),
    )

    private fun viewModel() = ArchivedViewModel(
        observeArchived = ObserveArchivedUseCase(repository, FakeTicker(), UTC),
        unarchiveEvent = UnarchiveEventUseCase(repository),
        deleteEvent = DeleteEventUseCase(repository),
        restoreEvent = RestoreEventUseCase(repository),
    )

    @Test
    fun loadingThenArchivedDaysNewestFirst() = runTest(dispatcher) {
        viewModel().state.test {
            assertTrue(awaitItem().loading)
            val state = awaitItem()
            assertFalse(state.loading)
            assertEquals(listOf("newer", "older", "shared"), state.items.map { it.id })
            assertFalse(state.items.last().isOwner)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun unarchiveReturnsTheDayToHome() = runTest(dispatcher) {
        val vm = viewModel()
        backgroundScope.launch { vm.state.collect {} }

        vm.effect.test {
            vm.onIntent(ArchivedIntent.Unarchive("older"))
            assertEquals(ArchivedEffect.Message("Back on Home"), awaitItem())
        }
        assertNull(repository.doc("older")?.archivedAt)
        testScheduler.runCurrent()
        vm.state.test {
            assertEquals(listOf("newer", "shared"), expectMostRecentItem().items.map { it.id })
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun deleteOrLeaveWithUndo() = runTest(dispatcher) {
        val vm = viewModel()
        vm.state.test {
            skipItems(2)
            cancelAndIgnoreRemainingEvents()
        }

        vm.effect.test {
            vm.onIntent(ArchivedIntent.Delete("newer"))
            assertEquals(ArchivedEffect.Message("Deleted", undoDeleteId = "newer"), awaitItem())
            vm.onIntent(ArchivedIntent.Delete("shared"))
            assertEquals(ArchivedEffect.Message("Left the day", undoDeleteId = "shared"), awaitItem())
        }
        assertTrue(repository.isDeleted("newer"))
        vm.onIntent(ArchivedIntent.UndoDelete("newer"))
        testScheduler.runCurrent()
        assertFalse(repository.isDeleted("newer"))
    }

    @Test
    fun openAndBackAreEffects() = runTest(dispatcher) {
        val vm = viewModel()

        vm.effect.test {
            vm.onIntent(ArchivedIntent.Open("older"))
            assertEquals(ArchivedEffect.OpenDay("older"), awaitItem())
            vm.onIntent(ArchivedIntent.Back)
            assertEquals(ArchivedEffect.Close, awaitItem())
        }
    }
}

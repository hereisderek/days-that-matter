package dev.derek.daysthatmatter.feature.events.domain

import app.cash.turbine.test
import dev.derek.daysthatmatter.core.model.event.Role
import dev.derek.daysthatmatter.core.model.event.UnitMode
import dev.derek.daysthatmatter.feature.events.FakeClock
import dev.derek.daysthatmatter.feature.events.FakeEventRepository
import dev.derek.daysthatmatter.feature.events.FakeTicker
import dev.derek.daysthatmatter.feature.events.NOW
import dev.derek.daysthatmatter.feature.events.UTC
import dev.derek.daysthatmatter.feature.events.event
import kotlinx.coroutines.test.runTest
import kotlinx.datetime.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.time.Duration.Companion.hours
import kotlin.time.Duration.Companion.minutes

class WriteUseCasesTest {

    private val clock = FakeClock()
    private val repository = FakeEventRepository(
        event("mine", pinnedAt = NOW - 2.hours),
        event("plain"),
        event("editor", role = Role.Editor),
        event("viewer", role = Role.Viewer),
        event("archived", archivedAt = NOW - 1.hours),
    )

    @Test
    fun archivingAPinnedDayUnpinsItAndUnarchivingDoesNotPinItAgain() = runTest {
        clock.now = NOW + 5.minutes

        assertEquals(EventWriteResult.Done, ArchiveEventUseCase(repository, clock)("mine"))
        assertEquals(NOW + 5.minutes, repository.doc("mine")?.archivedAt)
        assertNull(repository.doc("mine")?.pinnedAt)

        assertEquals(EventWriteResult.Done, UnarchiveEventUseCase(repository)("mine"))
        assertNull(repository.doc("mine")?.archivedAt)
        assertNull(repository.doc("mine")?.pinnedAt)
    }

    @Test
    fun archivingTwiceKeepsTheFirstTime() = runTest {
        ArchiveEventUseCase(repository, clock)("archived")

        assertEquals(NOW - 1.hours, repository.doc("archived")?.archivedAt)
        assertEquals(0, repository.edits)
    }

    @Test
    fun membersCanArchiveTheirCopy() = runTest {
        assertEquals(EventWriteResult.Done, ArchiveEventUseCase(repository, clock)("viewer"))
        assertEquals(NOW, repository.doc("viewer")?.archivedAt)
    }

    @Test
    fun missingDaysReportNotFound() = runTest {
        assertEquals(EventWriteResult.NotFound, ArchiveEventUseCase(repository, clock)("nope"))
        assertEquals(EventWriteResult.NotFound, UnarchiveEventUseCase(repository)("nope"))
        assertEquals(EventWriteResult.NotFound, PinEventUseCase(repository, clock)("nope", true))
        assertEquals(EventWriteResult.NotFound, DeleteEventUseCase(repository)("nope"))
        assertEquals(EventWriteResult.NotFound, RestoreEventUseCase(repository)("nope"))
        assertEquals(EventWriteResult.NotFound, SetUnitModeUseCase(repository)("nope", UnitMode.Days))
    }

    @Test
    fun ownersPinAndUnpin() = runTest {
        val pin = PinEventUseCase(repository, clock)

        assertEquals(EventWriteResult.Done, pin("plain", pinned = true))
        assertEquals(NOW, repository.doc("plain")?.pinnedAt)
        assertEquals(EventWriteResult.Done, pin("plain", pinned = false))
        assertNull(repository.doc("plain")?.pinnedAt)
    }

    @Test
    fun membersCannotPinAndArchivedDaysCannotBePinned() = runTest {
        val pin = PinEventUseCase(repository, clock)

        assertEquals(EventWriteResult.NotAllowed, pin("editor", pinned = true))
        assertEquals(EventWriteResult.NotAllowed, pin("viewer", pinned = true))
        assertEquals(EventWriteResult.NotAllowed, pin("archived", pinned = true))
        assertNull(repository.doc("editor")?.pinnedAt)
        assertEquals(0, repository.edits)
    }

    @Test
    fun deleteAndRestore() = runTest {
        assertEquals(EventWriteResult.Done, DeleteEventUseCase(repository)("plain"))
        assertTrue(repository.isDeleted("plain"))
        assertEquals(EventWriteResult.NotFound, DeleteEventUseCase(repository)("plain"))

        assertEquals(EventWriteResult.Done, RestoreEventUseCase(repository)("plain"))
        assertFalse(repository.isDeleted("plain"))
    }

    @Test
    fun ownersAndEditorsChangeTheUnitViewersCannot() = runTest {
        val setUnit = SetUnitModeUseCase(repository)

        assertEquals(EventWriteResult.Done, setUnit("plain", UnitMode.Workdays))
        assertEquals(UnitMode.Workdays, repository.doc("plain")?.unitMode)
        assertEquals(EventWriteResult.Done, setUnit("editor", UnitMode.Hours))
        assertEquals(UnitMode.Hours, repository.doc("editor")?.unitMode)
        assertEquals(EventWriteResult.NotAllowed, setUnit("viewer", UnitMode.Hours))
        assertEquals(UnitMode.Auto, repository.doc("viewer")?.unitMode)
    }

    @Test
    fun tappingCyclesThroughAllSixUnits() {
        val seen = generateSequence(UnitMode.Auto) { SetUnitModeUseCase.next(it) }.take(7).toList()

        assertEquals(
            listOf(UnitMode.Auto, UnitMode.Days, UnitMode.Weeks, UnitMode.Hours, UnitMode.Calendar, UnitMode.Workdays, UnitMode.Auto),
            seen,
        )
        assertTrue(SetUnitModeUseCase.canChange(Role.Owner))
        assertTrue(SetUnitModeUseCase.canChange(Role.Editor))
        assertFalse(SetUnitModeUseCase.canChange(Role.Viewer))
    }

    @Test
    fun observeOneDayAndArchivedDays() = runTest {
        val ticker = FakeTicker()
        ObserveEventUseCase(repository, ticker, UTC)("plain").test {
            assertEquals("plain", awaitItem()?.event?.id)
            DeleteEventUseCase(repository)("plain")
            assertNull(awaitItem())
            cancelAndIgnoreRemainingEvents()
        }
        ObserveArchivedUseCase(repository, ticker, UTC)().test {
            assertEquals(listOf("archived"), awaitItem().map { it.event.id })
            cancelAndIgnoreRemainingEvents()
        }
        ObserveArchivedCountUseCase(repository)().test {
            assertEquals(1, awaitItem())
            ArchiveEventUseCase(repository, clock)("editor")
            assertEquals(2, awaitItem())
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun storedEventRoles() {
        val created = event("x", role = null, date = LocalDate(2026, 1, 1))
        val stored = StoredEvent(created, NOW)

        assertEquals(Role.Owner, stored.role)
        assertTrue(stored.isOwner)
        assertFalse(stored.isPinned)
        assertFalse(stored.isArchived)
    }
}

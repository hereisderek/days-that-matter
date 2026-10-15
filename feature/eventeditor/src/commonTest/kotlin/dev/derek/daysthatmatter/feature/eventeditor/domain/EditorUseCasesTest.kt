package dev.derek.daysthatmatter.feature.eventeditor.domain

import dev.derek.daysthatmatter.core.model.event.CardSize
import dev.derek.daysthatmatter.core.model.event.Role
import dev.derek.daysthatmatter.core.model.plan.Feature
import dev.derek.daysthatmatter.core.model.plan.GateResult
import dev.derek.daysthatmatter.core.model.plan.Plan
import dev.derek.daysthatmatter.feature.eventeditor.FakeClock
import dev.derek.daysthatmatter.feature.eventeditor.FakeEventRepository
import dev.derek.daysthatmatter.feature.eventeditor.FakePlans
import dev.derek.daysthatmatter.feature.eventeditor.NOW
import dev.derek.daysthatmatter.feature.eventeditor.event
import dev.derek.daysthatmatter.feature.eventeditor.ownedDays
import dev.derek.daysthatmatter.feature.eventeditor.upsert
import kotlinx.coroutines.test.runTest
import kotlinx.datetime.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue
import kotlin.time.Duration.Companion.minutes

class EditorUseCasesTest {

    private val newDraft = EventDraft.new(LocalDate(2026, 11, 13), "Europe/Oslo").copy(title = "Norway trip")

    @Test
    fun onlyTheOwnerLoadsADayForEditing() = runTest {
        val repository = FakeEventRepository(
            event("mine"),
            event("legacy", role = null),
            event("edits", role = Role.Editor),
            event("views", role = Role.Viewer),
            event("gone"),
        )
        repository.delete("gone")
        val load = LoadEditableEventUseCase(repository)

        assertIs<EditableEvent.Found>(load("mine"))
        assertIs<EditableEvent.Found>(load("legacy"))
        assertEquals(EditableEvent.NotAllowed, load("edits"))
        assertEquals(EditableEvent.NotAllowed, load("views"))
        assertEquals(EditableEvent.NotFound, load("gone"))
        assertEquals(EditableEvent.NotFound, load("missing"))
    }

    @Test
    fun theGateCountsOwnedDaysArchivedIncludedButNotSharedOnes() = runTest {
        val plans = FakePlans()
        val repository = FakeEventRepository(*ownedDays(8, archived = 1), event("shared", role = Role.Viewer))
        val gate = CheckNewEventGateUseCase(repository, plans)

        assertEquals(GateCheck(Plan.Free, GateResult.Allowed), gate())

        repository.put(event("tenth"))
        assertEquals(GateCheck(Plan.Free, GateResult.PremiumRequired(Feature.Events)), gate())

        plans.plan = Plan.Premium
        assertEquals(GateResult.Allowed, gate().result)
    }

    @Test
    fun creatingStoresAnOwnedUnsyncedDayWithANewId() = runTest {
        val repository = FakeEventRepository()
        val clock = FakeClock(NOW + 5.minutes)

        val result = upsert(repository, clock)(newDraft)

        assertEquals(SaveResult.Saved("id-1", created = true), result)
        val stored = repository.stored("id-1")!!
        assertEquals(NOW + 5.minutes, stored.createdAt)
        assertEquals(Role.Owner, stored.doc.role)
        assertEquals(0, stored.doc.rev)
        assertEquals("Norway trip", stored.doc.title)
        assertEquals("Europe/Oslo", stored.doc.timeZone)
    }

    @Test
    fun anInvalidNewDayIsNotStored() = runTest {
        val repository = FakeEventRepository()

        val result = upsert(repository)(newDraft.copy(title = "  "))

        assertIs<SaveResult.Invalid>(result)
        assertEquals(listOf(DraftField.Title), result.errors.map { DraftField.of(it.field) })
        assertEquals(0, repository.adds)
    }

    @Test
    fun theOwnedEventLimitBlocksANewDay() = runTest {
        val repository = FakeEventRepository(*ownedDays(10))

        val result = upsert(repository)(newDraft)

        assertEquals(SaveResult.Blocked(GateCheck(Plan.Free, GateResult.PremiumRequired(Feature.Events))), result)
        assertEquals(0, repository.adds)
    }

    @Test
    fun editingAppliesTheChangedFieldsAndKeepsRoleAndRevision() = runTest {
        val original = event("trip", rev = 9, title = "Trip", category = "travel", notes = "Boots")
        val repository = FakeEventRepository(original)
        val clock = FakeClock(NOW + 1.minutes)
        val draft = EventDraft.of(original).copy(title = "Norway trip", size = CardSize.Large, notes = "")

        val result = upsert(repository, clock)(draft, original)

        assertEquals(SaveResult.Saved("trip", created = false), result)
        val doc = repository.doc("trip")!!
        assertEquals("Norway trip", doc.title)
        assertEquals(CardSize.Large, doc.theme.size)
        assertEquals(null, doc.notes)
        assertEquals(9, doc.rev)
        assertEquals(Role.Owner, doc.role)
        assertEquals("travel", doc.categoryId)
        assertEquals(NOW + 1.minutes, doc.updatedAt)
    }

    @Test
    fun anEditKeepsAChangeStoredMeanwhile() = runTest {
        val original = event("trip", title = "Trip")
        val repository = FakeEventRepository(original)
        // Archived from Home while the editor was open.
        repository.put(original.copy(archivedAt = NOW))

        upsert(repository)(EventDraft.of(original).copy(title = "Norway trip"), original)

        assertEquals(original.copy(title = "Norway trip", archivedAt = NOW, updatedAt = NOW), repository.doc("trip"))
    }

    @Test
    fun anUnchangedEditWritesNothing() = runTest {
        val original = event("trip")
        val repository = FakeEventRepository(original)

        val result = upsert(repository)(EventDraft.of(original), original)

        assertEquals(SaveResult.Saved("trip", created = false, changed = false), result)
        assertEquals(0, repository.edits)
    }

    @Test
    fun editsOfMissingOrSharedDaysAreRefused() = runTest {
        val shared = event("shared", role = Role.Editor)
        val repository = FakeEventRepository(shared)
        val save = upsert(repository)

        assertEquals(SaveResult.NotAllowed, save(EventDraft.of(shared).copy(title = "Mine now"), shared))
        assertEquals(SaveResult.NotFound, save(newDraft, event("missing")))
        assertEquals(0, repository.edits)
    }

    @Test
    fun anInvalidEditIsNotStored() = runTest {
        val original = event("trip")
        val repository = FakeEventRepository(original)

        val result = upsert(repository)(EventDraft.of(original).copy(everyDays = "0", repeat = RepeatKind.EveryNDays), original)

        assertIs<SaveResult.Invalid>(result)
        assertTrue(result.errors.any { DraftField.of(it.field) == DraftField.EveryDays })
        assertEquals(0, repository.edits)
    }
}

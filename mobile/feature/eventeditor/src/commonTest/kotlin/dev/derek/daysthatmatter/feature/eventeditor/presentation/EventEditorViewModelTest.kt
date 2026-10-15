package dev.derek.daysthatmatter.feature.eventeditor.presentation

import app.cash.turbine.test
import dev.derek.daysthatmatter.core.designsystem.components.CardSize as UiCardSize
import dev.derek.daysthatmatter.core.model.event.CardSize
import dev.derek.daysthatmatter.core.model.event.Role
import dev.derek.daysthatmatter.core.model.event.UnitMode
import dev.derek.daysthatmatter.feature.eventeditor.FakeClock
import dev.derek.daysthatmatter.feature.eventeditor.FakeEventRepository
import dev.derek.daysthatmatter.feature.eventeditor.FakePlans
import dev.derek.daysthatmatter.feature.eventeditor.MainDispatcherTest
import dev.derek.daysthatmatter.feature.eventeditor.NOW
import dev.derek.daysthatmatter.feature.eventeditor.SequentialIds
import dev.derek.daysthatmatter.feature.eventeditor.UTC
import dev.derek.daysthatmatter.feature.eventeditor.domain.CheckNewEventGateUseCase
import dev.derek.daysthatmatter.feature.eventeditor.domain.DraftField
import dev.derek.daysthatmatter.feature.eventeditor.domain.LoadEditableEventUseCase
import dev.derek.daysthatmatter.feature.eventeditor.domain.RepeatKind
import dev.derek.daysthatmatter.feature.eventeditor.domain.UpsertEventUseCase
import dev.derek.daysthatmatter.feature.eventeditor.event
import dev.derek.daysthatmatter.feature.eventeditor.ownedDays
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import kotlinx.datetime.LocalDate
import kotlinx.datetime.LocalTime
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class EventEditorViewModelTest : MainDispatcherTest() {

    private val trip = event("trip", title = "Norway trip", date = LocalDate(2026, 11, 21), category = "travel", palette = "ocean")

    private fun viewModel(mode: EditorMode, repository: FakeEventRepository, plans: FakePlans = FakePlans()): EventEditorViewModel {
        val clock = FakeClock()
        val gate = CheckNewEventGateUseCase(repository, plans)
        return EventEditorViewModel(
            mode = mode,
            loadEvent = LoadEditableEventUseCase(repository),
            upsertEvent = UpsertEventUseCase(repository, clock, gate, SequentialIds()),
            checkGate = gate,
            clock = clock,
            zone = UTC,
        )
    }

    private val EventEditorViewModel.editing: EditorUiState.Editing get() = assertIs<EditorUiState.Editing>(state.value)

    @Test
    fun createStartsWithV2DefaultsAndSaveOff() = runTest(dispatcher) {
        val vm = viewModel(EditorMode.Create, FakeEventRepository())
        vm.state.test {
            assertEquals(EditorUiState.Loading, awaitItem())
            val state = assertIs<EditorUiState.Editing>(awaitItem())
            assertTrue(state.isNew)
            assertEquals("New day", state.title)
            // Today (14 Oct 2026 in UTC) + 30 days, in the device zone.
            assertEquals(LocalDate(2026, 11, 13), state.draft.date)
            assertEquals("UTC", state.draft.timeZone)
            assertEquals(EditorTab.Details, state.tab)
            assertEquals(BackgroundKind.Gradient, state.background)
            assertFalse(state.canSave)
            // The empty title is invalid, but nothing is shown before the user types.
            assertEquals(emptyMap(), state.errors)
            assertNull(state.gate)
            assertEquals(listOf(ZoneChoice("UTC", "UTC (this device)"), ZoneChoice(null, "Floating")), state.zoneChoices)
            assertEquals(EditorText.UNTITLED, state.preview.card.title)
        }
    }

    @Test
    fun typingATitleEnablesSaveAndClearingItShowsTheError() = runTest(dispatcher) {
        val vm = viewModel(EditorMode.Create, FakeEventRepository())
        advanceUntilIdle()

        vm.onIntent(EditorIntent.TitleChanged("Norway trip"))
        assertTrue(vm.editing.canSave)
        assertTrue(vm.editing.dirty)
        assertEquals("Norway trip", vm.editing.preview.card.title)

        vm.onIntent(EditorIntent.TitleChanged(""))
        assertFalse(vm.editing.canSave)
        assertEquals("Title must be 1 to 100 characters", vm.editing.errors[DraftField.Title])
    }

    @Test
    fun saveCreatesTheDayAndReportsIt() = runTest(dispatcher) {
        val repository = FakeEventRepository()
        val vm = viewModel(EditorMode.Create, repository)
        advanceUntilIdle()
        vm.onIntent(EditorIntent.TitleChanged("Norway trip"))
        vm.onIntent(EditorIntent.SizePicked(CardSize.Large))

        vm.effect.test {
            vm.onIntent(EditorIntent.Save)
            assertTrue(vm.editing.saving)
            assertEquals(EditorEffect.Saved("id-1", created = true), awaitItem())
        }
        val doc = assertNotNull(repository.doc("id-1"))
        assertEquals("Norway trip", doc.title)
        assertEquals(CardSize.Large, doc.theme.size)
        assertEquals(Role.Owner, doc.role)
    }

    @Test
    fun saveIsIgnoredWhileTheDraftIsInvalid() = runTest(dispatcher) {
        val repository = FakeEventRepository()
        val vm = viewModel(EditorMode.Create, repository)
        advanceUntilIdle()

        vm.onIntent(EditorIntent.Save)
        advanceUntilIdle()

        assertEquals(0, repository.adds)
        assertFalse(vm.editing.saving)
    }

    @Test
    fun everyNDaysIsValidatedInline() = runTest(dispatcher) {
        val vm = viewModel(EditorMode.Edit("trip"), FakeEventRepository(trip))
        advanceUntilIdle()

        vm.onIntent(EditorIntent.RepeatPicked(RepeatKind.EveryNDays))
        assertTrue(vm.editing.canSave)
        vm.onIntent(EditorIntent.EveryDaysChanged("0"))
        assertEquals("Every N days must be 1 to 3650", vm.editing.errors[DraftField.EveryDays])
        assertFalse(vm.editing.canSave)
        // The preview still draws, as a one-time day.
        assertEquals("Norway trip", vm.editing.preview.card.title)
        vm.onIntent(EditorIntent.EveryDaysChanged("14"))
        assertNull(vm.editing.errors[DraftField.EveryDays])
        assertTrue(vm.editing.canSave)
    }

    @Test
    fun editLoadsTheOwnersDayAndSavesTheChange() = runTest(dispatcher) {
        val repository = FakeEventRepository(trip)
        val vm = viewModel(EditorMode.Edit("trip"), repository)
        vm.state.test {
            assertEquals(EditorUiState.Loading, awaitItem())
            val state = assertIs<EditorUiState.Editing>(awaitItem())
            assertEquals("Edit day", state.title)
            assertEquals("Norway trip", state.draft.title)
            assertEquals(BackgroundKind.Color, state.background)
            assertFalse(state.canSave, "nothing changed yet")
            assertEquals(
                listOf(ZoneChoice("UTC", "UTC (this device)"), ZoneChoice(null, "Floating")),
                state.zoneChoices,
            )
        }

        vm.onIntent(EditorIntent.UnitPicked(UnitMode.Weeks))
        vm.onIntent(EditorIntent.ZonePicked("Europe/Oslo"))
        vm.onIntent(EditorIntent.TimePicked(LocalTime(9, 30)))
        assertEquals(
            listOf(ZoneChoice("UTC", "UTC (this device)"), ZoneChoice("Europe/Oslo", "Oslo"), ZoneChoice(null, "Floating")),
            vm.editing.zoneChoices,
        )
        vm.effect.test {
            vm.onIntent(EditorIntent.Save)
            assertEquals(EditorEffect.Saved("trip", created = false), awaitItem())
        }
        val doc = repository.doc("trip")!!
        assertEquals(UnitMode.Weeks, doc.unitMode)
        assertEquals("Europe/Oslo", doc.timeZone)
        assertEquals(LocalTime(9, 30), doc.targetTime)
        assertEquals(1, repository.edits)
    }

    @Test
    fun membersAndMissingDaysCannotBeEdited() = runTest(dispatcher) {
        val repository = FakeEventRepository(event("edits", role = Role.Editor), event("views", role = Role.Viewer))
        val editor = viewModel(EditorMode.Edit("edits"), repository)
        val viewer = viewModel(EditorMode.Edit("views"), repository)
        val missing = viewModel(EditorMode.Edit("missing"), repository)
        advanceUntilIdle()

        assertEquals(EditorUiState.NotAllowed, editor.state.value)
        assertEquals(EditorUiState.NotAllowed, viewer.state.value)
        assertEquals(EditorUiState.NotFound, missing.state.value)
        editor.effect.test {
            editor.onIntent(EditorIntent.Cancel)
            assertEquals(EditorEffect.Close, awaitItem())
        }
    }

    @Test
    fun cancelWithoutChangesClosesAtOnce() = runTest(dispatcher) {
        val vm = viewModel(EditorMode.Edit("trip"), FakeEventRepository(trip))
        advanceUntilIdle()
        vm.effect.test {
            vm.onIntent(EditorIntent.Cancel)
            assertEquals(EditorEffect.Close, awaitItem())
        }
    }

    @Test
    fun cancelWithChangesAsksFirst() = runTest(dispatcher) {
        val repository = FakeEventRepository(trip)
        val vm = viewModel(EditorMode.Edit("trip"), repository)
        advanceUntilIdle()
        vm.onIntent(EditorIntent.EmojiPicked("🚀"))

        vm.onIntent(EditorIntent.Cancel)
        assertTrue(vm.editing.confirmDiscard)
        vm.onIntent(EditorIntent.KeepEditing)
        assertFalse(vm.editing.confirmDiscard)
        assertEquals("🚀", vm.editing.draft.emoji)

        vm.onIntent(EditorIntent.Cancel)
        vm.effect.test {
            vm.onIntent(EditorIntent.ConfirmDiscard)
            assertEquals(EditorEffect.Close, awaitItem())
        }
        assertEquals(0, repository.edits)
    }

    @Test
    fun theOwnedEventLimitShowsAndClosesTheEditor() = runTest(dispatcher) {
        val vm = viewModel(EditorMode.Create, FakeEventRepository(*ownedDays(10)))
        advanceUntilIdle()

        val gate = assertNotNull(vm.editing.gate)
        assertEquals("Free includes 10 days", gate.title)
        vm.onIntent(EditorIntent.TitleChanged("One more"))
        assertFalse(vm.editing.canSave)
        vm.effect.test {
            vm.onIntent(EditorIntent.DismissGate)
            assertEquals(EditorEffect.Close, awaitItem())
        }
    }

    @Test
    fun theGateAtSaveShowsTheLimitWhenTheLastSlotWasTakenMeanwhile() = runTest(dispatcher) {
        val repository = FakeEventRepository(*ownedDays(9))
        val vm = viewModel(EditorMode.Create, repository)
        advanceUntilIdle()
        assertNull(vm.editing.gate)
        vm.onIntent(EditorIntent.TitleChanged("Tenth"))
        repository.put(event("added-elsewhere"))

        vm.onIntent(EditorIntent.Save)
        advanceUntilIdle()

        assertEquals("Free includes 10 days", vm.editing.gate?.title)
        assertFalse(vm.editing.canSave)
        assertEquals(0, repository.adds)
    }

    @Test
    fun themeChoicesUpdateTheDraftAndThePreview() = runTest(dispatcher) {
        val vm = viewModel(EditorMode.Edit("trip"), FakeEventRepository(trip.copy(theme = trip.theme.copy(gradient = listOf("#112233", "#445566")))))
        advanceUntilIdle()
        assertEquals(BackgroundKind.Gradient, vm.editing.background, "a custom gradient opens on Gradient")

        vm.onIntent(EditorIntent.TabPicked(EditorTab.Background))
        vm.onIntent(EditorIntent.BackgroundPicked(BackgroundKind.Color))
        vm.onIntent(EditorIntent.PalettePicked("ink"))
        vm.onIntent(EditorIntent.TabPicked(EditorTab.Style))
        vm.onIntent(EditorIntent.StylePicked("poster"))
        vm.onIntent(EditorIntent.TypefacePicked("mono"))
        vm.onIntent(EditorIntent.SizePicked(CardSize.Small))

        val state = vm.editing
        assertEquals(EditorTab.Style, state.tab)
        assertEquals(BackgroundKind.Color, state.background)
        assertEquals("ink", state.draft.paletteId)
        assertNull(state.draft.gradient, "picking a palette replaces the custom gradient")
        assertEquals("poster", state.draft.cardStyle)
        assertEquals("mono", state.draft.typography)
        assertEquals(UiCardSize.Small, state.preview.card.size)
        assertTrue(state.preview.contrastOk, "white text on Ink")
        assertTrue(state.canSave)
    }

    @Test
    fun categoryTogglesAndPinFollowsTheArchiveRule() = runTest(dispatcher) {
        val archived = event("old", archivedAt = NOW, category = "work")
        val repository = FakeEventRepository(trip, archived)
        val vm = viewModel(EditorMode.Edit("trip"), repository)
        val archivedVm = viewModel(EditorMode.Edit("old"), repository)
        advanceUntilIdle()

        vm.onIntent(EditorIntent.CategoryPicked("travel"))
        assertNull(vm.editing.draft.categoryId)
        vm.onIntent(EditorIntent.CategoryPicked("work"))
        assertEquals("work", vm.editing.draft.categoryId)
        vm.onIntent(EditorIntent.PinnedChanged(true))
        assertTrue(vm.editing.draft.pinned)
        vm.onIntent(EditorIntent.NotesChanged("Bring the camera"))
        assertEquals("Bring the camera", vm.editing.draft.notes)

        assertTrue(archivedVm.editing.archived)
        archivedVm.onIntent(EditorIntent.PinnedChanged(true))
        assertFalse(archivedVm.editing.draft.pinned, "archived days cannot be pinned")
    }

    @Test
    fun aNewDateDropsTheStoredAnchorYear() = runTest(dispatcher) {
        val yearly = event(
            "bday",
            date = LocalDate(2026, 5, 20),
            recurrence = dev.derek.daysthatmatter.core.model.event.Recurrence.Yearly(1990),
        )
        val vm = viewModel(EditorMode.Edit("bday"), FakeEventRepository(yearly))
        advanceUntilIdle()
        assertEquals(1990, vm.editing.draft.originalYear)

        vm.onIntent(EditorIntent.DatePicked(LocalDate(2026, 6, 1)))
        vm.onIntent(EditorIntent.TimeCleared)

        assertNull(vm.editing.draft.originalYear)
        assertEquals(LocalDate(2026, 6, 1), vm.editing.draft.date)
    }
}

@file:OptIn(ExperimentalTestApi::class)

package dev.derek.daysthatmatter.feature.eventeditor.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertHeightIsEqualTo
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.assertContentDescriptionContains
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.v2.runComposeUiTest
import androidx.compose.ui.unit.dp
import dev.derek.daysthatmatter.core.designsystem.components.DtmEditorTestTags
import dev.derek.daysthatmatter.core.designsystem.components.DtmPickerTestTags
import dev.derek.daysthatmatter.core.designsystem.components.DtmTestTags
import dev.derek.daysthatmatter.core.designsystem.theme.DaysThatMatterTheme
import dev.derek.daysthatmatter.core.model.event.CardSize
import dev.derek.daysthatmatter.core.model.event.UnitMode
import dev.derek.daysthatmatter.feature.eventeditor.NOW
import dev.derek.daysthatmatter.feature.eventeditor.domain.DraftField
import dev.derek.daysthatmatter.feature.eventeditor.domain.EventDraft
import dev.derek.daysthatmatter.feature.eventeditor.domain.RepeatKind
import dev.derek.daysthatmatter.feature.eventeditor.presentation.BackgroundKind
import dev.derek.daysthatmatter.feature.eventeditor.presentation.EditorIntent
import dev.derek.daysthatmatter.feature.eventeditor.presentation.EditorMode
import dev.derek.daysthatmatter.feature.eventeditor.presentation.EditorTab
import dev.derek.daysthatmatter.feature.eventeditor.presentation.EditorTestTags
import dev.derek.daysthatmatter.feature.eventeditor.presentation.EditorText
import dev.derek.daysthatmatter.feature.eventeditor.presentation.EditorUiState
import dev.derek.daysthatmatter.feature.eventeditor.presentation.EventEditorScreen
import dev.derek.daysthatmatter.feature.eventeditor.presentation.GateNotice
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class EventEditorScreenTest {

    private val newDraft = EventDraft.new(LocalDate(2026, 11, 13), "UTC")

    private fun editing(
        draft: EventDraft = newDraft,
        mode: EditorMode = EditorMode.Create,
        tab: EditorTab = EditorTab.Details,
        background: BackgroundKind = BackgroundKind.Gradient,
        errors: Map<DraftField, String> = emptyMap(),
        canSave: Boolean = false,
        confirmDiscard: Boolean = false,
        gate: GateNotice? = null,
        archived: Boolean = false,
    ) = EditorUiState.Editing(
        mode = mode,
        draft = draft,
        tab = tab,
        background = background,
        errors = errors,
        canSave = canSave,
        confirmDiscard = confirmDiscard,
        gate = gate,
        zoneChoices = EditorText.zoneChoices(draft.timeZone, "UTC"),
        archived = archived,
        preview = EditorText.preview(draft, null, NOW, TimeZone.UTC),
    )

    private fun androidx.compose.ui.test.ComposeUiTest.show(state: EditorUiState, intents: MutableList<EditorIntent>) {
        setContent {
            DaysThatMatterTheme(darkTheme = false) {
                Box(Modifier.size(width = 400.dp, height = 2400.dp)) {
                    EventEditorScreen(state, onIntent = { intents += it })
                }
            }
        }
    }

    @Test
    fun aNewDayShowsTheBarThePreviewAndTheDetails() = runComposeUiTest {
        val intents = mutableListOf<EditorIntent>()
        show(editing(), intents)

        // The bar's title, and the preview card while the title is empty.
        onAllNodesWithText("New day").assertCountEquals(2)
        onNodeWithTag(DtmEditorTestTags.Preview).assertExists()
        onNodeWithTag(DtmTestTags.DayCard).assertContentDescriptionContains(EditorText.UNTITLED, substring = true)
        onNodeWithTag(DtmEditorTestTags.tab("Details")).assertIsSelected()
        onNodeWithText("0/100").assertExists()
        onNodeWithText("Nov 13, 2026").assertExists()
        onNodeWithText("Add time").assertExists()
        onNodeWithText(EditorText.FIXED_NOTE).assertExists()
        onNodeWithText("only you · 0/4,000").assertExists()

        // Save is off until the draft is valid.
        onNodeWithTag(DtmEditorTestTags.Save).performClick()
        onNodeWithContentDescription("Title").performTextInput("Norway trip")
        onNodeWithContentDescription("Emoji 🎂").performClick()
        onNodeWithTag(DtmEditorTestTags.Cancel).performClick()

        // The field shows the state's text, so the fixed state also reports the text going back to empty.
        assertEquals(
            listOf(EditorIntent.TitleChanged("Norway trip"), EditorIntent.EmojiPicked("🎂"), EditorIntent.Cancel),
            intents.filterNot { it == EditorIntent.TitleChanged("") },
        )
    }

    @Test
    fun saveFiresWhenTheDraftIsValid() = runComposeUiTest {
        val intents = mutableListOf<EditorIntent>()
        show(editing(newDraft.copy(title = "Trip"), canSave = true), intents)

        onNodeWithTag(DtmTestTags.DayCard).assertContentDescriptionContains("Trip", substring = true)
        onNodeWithTag(DtmEditorTestTags.Save).performClick()

        assertEquals(listOf<EditorIntent>(EditorIntent.Save), intents)
    }

    @Test
    fun errorsShowUnderTheirFields() = runComposeUiTest {
        show(
            editing(
                newDraft.copy(repeat = RepeatKind.EveryNDays, everyDays = "0"),
                errors = mapOf(
                    DraftField.Title to "Title must be 1 to 100 characters",
                    DraftField.EveryDays to "Every N days must be 1 to 3650",
                    DraftField.Other to "This day: event document exceeds 16384 bytes",
                ),
            ),
            mutableListOf(),
        )

        onNodeWithText("Title must be 1 to 100 characters").assertExists()
        onNodeWithText("Every N days must be 1 to 3650").assertExists()
        onNodeWithTag(EditorTestTags.GeneralError).assertExists()
    }

    @Test
    fun repeatZoneAndCategoryChipsSendTheirChoice() = runComposeUiTest {
        val intents = mutableListOf<EditorIntent>()
        show(editing(newDraft.copy(repeat = RepeatKind.EveryNDays, everyDays = "")), intents)

        onNodeWithTag(EditorTestTags.chip("Every year")).performScrollTo().performClick()
        onNodeWithContentDescription("Every N days").performScrollTo().performTextInput("14")
        onNodeWithTag(EditorTestTags.chip("Floating")).performScrollTo().performClick()
        onNodeWithTag(EditorTestTags.chip("UTC (this device)")).assertIsSelected()
        onNodeWithTag(EditorTestTags.chip("✈️ Travel")).performScrollTo().performClick()
        onNodeWithTag(EditorTestTags.chip("🌱 Life")).assertIsSelected()
        onNodeWithTag(EditorTestTags.PinRow).performScrollTo().performClick()
        onNodeWithContentDescription("Notes").performScrollTo().performTextInput("Boots")

        // The field shows the state's text, so the test's fixed state also reports the text going back to empty.
        assertTrue(EditorIntent.EveryDaysChanged("14") in intents)
        assertEquals(
            listOf(
                EditorIntent.RepeatPicked(RepeatKind.Yearly),
                EditorIntent.ZonePicked(null),
                EditorIntent.CategoryPicked("travel"),
                EditorIntent.PinnedChanged(true),
                EditorIntent.NotesChanged("Boots"),
            ),
            intents.filterNot { it is EditorIntent.EveryDaysChanged },
        )
    }

    @Test
    fun anotherZoneComesFromTheSearchableList() = runComposeUiTest {
        val intents = mutableListOf<EditorIntent>()
        show(editing(), intents)

        onNodeWithTag(EditorTestTags.OtherZone).performScrollTo().performClick()
        onNodeWithTag(EditorTestTags.ZoneList).assertExists()
        onNode(hasSetTextAction() and hasAnyAncestor(hasTestTag(EditorTestTags.ZonePicker))).performTextInput("oslo")
        onNodeWithText("Europe/Oslo").performClick()

        assertEquals(listOf<EditorIntent>(EditorIntent.ZonePicked("Europe/Oslo")), intents)
        onNodeWithTag(EditorTestTags.ZoneList).assertDoesNotExist()
    }

    @Test
    fun archivedDaysHaveNoPinSwitch() = runComposeUiTest {
        show(editing(mode = EditorMode.Edit("old"), archived = true), mutableListOf())
        onNodeWithText("Edit day").assertExists()
        onNodeWithTag(EditorTestTags.PinRow).assertDoesNotExist()
    }

    @Test
    fun theBackgroundTabPicksSwatchesAndGradients() = runComposeUiTest {
        val intents = mutableListOf<EditorIntent>()
        var state by mutableStateOf(editing(tab = EditorTab.Background))
        setContent {
            DaysThatMatterTheme(darkTheme = false) {
                Box(Modifier.size(width = 400.dp, height = 2400.dp)) { EventEditorScreen(state, onIntent = { intents += it }) }
            }
        }

        onNodeWithTag(DtmPickerTestTags.option("Lagoon")).assertIsSelected()
        onNodeWithTag(DtmPickerTestTags.option("Deep sea")).performClick()
        onNodeWithText("Color").performClick()
        state = editing(tab = EditorTab.Background, background = BackgroundKind.Color)
        onNodeWithContentDescription("Ocean").performClick()
        onNodeWithText(state.preview.contrastText).assertExists()
        onNodeWithText("Style").performClick()

        assertEquals(
            listOf(
                EditorIntent.PalettePicked("deep-sea"),
                EditorIntent.BackgroundPicked(BackgroundKind.Color),
                EditorIntent.PalettePicked("ocean"),
                EditorIntent.TabPicked(EditorTab.Style),
            ),
            intents,
        )
    }

    @Test
    fun theStyleTabPicksStyleSizeTypefaceAndUnit() = runComposeUiTest {
        val intents = mutableListOf<EditorIntent>()
        show(editing(tab = EditorTab.Style), intents)

        onNodeWithTag(EditorTestTags.style("glass")).assertIsSelected()
        onNodeWithTag(EditorTestTags.style("poster")).performClick()
        onNodeWithText("Large").performClick()
        onNodeWithTag(EditorTestTags.typeface("mono")).performScrollTo().performClick()
        onNodeWithTag(EditorTestTags.chip("Workdays")).performScrollTo().performClick()
        onNodeWithText(EditorText.SIZE_NOTE).assertExists()

        assertEquals(
            listOf(
                EditorIntent.StylePicked("poster"),
                EditorIntent.SizePicked(CardSize.Large),
                EditorIntent.TypefacePicked("mono"),
                EditorIntent.UnitPicked(UnitMode.Workdays),
            ),
            intents,
        )
    }

    @Test
    fun thePreviewRowFollowsTheChosenSize() = runComposeUiTest {
        var state by mutableStateOf(editing(newDraft.copy(title = "Trip", size = CardSize.Small)))
        setContent {
            DaysThatMatterTheme(darkTheme = false) {
                Box(Modifier.size(width = 400.dp, height = 2400.dp)) { EventEditorScreen(state, onIntent = {}) }
            }
        }
        onNodeWithTag(DtmTestTags.DayCard).assertHeightIsEqualTo(64.dp)
        state = editing(newDraft.copy(title = "Trip", size = CardSize.Medium))
        onNodeWithTag(DtmTestTags.DayCard).assertHeightIsEqualTo(84.dp)
        state = editing(newDraft.copy(title = "Trip", size = CardSize.Large))
        onNodeWithTag(DtmTestTags.DayCard).assertHeightIsEqualTo(132.dp)
    }

    @Test
    fun unsavedChangesAskBeforeDiscarding() = runComposeUiTest {
        val intents = mutableListOf<EditorIntent>()
        show(editing(newDraft.copy(title = "Trip"), confirmDiscard = true), intents)

        onNodeWithText("Discard changes?").assertExists()
        onNodeWithTag(EditorTestTags.KeepEditing).performClick()
        onNodeWithTag(EditorTestTags.DiscardConfirm).performClick()

        assertEquals(listOf(EditorIntent.KeepEditing, EditorIntent.ConfirmDiscard), intents)
    }

    @Test
    fun theOwnedEventLimitIsShown() = runComposeUiTest {
        val intents = mutableListOf<EditorIntent>()
        show(editing(gate = GateNotice("Free includes 10 days", "Premium keeps up to 500.")), intents)

        onNodeWithText("Free includes 10 days").assertExists()
        onNodeWithTag(EditorTestTags.GateOk).performClick()

        assertEquals(listOf<EditorIntent>(EditorIntent.DismissGate), intents)
    }

    @Test
    fun membersSeeWhyTheyCannotEdit() = runComposeUiTest {
        val intents = mutableListOf<EditorIntent>()
        show(EditorUiState.NotAllowed, intents)

        onNodeWithText("Only the owner can edit this day").assertExists()
        onNodeWithText("Back").performClick()
        assertTrue(intents == listOf<EditorIntent>(EditorIntent.Cancel))
    }

    @Test
    fun aMissingDaySaysSo() = runComposeUiTest {
        show(EditorUiState.NotFound, mutableListOf())
        onNodeWithText("This day is gone").assertExists()
    }
}

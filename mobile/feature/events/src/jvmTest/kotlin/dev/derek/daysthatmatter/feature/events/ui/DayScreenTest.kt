@file:OptIn(ExperimentalTestApi::class)

package dev.derek.daysthatmatter.feature.events.ui

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertHasClickAction
import androidx.compose.ui.test.assertHasNoClickAction
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.v2.runComposeUiTest
import dev.derek.daysthatmatter.core.designsystem.components.CardBackground
import dev.derek.daysthatmatter.core.designsystem.components.CardStyle
import dev.derek.daysthatmatter.core.designsystem.components.CardTypeface
import dev.derek.daysthatmatter.core.designsystem.theme.CardPalette
import dev.derek.daysthatmatter.core.designsystem.theme.DaysThatMatterTheme
import dev.derek.daysthatmatter.core.model.event.Role
import dev.derek.daysthatmatter.core.model.event.UnitMode
import dev.derek.daysthatmatter.feature.events.presentation.common.EventsTestTags
import dev.derek.daysthatmatter.feature.events.presentation.day.DayIntent
import dev.derek.daysthatmatter.feature.events.presentation.day.DayScreen
import dev.derek.daysthatmatter.feature.events.presentation.day.DayUiState
import dev.derek.daysthatmatter.feature.events.presentation.day.DetailRow
import kotlin.test.Test
import kotlin.test.assertEquals

class DayScreenTest {

    private val owner = DayUiState.Content(
        id = "trip",
        title = "Norway trip",
        emoji = "🏔️",
        badge = "✈️ Travel",
        dateLine = "Saturday, November 21, 2026 · 9:30 AM",
        number = "38",
        unit = "days left",
        longNumber = false,
        tick = "37d 23h 30m 00s",
        unitMode = UnitMode.Auto,
        canChangeUnit = true,
        showWorkdaysNote = false,
        archived = false,
        role = Role.Owner,
        background = CardBackground.Solid(CardPalette.swatches[9].color),
        style = CardStyle.Glass,
        typeface = CardTypeface.Sans,
        details = listOf(DetailRow("Date", "Saturday, November 21, 2026"), DetailRow("Time zone", "Fixed · Oslo")),
    )

    @Test
    fun ownerTapsTheNumberAndPicksAUnit() = runComposeUiTest {
        val intents = mutableListOf<DayIntent>()
        setContent { DaysThatMatterTheme(darkTheme = false) { DayScreen(owner, onIntent = { intents += it }) } }

        onNodeWithText("Norway trip").assertExists()
        onNodeWithText("✈️ Travel").assertExists()
        onNodeWithText("37d 23h 30m 00s").assertExists()
        onNodeWithTag(EventsTestTags.DayNumber).assertHasClickAction().performClick()
        onNodeWithTag(EventsTestTags.UnitList).assertExists()
        onNodeWithTag(EventsTestTags.unit("Auto")).assertIsSelected()
        onNodeWithTag(EventsTestTags.unit("Workdays")).performClick()
        onNodeWithContentDescription("Back").performClick()

        assertEquals(listOf(DayIntent.CycleUnit, DayIntent.SelectUnit(UnitMode.Workdays), DayIntent.Back), intents)
        onNodeWithTag(EventsTestTags.WorkdaysNote).assertDoesNotExist()
    }

    @Test
    fun workdaysShowsTheHolidayNote() = runComposeUiTest {
        setContent {
            DaysThatMatterTheme(darkTheme = false) {
                DayScreen(owner.copy(unitMode = UnitMode.Workdays, showWorkdaysNote = true, number = "27", unit = "workdays left"), onIntent = {})
            }
        }

        onNodeWithTag(EventsTestTags.WorkdaysNote).assertExists()
        onNodeWithText("Workdays counts Monday to Friday. Public holidays are not skipped yet.").assertExists()
        onNodeWithTag(EventsTestTags.unit("Workdays")).assertIsSelected()
    }

    @Test
    fun viewersGetNoUnitControl() = runComposeUiTest {
        setContent {
            DaysThatMatterTheme(darkTheme = false) {
                DayScreen(owner.copy(canChangeUnit = false, role = Role.Viewer, badge = "Shared · Viewer"), onIntent = {})
            }
        }

        onNodeWithText("Shared · Viewer").assertExists()
        onNodeWithTag(EventsTestTags.DayNumber).assertHasNoClickAction()
        onNodeWithTag(EventsTestTags.UnitList).assertDoesNotExist()
    }

    @Test
    fun archivedDaysOfferUnarchiveAndDelete() = runComposeUiTest {
        val intents = mutableListOf<DayIntent>()
        setContent { DaysThatMatterTheme(darkTheme = false) { DayScreen(owner.copy(archived = true), onIntent = { intents += it }) } }

        onNodeWithText("Archived").assertExists()
        onNodeWithText("Fixed · Oslo").performScrollTo().assertExists()
        onNodeWithText("Unarchive").performScrollTo().performClick()
        onNodeWithText("Delete day").performScrollTo().performClick()
        assertEquals(listOf(DayIntent.Unarchive, DayIntent.Delete), intents)
    }

    @Test
    fun aMissingDay() = runComposeUiTest {
        val intents = mutableListOf<DayIntent>()
        setContent { DaysThatMatterTheme(darkTheme = false) { DayScreen(DayUiState.NotFound, onIntent = { intents += it }) } }

        onNodeWithText("This day is gone").assertExists()
        onNodeWithContentDescription("Back").performClick()
        assertEquals(listOf<DayIntent>(DayIntent.Back), intents)
    }
}

@file:OptIn(ExperimentalTestApi::class)

package dev.derek.daysthatmatter.feature.events.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertHasClickAction
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.v2.runComposeUiTest
import androidx.compose.ui.unit.dp
import dev.derek.daysthatmatter.core.designsystem.components.CardBackground
import dev.derek.daysthatmatter.core.designsystem.components.CardStyle
import dev.derek.daysthatmatter.core.designsystem.components.CardTypeface
import dev.derek.daysthatmatter.core.designsystem.theme.CardPalette
import dev.derek.daysthatmatter.core.designsystem.theme.DaysThatMatterTheme
import dev.derek.daysthatmatter.core.model.event.Role
import dev.derek.daysthatmatter.core.model.event.UnitMode
import dev.derek.daysthatmatter.feature.events.presentation.common.EventsTestTags
import dev.derek.daysthatmatter.feature.events.presentation.day.DayScreen
import dev.derek.daysthatmatter.feature.events.presentation.day.DayUiState
import dev.derek.daysthatmatter.feature.events.presentation.home.HomeDayItem
import dev.derek.daysthatmatter.feature.events.presentation.home.HomeScreen
import dev.derek.daysthatmatter.feature.events.presentation.home.HomeSection
import dev.derek.daysthatmatter.feature.events.presentation.home.HomeSectionKind
import dev.derek.daysthatmatter.feature.events.presentation.home.HomeUiState
import dev.derek.daysthatmatter.feature.events.presentation.home.HomeViewModel
import kotlin.test.Test
import kotlin.test.assertEquals

/** The editor's entry points: "New day" on Home and Edit on the owner's day page. */
class EditorEntryPointsTest {

    private val home = HomeUiState(
        loading = false,
        kicker = "Wednesday, October 14",
        chips = HomeViewModel.chips(),
        sections = listOf(HomeSection(HomeSectionKind.Upcoming, listOf(HomeDayItem("party", card("party"), pinned = false, canPin = true, isOwner = true)))),
    )

    private val day = DayUiState.Content(
        id = "trip",
        title = "Norway trip",
        emoji = "🏔️",
        badge = "✈️ Travel",
        dateLine = "Saturday, November 21, 2026",
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
        details = emptyList(),
    )

    @Test
    fun homeShowsNewDayOnlyWhenItCanOpenTheEditor() = runComposeUiTest {
        var opened = 0
        var withFab by androidx.compose.runtime.mutableStateOf(true)
        setContent {
            DaysThatMatterTheme(darkTheme = false) {
                Box(Modifier.size(width = 400.dp, height = 900.dp)) {
                    HomeScreen(home, onIntent = {}, onNewDay = if (withFab) ({ opened++ }) else null)
                }
            }
        }
        onNodeWithText("New day").assertHasClickAction()
        onNodeWithTag(EventsTestTags.NewDayFab).performClick()
        assertEquals(1, opened)

        withFab = false
        onNodeWithTag(EventsTestTags.NewDayFab).assertDoesNotExist()
    }

    @Test
    fun theOwnerGetsEditOnTheDayPage() = runComposeUiTest {
        var edits = 0
        setContent { DaysThatMatterTheme(darkTheme = false) { DayScreen(day, onIntent = {}, onEdit = { edits++ }) } }

        onNodeWithText("Edit").assertHasClickAction()
        onNodeWithTag(EventsTestTags.EditButton).performClick()
        assertEquals(1, edits)
    }

    @Test
    fun membersGetNoEdit() = runComposeUiTest {
        var role by androidx.compose.runtime.mutableStateOf(Role.Editor)
        setContent { DaysThatMatterTheme(darkTheme = false) { DayScreen(day.copy(role = role), onIntent = {}, onEdit = {}) } }

        onNodeWithTag(EventsTestTags.EditButton).assertDoesNotExist()
        role = Role.Viewer
        onNodeWithTag(EventsTestTags.EditButton).assertDoesNotExist()
    }

    @Test
    fun withoutAnEditorTheDayPageHasNoEdit() = runComposeUiTest {
        setContent { DaysThatMatterTheme(darkTheme = false) { DayScreen(day, onIntent = {}) } }
        onNodeWithTag(EventsTestTags.EditButton).assertDoesNotExist()
    }
}

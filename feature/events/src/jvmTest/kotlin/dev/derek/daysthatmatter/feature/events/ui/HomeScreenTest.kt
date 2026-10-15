@file:OptIn(ExperimentalTestApi::class)

package dev.derek.daysthatmatter.feature.events.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertHeightIsEqualTo
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.assertWidthIsEqualTo
import androidx.compose.ui.test.longClick
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.v2.runComposeUiTest
import androidx.compose.ui.unit.dp
import dev.derek.daysthatmatter.core.designsystem.components.CardSize
import dev.derek.daysthatmatter.core.designsystem.theme.DaysThatMatterTheme
import dev.derek.daysthatmatter.feature.events.domain.HomeFilter
import dev.derek.daysthatmatter.feature.events.presentation.common.EventsTestTags
import dev.derek.daysthatmatter.feature.events.presentation.home.HomeDayItem
import dev.derek.daysthatmatter.feature.events.presentation.home.HomeEmpty
import dev.derek.daysthatmatter.feature.events.presentation.home.HomeIntent
import dev.derek.daysthatmatter.feature.events.presentation.home.HomeLayout
import dev.derek.daysthatmatter.feature.events.presentation.home.HomeScreen
import dev.derek.daysthatmatter.feature.events.presentation.home.HomeSection
import dev.derek.daysthatmatter.feature.events.presentation.home.HomeSectionKind
import dev.derek.daysthatmatter.feature.events.presentation.home.HomeUiState
import dev.derek.daysthatmatter.feature.events.presentation.home.HomeViewModel
import kotlin.test.Test
import kotlin.test.assertEquals

class HomeScreenTest {

    private fun item(id: String, size: CardSize = CardSize.Medium, pinned: Boolean = false, owner: Boolean = true) =
        HomeDayItem(id, card(id, size), pinned = pinned, canPin = owner, isOwner = owner)

    private val content = HomeUiState(
        loading = false,
        kicker = "Wednesday, October 14",
        chips = HomeViewModel.chips(),
        sections = listOf(
            HomeSection(HomeSectionKind.Pinned, listOf(item("trip", CardSize.Large, pinned = true))),
            HomeSection(HomeSectionKind.Upcoming, listOf(item("payday", CardSize.Small), item("party"), item("grandma", owner = false))),
        ),
        archivedCount = 3,
    )

    private fun render(state: HomeUiState, intents: MutableList<HomeIntent>) = @androidx.compose.runtime.Composable {
        DaysThatMatterTheme(darkTheme = false) {
            Box(Modifier.size(width = 400.dp, height = 1600.dp)) {
                HomeScreen(state, onIntent = { intents += it })
            }
        }
    }

    @Test
    fun listRowsHaveTheThreeSizes() = runComposeUiTest {
        val intents = mutableListOf<HomeIntent>()
        setContent(render(content, intents))

        onNodeWithText("Your days").assertExists()
        onNodeWithText("Wednesday, October 14").assertExists()
        onNodeWithText("Pinned").assertExists()
        onAllNodesWithText("Upcoming").assertCountEquals(2)
        onNodeWithTag(EventsTestTags.card("payday")).assertHeightIsEqualTo(64.dp)
        onNodeWithTag(EventsTestTags.card("party")).assertHeightIsEqualTo(84.dp)
        onNodeWithTag(EventsTestTags.card("trip")).assertHeightIsEqualTo(132.dp)
        onNodeWithText("37d 04h 12m 08s").assertExists()
    }

    @Test
    fun gridTilesWithALargeCardSpanningBothColumns() = runComposeUiTest {
        setContent(render(content.copy(layout = HomeLayout.Grid), mutableListOf()))

        onNodeWithTag(EventsTestTags.card("trip")).assertWidthIsEqualTo(368.dp).assertHeightIsEqualTo(196.dp)
        onNodeWithTag(EventsTestTags.card("party")).assertWidthIsEqualTo(179.dp)
        onNodeWithTag(EventsTestTags.card("payday")).assertWidthIsEqualTo(179.dp)
        onNodeWithContentDescription("Show as list").assertExists()
    }

    @Test
    fun theArchivedRowOpensTheArchive() = runComposeUiTest {
        val intents = mutableListOf<HomeIntent>()
        setContent(render(content, intents))

        onNodeWithTag(EventsTestTags.ArchivedRow).assertTextContains("3").performClick()
        assertEquals(listOf<HomeIntent>(HomeIntent.OpenArchived), intents)
    }

    @Test
    fun noArchivedRowWithoutArchivedDaysOrWhileFiltering() = runComposeUiTest {
        var state by androidx.compose.runtime.mutableStateOf(content.copy(archivedCount = 0))
        setContent {
            DaysThatMatterTheme(darkTheme = false) { HomeScreen(state, onIntent = {}) }
        }
        onNodeWithTag(EventsTestTags.ArchivedRow).assertDoesNotExist()
        state = content.copy(filter = HomeFilter.Upcoming)
        onNodeWithTag(EventsTestTags.ArchivedRow).assertDoesNotExist()
        state = content
        onNodeWithTag(EventsTestTags.ArchivedRow).assertExists()
    }

    @Test
    fun emptyStates() = runComposeUiTest {
        var state by androidx.compose.runtime.mutableStateOf(content.copy(sections = emptyList(), empty = HomeEmpty.NothingYet, archivedCount = 0))
        setContent {
            DaysThatMatterTheme(darkTheme = false) { HomeScreen(state, onIntent = {}) }
        }
        onNodeWithText("Nothing here yet").assertExists()
        state = state.copy(empty = HomeEmpty.NoMatches, query = "zzz", searching = true)
        onNodeWithText("No matches").assertExists()
        onNodeWithText("zzz").assertExists()
    }

    @Test
    fun tapOpensADayAndChipsFilter() = runComposeUiTest {
        val intents = mutableListOf<HomeIntent>()
        setContent(render(content, intents))

        onNodeWithTag(EventsTestTags.card("party")).performClick()
        onNodeWithText("Since").performClick()
        onNodeWithText("All").assertIsSelected()
        onNodeWithContentDescription("Show as grid").performClick()
        onNodeWithContentDescription("Search").performClick()
        assertEquals(
            listOf(HomeIntent.OpenDay("party"), HomeIntent.SelectFilter(HomeFilter.Since), HomeIntent.ToggleLayout, HomeIntent.ToggleSearch),
            intents,
        )
    }

    private fun longPressThenPick(id: String, pick: String, check: androidx.compose.ui.test.ComposeUiTest.() -> Unit = {}): List<HomeIntent> {
        val intents = mutableListOf<HomeIntent>()
        runComposeUiTest {
            setContent(render(content, intents))
            onNodeWithTag(EventsTestTags.card(id)).performTouchInput { longClick() }
            check()
            onNodeWithText(pick).performClick()
        }
        return intents
    }

    @Test
    fun pinnedDayMenuSaysArchiveAlsoUnpins() {
        val intents = longPressThenPick("trip", "Archive") {
            onNodeWithText("Unpin").assertExists()
            onNodeWithText("also unpins it").assertExists()
        }
        assertEquals(listOf<HomeIntent>(HomeIntent.Archive("trip")), intents)
    }

    @Test
    fun sharedDayMenuHasNoPinAndOffersLeave() {
        val intents = longPressThenPick("grandma", "Leave") {
            onNodeWithText("Pin to top").assertDoesNotExist()
            onNodeWithText("Archive").assertExists()
        }
        assertEquals(listOf<HomeIntent>(HomeIntent.Delete("grandma")), intents)
    }

    @Test
    fun ownedDayMenuPinsAndDeletes() {
        assertEquals(listOf<HomeIntent>(HomeIntent.SetPinned("party", true)), longPressThenPick("party", "Pin to top"))
        assertEquals(listOf<HomeIntent>(HomeIntent.Delete("party")), longPressThenPick("party", "Delete"))
    }

    @Test
    fun sortMenu() = runComposeUiTest {
        val intents = mutableListOf<HomeIntent>()
        setContent(render(content, intents))

        onNodeWithTag(EventsTestTags.SortButton).performClick()
        onNodeWithText("A to Z").performClick()
        assertEquals(listOf<HomeIntent>(HomeIntent.SelectSort(dev.derek.daysthatmatter.feature.events.domain.HomeSort.AToZ)), intents)
    }
}

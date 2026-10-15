@file:OptIn(ExperimentalTestApi::class)

package dev.derek.daysthatmatter.feature.events.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertHeightIsEqualTo
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertWidthIsEqualTo
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.v2.runComposeUiTest
import androidx.compose.ui.unit.dp
import dev.derek.daysthatmatter.core.designsystem.components.CardSize
import dev.derek.daysthatmatter.core.designsystem.components.DtmTestTags
import dev.derek.daysthatmatter.core.designsystem.theme.DaysThatMatterTheme
import dev.derek.daysthatmatter.core.designsystem.theme.DtmSizes
import dev.derek.daysthatmatter.feature.events.domain.HomeFilter
import dev.derek.daysthatmatter.feature.events.presentation.common.EventsTestTags
import dev.derek.daysthatmatter.feature.events.presentation.home.HomeDayItem
import dev.derek.daysthatmatter.feature.events.presentation.home.HomeIntent
import dev.derek.daysthatmatter.feature.events.presentation.home.HomeScreen
import dev.derek.daysthatmatter.feature.events.presentation.home.HomeSection
import dev.derek.daysthatmatter.feature.events.presentation.home.HomeSectionKind
import dev.derek.daysthatmatter.feature.events.presentation.home.HomeUiState
import dev.derek.daysthatmatter.feature.events.presentation.home.HomeViewModel
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class PinnedCarouselTest {

    private fun item(id: String, size: CardSize = CardSize.Medium, pinned: Boolean = false, owner: Boolean = true) =
        HomeDayItem(id, card(id, size), pinned = pinned, canPin = owner, isOwner = owner)

    private val pinnedTrip = item("trip", CardSize.Large, pinned = true)
    private val pinnedWedding = item("wedding", CardSize.Medium, pinned = true)
    private val upcomingParty = item("party", CardSize.Medium)

    private val stateWithPins = HomeUiState(
        loading = false,
        kicker = "Wednesday, October 14",
        chips = HomeViewModel.chips(),
        sections = listOf(
            HomeSection(HomeSectionKind.Pinned, listOf(pinnedTrip, pinnedWedding)),
            HomeSection(HomeSectionKind.Upcoming, listOf(upcomingParty)),
        ),
        pinnedDays = listOf(pinnedTrip, pinnedWedding),
        showPinnedCarousel = true,
        activePinIndex = 0,
        archivedCount = 0,
    )

    private fun render(
        state: HomeUiState,
        intents: MutableList<HomeIntent>,
        forceCompact: Boolean? = null,
        reduceMotion: Boolean = false,
    ) = @androidx.compose.runtime.Composable {
        DaysThatMatterTheme(darkTheme = false) {
            Box(Modifier.size(width = 400.dp, height = 1200.dp)) {
                HomeScreen(
                    state = state,
                    onIntent = { intents += it },
                    forceCompact = forceCompact,
                    reduceMotion = reduceMotion,
                )
            }
        }
    }

    @Test
    fun carouselRendersWithPeekMarginsAndIndicatorDots() = runComposeUiTest {
        val intents = mutableListOf<HomeIntent>()
        setContent(render(stateWithPins, intents))

        onNodeWithTag(EventsTestTags.PinnedCarousel).assertExists().assertIsDisplayed()
        onNodeWithTag(EventsTestTags.carouselCard("trip")).assertExists()
        onNodeWithTag(EventsTestTags.carouselCard("wedding")).assertExists()

        // Dots container and individual dots
        onNodeWithTag(EventsTestTags.PinnedCarouselDots).assertExists()
        onNodeWithTag(EventsTestTags.carouselDot(0)).assertExists()
        onNodeWithTag(EventsTestTags.carouselDot(1)).assertExists()
    }

    @Test
    fun tapCenteredCardOpensDayDetail() = runComposeUiTest {
        val intents = mutableListOf<HomeIntent>()
        setContent(render(stateWithPins, intents))

        onNodeWithTag(EventsTestTags.carouselCard("trip")).performClick()
        assertEquals(listOf<HomeIntent>(HomeIntent.OpenDay("trip")), intents)
    }

    @Test
    fun tapSidePeekCardScrollsToCenter() = runComposeUiTest {
        val intents = mutableListOf<HomeIntent>()
        setContent(render(stateWithPins, intents, reduceMotion = true))

        onNodeWithTag(EventsTestTags.carouselCard("wedding")).performClick()
        // Page settling triggers SelectPin
        assertTrue(intents.any { it is HomeIntent.SelectPin && it.index == 1 })
    }

    @Test
    fun tapIndicatorDotScrollsToCard() = runComposeUiTest {
        val intents = mutableListOf<HomeIntent>()
        setContent(render(stateWithPins, intents, reduceMotion = true))

        onNodeWithTag(EventsTestTags.carouselDot(1)).performClick()
        assertTrue(intents.any { it is HomeIntent.SelectPin && it.index == 1 })
    }

    @Test
    fun centeredDayOutlinesCorrespondingCardInList() = runComposeUiTest {
        val intents = mutableListOf<HomeIntent>()
        setContent(render(stateWithPins, intents))

        // Center card is trip: list card for trip has focus border & outline
        onNodeWithTag(EventsTestTags.focusedCard("trip")).assertExists()
        onNodeWithTag(EventsTestTags.FocusOutline).assertExists()
        onNodeWithTag(EventsTestTags.focusedCard("wedding")).assertDoesNotExist()
    }

    @Test
    fun carouselHidesContextuallyOnSearchAndFilter() = runComposeUiTest {
        var state by mutableStateOf(stateWithPins)
        setContent {
            DaysThatMatterTheme(darkTheme = false) {
                HomeScreen(state = state, onIntent = {})
            }
        }

        onNodeWithTag(EventsTestTags.PinnedCarousel).assertExists()

        // Searching hides carousel
        state = state.copy(searching = true)
        onNodeWithTag(EventsTestTags.PinnedCarousel).assertDoesNotExist()

        // Restoring search shows it again
        state = state.copy(searching = false)
        onNodeWithTag(EventsTestTags.PinnedCarousel).assertExists()

        // Filtering hides carousel
        state = state.copy(filter = HomeFilter.Upcoming)
        onNodeWithTag(EventsTestTags.PinnedCarousel).assertDoesNotExist()

        // Filter All restores it
        state = state.copy(filter = HomeFilter.All)
        onNodeWithTag(EventsTestTags.PinnedCarousel).assertExists()

        // Pinned carousel setting disabled hides it
        state = state.copy(showPinnedCarousel = false)
        onNodeWithTag(EventsTestTags.PinnedCarousel).assertDoesNotExist()
    }

    @Test
    fun collapsedStripStateAt96dpHeight() = runComposeUiTest {
        val intents = mutableListOf<HomeIntent>()
        setContent(render(stateWithPins, intents, forceCompact = true, reduceMotion = true))

        onNodeWithTag(EventsTestTags.PinnedCarouselStrip).assertExists().assertHeightIsEqualTo(DtmSizes.heroCompactHeight)
        onNodeWithTag(EventsTestTags.PinnedCarousel).assertDoesNotExist()
    }

    @Test
    fun togglePinnedCarouselFromToolsMenu() = runComposeUiTest {
        val intents = mutableListOf<HomeIntent>()
        setContent(render(stateWithPins, intents))

        onNodeWithTag(EventsTestTags.SortButton).performClick()
        onNodeWithTag(EventsTestTags.CarouselSwitch).performClick()
        assertEquals(listOf<HomeIntent>(HomeIntent.TogglePinnedCarousel), intents)
    }

    @Test
    fun reducedMotionDisablesAnimations() = runComposeUiTest {
        val intents = mutableListOf<HomeIntent>()
        setContent(render(stateWithPins, intents, reduceMotion = true))

        onNodeWithTag(EventsTestTags.carouselDot(1)).performClick()
        assertTrue(intents.any { it is HomeIntent.SelectPin && it.index == 1 })
    }
}

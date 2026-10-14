@file:OptIn(ExperimentalTestApi::class)

package dev.derek.daysthatmatter.core.designsystem

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color

import androidx.compose.ui.test.ExperimentalTestApi

import androidx.compose.ui.test.assertHeightIsEqualTo
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.assertIsNotSelected
import androidx.compose.ui.test.assertWidthIsEqualTo

import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.v2.runComposeUiTest
import androidx.compose.ui.unit.dp
import dev.derek.daysthatmatter.core.designsystem.components.BottomFade
import dev.derek.daysthatmatter.core.designsystem.components.CardBackground
import dev.derek.daysthatmatter.core.designsystem.components.CardSize
import dev.derek.daysthatmatter.core.designsystem.components.CardStyle
import dev.derek.daysthatmatter.core.designsystem.components.CardTypeface
import dev.derek.daysthatmatter.core.designsystem.components.CategoryChip
import dev.derek.daysthatmatter.core.designsystem.components.CountdownNumber
import dev.derek.daysthatmatter.core.designsystem.components.DayCardGrid
import dev.derek.daysthatmatter.core.designsystem.components.DayCardRow
import dev.derek.daysthatmatter.core.designsystem.components.DayCardState
import dev.derek.daysthatmatter.core.designsystem.components.DayCardTile
import dev.derek.daysthatmatter.core.designsystem.components.DtmButton
import dev.derek.daysthatmatter.core.designsystem.components.DtmButtonStyle
import dev.derek.daysthatmatter.core.designsystem.components.DtmTestTags
import dev.derek.daysthatmatter.core.designsystem.components.DtmTopBar
import dev.derek.daysthatmatter.core.designsystem.components.EmptyState
import dev.derek.daysthatmatter.core.designsystem.components.IconCircleButton
import dev.derek.daysthatmatter.core.designsystem.components.MemoBadgePosition
import dev.derek.daysthatmatter.core.designsystem.components.NewDayFab
import dev.derek.daysthatmatter.core.designsystem.components.SearchField
import dev.derek.daysthatmatter.core.designsystem.components.SectionHeader
import dev.derek.daysthatmatter.core.designsystem.gallery.DesignGallery
import dev.derek.daysthatmatter.core.designsystem.icons.DtmIcons
import dev.derek.daysthatmatter.core.designsystem.theme.AccentChoice
import dev.derek.daysthatmatter.core.designsystem.theme.CardPalette
import dev.derek.daysthatmatter.core.designsystem.theme.DaysThatMatterTheme
import dev.derek.daysthatmatter.core.designsystem.theme.DtmTheme
import dev.derek.daysthatmatter.core.designsystem.theme.darkDtmColors
import dev.derek.daysthatmatter.core.designsystem.theme.lightDtmColors
import dev.derek.daysthatmatter.core.designsystem.theme.toMaterialColorScheme
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** Compose UI tests on the JVM target (headless): no device or emulator. */
class ComponentUiTest {

    private fun card(
        size: CardSize = CardSize.Medium,
        memos: Int = 0,
        meta: String = "Sat, 21 Nov",
        tick: String? = null,
        style: CardStyle = CardStyle.Glass,
        background: CardBackground = CardBackground.Solid(CardPalette.Mint.color),
    ) = DayCardState(
        title = "Norway trip",
        emoji = "🏔️",
        number = "38",
        unit = "days to go",
        meta = meta,
        tick = tick,
        size = size,
        memoCount = memos,
        style = style,
        background = background,
    )

    @Composable
    private fun Themed(dark: Boolean = false, content: @Composable () -> Unit) =
        DaysThatMatterTheme(darkTheme = dark, content = content)

    // ---- day card row ----

    @Test
    fun rowHeightsFollowCardSize() = runComposeUiTest {
        setContent { Themed { Column { CardSize.entries.forEach { DayCardRow(card(it).copy(title = "Card ${it.name}")) } } } }

        val heights = mapOf(CardSize.Small to 64, CardSize.Medium to 84, CardSize.Large to 132)
        val nodes = onAllNodesWithTag(DtmTestTags.DayCard)
        nodes.assertCountEquals(3)
        CardSize.entries.forEachIndexed { i, size -> nodes[i].assertHeightIsEqualTo(heights.getValue(size).dp) }
    }

    @Test
    fun mediumRowShowsTitleDateNumberAndUnit() = runComposeUiTest {
        setContent { Themed { DayCardRow(card()) } }

        onNodeWithText("Norway trip").assertExists()
        onNodeWithText("Sat, 21 Nov").assertExists()
        onNodeWithText("38").assertExists()
        onNodeWithText("days to go").assertExists()
        onNodeWithText("🏔️").assertExists()
    }

    @Test
    fun smallRowHidesTheDateLine() = runComposeUiTest {
        setContent { Themed { DayCardRow(card(CardSize.Small)) } }

        onNodeWithText("Norway trip").assertExists()
        onNodeWithText("Sat, 21 Nov").assertDoesNotExist()
    }

    @Test
    fun largeRowShowsTheTicker() = runComposeUiTest {
        setContent { Themed { DayCardRow(card(CardSize.Large, tick = "38d 04h 12m 08s")) } }

        onNodeWithText("38d 04h 12m 08s").assertExists()
    }

    @Test
    fun mediumRowHidesTheTicker() = runComposeUiTest {
        setContent { Themed { DayCardRow(card(CardSize.Medium, tick = "38d 04h 12m 08s")) } }

        onNodeWithText("38d 04h 12m 08s").assertDoesNotExist()
    }

    @Test
    fun rowClickCallsBack() = runComposeUiTest {
        var clicks = 0
        setContent { Themed { DayCardRow(card(), onClick = { clicks++ }) } }

        onNodeWithTag(DtmTestTags.DayCard).performClick()

        assertEquals(1, clicks)
    }

    @Test
    fun rowReadsAsOneButtonForScreenReaders() = runComposeUiTest {
        setContent { Themed { DayCardRow(card(), onClick = {}) } }

        onNodeWithContentDescription("Norway trip, 38 days to go").assertExists()
    }

    @Test
    fun rowRendersEveryStyleAndTypeface() = runComposeUiTest {
        setContent {
            Themed {
                Column {
                    CardStyle.entries.forEach { style ->
                        CardTypeface.entries.forEach { face ->
                            DayCardRow(card(style = style).copy(typeface = face, title = "${style.name} ${face.name}"))
                        }
                    }
                }
            }
        }

        onAllNodesWithTag(DtmTestTags.DayCard).assertCountEquals(CardStyle.entries.size * CardTypeface.entries.size)
    }

    @Test
    fun rowRendersMeshAndDimmedBackgrounds() = runComposeUiTest {
        setContent {
            Themed {
                Column {
                    CardPalette.gradients.forEach { (name, mesh) -> DayCardRow(card(background = mesh).copy(title = name, dim = 0.3f)) }
                }
            }
        }

        onAllNodesWithTag(DtmTestTags.DayCard).assertCountEquals(8)
    }

    // ---- memo badge ----

    @Test
    fun memoBadgeShowsCountAndNineLimit() = runComposeUiTest {
        setContent { Themed { Column { DayCardRow(card(memos = 3)); DayCardRow(card(memos = 12).copy(title = "Other")) } } }

        onNodeWithText("3", useUnmergedTree = true).assertExists()
        onNodeWithText("9+", useUnmergedTree = true).assertExists()
        onAllNodesWithTag(DtmTestTags.MemoBadge, useUnmergedTree = true).assertCountEquals(2)
    }

    @Test
    fun noMemoBadgeWithoutMemos() = runComposeUiTest {
        setContent { Themed { DayCardRow(card(memos = 0)) } }

        onAllNodesWithTag(DtmTestTags.MemoBadge, useUnmergedTree = true).assertCountEquals(0)
    }

    @Test
    fun memoBadgeSitsAtTheConfiguredCorner() = runComposeUiTest {
        var position by mutableStateOf(MemoBadgePosition.TopRight)
        setContent {
            Themed { Box(Modifier.width(360.dp)) { DayCardRow(card(memos = 2).copy(memoBadge = position)) } }
        }

        val right = onNodeWithTag(DtmTestTags.MemoBadge, useUnmergedTree = true).getUnclippedBoundsInRoot()
        assertEquals(360.dp, right.right)
        assertEquals(10.dp, right.top)

        position = MemoBadgePosition.TopLeft
        waitForIdle()
        val left = onNodeWithTag(DtmTestTags.MemoBadge, useUnmergedTree = true).getUnclippedBoundsInRoot()
        assertEquals(24.dp, left.left)
        assertEquals(0.dp, left.top)
    }

    // ---- tile and grid ----

    @Test
    fun tileSizes() = runComposeUiTest {
        setContent {
            Themed {
                Column(Modifier.width(200.dp)) {
                    DayCardTile(card(CardSize.Large).copy(title = "L"))
                    DayCardTile(card(CardSize.Medium).copy(title = "M"))
                    DayCardTile(card(CardSize.Small).copy(title = "S"))
                }
            }
        }

        val nodes = onAllNodesWithTag(DtmTestTags.DayCard)
        nodes[0].assertHeightIsEqualTo(196.dp)
        nodes[1].assertHeightIsEqualTo(220.dp) // 200 * 1.1
        nodes[2].assertHeightIsEqualTo(160.dp) // 200 * 0.8
    }

    @Test
    fun tileShowsNumberTitleAndDate() = runComposeUiTest {
        setContent { Themed { DayCardTile(card()) } }

        onNodeWithText("38").assertExists()
        onNodeWithText("Norway trip").assertExists()
        onNodeWithText("Sat, 21 Nov").assertExists()
    }

    @Test
    fun gridUsesTwoColumnsAndLargeSpansBoth() = runComposeUiTest {
        setContent {
            Themed {
                Box(Modifier.width(360.dp)) {
                    DayCardGrid(listOf(card(), card(), card(CardSize.Large)))
                }
            }
        }

        val nodes = onAllNodesWithTag(DtmTestTags.DayCard)
        nodes[0].assertWidthIsEqualTo(175.dp) // (360 - 10) / 2
        nodes[1].assertWidthIsEqualTo(175.dp)
        nodes[2].assertWidthIsEqualTo(360.dp)
    }

    @Test
    fun gridReportsTheClickedIndex() = runComposeUiTest {
        var clicked = -1
        setContent {
            Themed { DayCardGrid(listOf(card().copy(title = "A"), card().copy(title = "B")), onClick = { clicked = it }) }
        }

        onNodeWithText("B").performClick()

        assertEquals(1, clicked)
    }

    // ---- countdown number ----

    @Test
    fun countdownNumberShowsNumberUnitAndPre() = runComposeUiTest {
        setContent { Themed { CountdownNumber(number = "1,973", unit = "and counting", pre = "Day") } }

        onNodeWithText("1,973").assertExists()
        onNodeWithText("and counting").assertExists()
        onNodeWithText("DAY").assertExists()
    }

    // ---- chip, buttons, fields ----

    @Test
    fun chipReportsSelectionAndClicks() = runComposeUiTest {
        var clicks = 0
        setContent {
            Themed {
                Column {
                    CategoryChip("All", selected = true, onClick = { clicks++ })
                    CategoryChip("Travel", selected = false, onClick = {})
                }
            }
        }

        onNodeWithText("All").assertIsSelected()
        onNodeWithText("Travel").assertIsNotSelected()
        onNodeWithText("All").performClick()
        assertEquals(1, clicks)
    }

    @Test
    fun buttonsClickWhenEnabledAndNotWhenDisabled() = runComposeUiTest {
        var primary = 0
        var secondary = 0
        var disabled = 0
        setContent {
            Themed {
                Column {
                    DtmButton("Save", onClick = { primary++ })
                    DtmButton("Share", onClick = { secondary++ }, style = DtmButtonStyle.Secondary)
                    DtmButton("Off", onClick = { disabled++ }, enabled = false)
                }
            }
        }

        onNodeWithText("Save").performClick()
        onNodeWithText("Share").performClick()
        onNodeWithText("Off").assertIsNotEnabled()
        onNodeWithText("Off").performClick()

        assertEquals(1, primary)
        assertEquals(1, secondary)
        assertEquals(0, disabled)
        onNodeWithText("Save").assertIsEnabled()
    }

    @Test
    fun buttonHeights() = runComposeUiTest {
        setContent { Themed { Column { DtmButton("Regular", onClick = {}); DtmButton("Text", onClick = {}, style = DtmButtonStyle.Text) } } }

        onNodeWithText("Regular").assertExists()
        onNodeWithText("Text").assertExists()
    }

    @Test
    fun searchFieldShowsPlaceholderThenTypedText() = runComposeUiTest {
        var text by mutableStateOf("")
        var closed = false
        setContent {
            Themed { SearchField(text, onValueChange = { text = it }, placeholder = "Search your days", onClose = { closed = true }) }
        }

        onNodeWithText("Search your days").assertExists()
        onNodeWithText("Search your days").performTextInput("mia")
        assertEquals("mia", text)
        onNodeWithContentDescription("Close search").performClick()
        assertTrue(closed)
    }

    @Test
    fun iconButtonHasDescriptionAndClicks() = runComposeUiTest {
        var clicks = 0
        setContent { Themed { IconCircleButton(DtmIcons.Search, "Search", onClick = { clicks++ }) } }

        onNodeWithContentDescription("Search").performClick()

        assertEquals(1, clicks)
    }

    // ---- bars, header, empty, fab ----

    @Test
    fun topBarShowsKickerTitleAndActions() = runComposeUiTest {
        setContent {
            Themed {
                DtmTopBar("Your days", kicker = "Saturday, 14 October", actions = {
                    IconCircleButton(DtmIcons.Search, "Search", onClick = {})
                })
            }
        }

        onNodeWithText("Your days").assertExists()
        onNodeWithText("Saturday, 14 October").assertExists()
        onNodeWithContentDescription("Search").assertExists()
    }

    @Test
    fun sectionHeaderShowsTitleCountAndActions() = runComposeUiTest {
        setContent {
            Themed { SectionHeader("Upcoming", count = 4, actions = { Text("tools") }) }
        }

        onNodeWithText("Upcoming").assertExists()
        onNodeWithText("4").assertExists()
        onNodeWithText("tools").assertExists()
    }

    @Test
    fun emptyStateShowsItsThreeLines() = runComposeUiTest {
        setContent { Themed { EmptyState("🌤️", "Nothing here yet", "Add a day.") } }

        onNodeWithText("🌤️").assertExists()
        onNodeWithText("Nothing here yet").assertExists()
        onNodeWithText("Add a day.").assertExists()
    }

    @Test
    fun fabShowsLabelAndClicks() = runComposeUiTest {
        var clicks = 0
        setContent { Themed { Box { BottomFade(); NewDayFab("New day", onClick = { clicks++ }) } } }

        onNodeWithText("New day").performClick()

        assertEquals(1, clicks)
    }

    // ---- theme ----

    @Test
    fun themeProvidesLightAndDarkTokens() = runComposeUiTest {
        var seen: Pair<Color, Color>? = null
        setContent {
            var dark by mutableStateOf(false)
            Themed(dark) {
                seen = DtmTheme.colors.bg to MaterialTheme.colorScheme.primary
            }
        }

        assertEquals(lightDtmColors().bg to lightDtmColors().accent, seen)
    }

    @Test
    fun darkThemeProvidesDarkTokens() = runComposeUiTest {
        var seen: Pair<Color, Color>? = null
        setContent { Themed(dark = true) { seen = DtmTheme.colors.bg to MaterialTheme.colorScheme.primary } }

        assertEquals(darkDtmColors().bg to darkDtmColors().accent, seen)
    }

    @Test
    fun accentChoiceReachesTheMaterialScheme() = runComposeUiTest {
        var primary: Color? = null
        setContent {
            DaysThatMatterTheme(darkTheme = false, accent = AccentChoice.Plum) { primary = MaterialTheme.colorScheme.primary }
        }

        assertEquals(AccentChoice.Plum.light, primary)
    }

    @Test
    fun dynamicSchemeReplacesOnlyTheMaterialColors() = runComposeUiTest {
        val dynamic = lightDtmColors().toMaterialColorScheme().copy(primary = Color.Magenta)
        var material: Color? = null
        var brand: Color? = null
        setContent {
            DaysThatMatterTheme(darkTheme = false, dynamicColorScheme = dynamic) {
                material = MaterialTheme.colorScheme.primary
                brand = DtmTheme.colors.accent
            }
        }

        assertEquals(Color.Magenta, material)
        assertEquals(lightDtmColors().accent, brand)
    }

    // ---- gallery ----

    @Test
    fun galleryShowsLightPanelFirstAndTogglesToBoth() = runComposeUiTest {
        setContent { DesignGallery() }

        onNodeWithText("Gallery · Light").assertExists()
        onNodeWithText("Gallery · Dark").assertDoesNotExist()

        onNodeWithText("Both").performClick()

        onNodeWithText("Gallery · Dark").assertExists()
        assertFalse(onAllNodesWithTag(DtmTestTags.DayCard).fetchSemanticsNodes().isEmpty())
    }

    @Test
    fun galleryShowsDarkOnly() = runComposeUiTest {
        setContent { DesignGallery() }

        onNodeWithText("Dark").performClick()

        onNodeWithText("Gallery · Dark").assertExists()
        onNodeWithText("Gallery · Light").assertDoesNotExist()
    }
}

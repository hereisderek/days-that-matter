package dev.derek.daysthatmatter.core.designsystem.components

import androidx.compose.ui.unit.dp
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class CardModelTest {

    private fun card(size: CardSize = CardSize.Medium) = DayCardState(
        title = "Norway trip",
        emoji = "🏔️",
        number = "38",
        unit = "days to go",
        size = size,
    )

    @Test
    fun sizeMapsToRowHeight() {
        assertEquals(64.dp, CardSize.Small.rowHeight)
        assertEquals(84.dp, CardSize.Medium.rowHeight)
        assertEquals(132.dp, CardSize.Large.rowHeight)
    }

    @Test
    fun numberSizeInRows() {
        assertEquals(24, CardNumberSize.row(CardSize.Small, CardStyle.Glass, CardTypeface.Sans))
        assertEquals(30, CardNumberSize.row(CardSize.Medium, CardStyle.Glass, CardTypeface.Sans))
        assertEquals(46, CardNumberSize.row(CardSize.Large, CardStyle.Glass, CardTypeface.Sans))
        assertEquals(40, CardNumberSize.row(CardSize.Medium, CardStyle.Poster, CardTypeface.Sans))
        assertEquals(36, CardNumberSize.row(CardSize.Medium, CardStyle.Glass, CardTypeface.Serif))
    }

    @Test
    fun smallAndLargeWinOverPosterInRows() {
        assertEquals(24, CardNumberSize.row(CardSize.Small, CardStyle.Poster, CardTypeface.Serif))
        assertEquals(46, CardNumberSize.row(CardSize.Large, CardStyle.Poster, CardTypeface.Sans))
    }

    @Test
    fun numberSizeInTiles() {
        assertEquals(46, CardNumberSize.tile(CardSize.Medium, CardStyle.Glass))
        assertEquals(60, CardNumberSize.tile(CardSize.Large, CardStyle.Glass))
        assertEquals(60, CardNumberSize.tile(CardSize.Medium, CardStyle.Poster))
    }

    @Test
    fun memoBadgeShowsNineAndAbove() {
        assertEquals("1", memoBadgeText(1))
        assertEquals("9", memoBadgeText(9))
        assertEquals("9+", memoBadgeText(10))
        assertEquals("9+", memoBadgeText(12))
    }

    @Test
    fun descriptionJoinsTitleAndCount() {
        assertEquals("Norway trip, 38 days to go", card().description)
        assertEquals("Together, Day 1,973 and counting", card().copy(title = "Together", pre = "Day", number = "1,973", unit = "and counting").description)
    }

    @Test
    fun gridPairsCardsAndGivesLargeAFullRow() {
        val cards = listOf(card(), card(), card(CardSize.Large), card(CardSize.Small), card(), card(CardSize.Small))

        assertEquals(listOf(listOf(0, 1), listOf(2), listOf(3, 4), listOf(5)), gridRows(cards))
    }

    @Test
    fun gridLargeAfterSingleLeavesTheSingleAlone() {
        assertEquals(listOf(listOf(0), listOf(1)), gridRows(listOf(card(), card(CardSize.Large))))
        assertEquals(emptyList(), gridRows(emptyList()))
    }

    @Test
    fun defaultsAreMediumGlassSans() {
        val c = card()

        assertEquals(CardStyle.Glass, c.style)
        assertEquals(CardTypeface.Sans, c.typeface)
        assertEquals(MemoBadgePosition.TopRight, c.memoBadge)
        assertNull(c.tick)
    }
}

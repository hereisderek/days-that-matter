package dev.derek.daysthatmatter.feature.events.presentation

import dev.derek.daysthatmatter.core.designsystem.components.CardBackground
import dev.derek.daysthatmatter.core.designsystem.components.CardSize
import dev.derek.daysthatmatter.core.designsystem.components.CardStyle
import dev.derek.daysthatmatter.core.designsystem.components.CardTypeface
import dev.derek.daysthatmatter.core.designsystem.theme.CardPalette
import dev.derek.daysthatmatter.core.model.event.Role
import dev.derek.daysthatmatter.core.model.event.Theme
import dev.derek.daysthatmatter.feature.events.NOW
import dev.derek.daysthatmatter.feature.events.UTC
import dev.derek.daysthatmatter.feature.events.domain.StoredEvent
import dev.derek.daysthatmatter.feature.events.domain.countdownAt
import dev.derek.daysthatmatter.feature.events.event
import dev.derek.daysthatmatter.feature.events.presentation.common.CardLook
import androidx.compose.ui.graphics.Color
import dev.derek.daysthatmatter.core.model.event.CardSize as ModelCardSize
import kotlinx.datetime.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNull

class CardLookTest {

    private fun theme(palette: String = "mint", style: String = "glass", type: String = "sans", gradient: List<String>? = null) =
        Theme(palette, style, type, gradient)

    @Test
    fun palettesMapToSwatchesAndGradients() {
        assertEquals(CardBackground.Solid(CardPalette.Mint.color), CardLook.background(theme("mint")))
        assertEquals(CardBackground.Solid(Color(0xFF2D6CDF)), CardLook.background(theme("ocean")))
        assertEquals(CardPalette.gradients.single { it.first == "Deep sea" }.second, CardLook.background(theme("deep-sea")))
        assertEquals(CardBackground.Solid(CardPalette.Mint.color), CardLook.background(theme("unknown-palette")))
    }

    @Test
    fun aCustomGradientBecomesAMesh() {
        val mesh = assertIs<CardBackground.Mesh>(CardLook.background(theme(gradient = listOf("#112233", "#445566"))))
        assertEquals(Color(0xFF112233), mesh.base)
        assertEquals(Color(0xFF445566), mesh.c)
        assertEquals(CardBackground.Solid(CardPalette.Mint.color), CardLook.background(theme(gradient = listOf("#12", "nothex"))))
    }

    @Test
    fun stylesTypefacesAndSizes() {
        assertEquals(
            listOf(CardStyle.Glass, CardStyle.Clean, CardStyle.Outline, CardStyle.Poster, CardStyle.Glass),
            listOf("glass", "clean", "outline", "poster", "other").map { CardLook.style(theme(style = it)) },
        )
        assertEquals(
            listOf(CardTypeface.Sans, CardTypeface.Serif, CardTypeface.Rounded, CardTypeface.Mono, CardTypeface.Condensed, CardTypeface.Sans),
            listOf("modern", "serif", "rounded", "mono", "condensed", "other").map { CardLook.typeface(theme(type = it)) },
        )
        assertEquals(
            listOf(CardSize.Small, CardSize.Medium, CardSize.Large),
            ModelCardSize.entries.map { CardLook.size(theme().copy(size = it)) },
        )
    }

    @Test
    fun cardsShowTheTickerOnlyWhenLarge() {
        val large = StoredEvent(event("l", date = LocalDate(2026, 10, 20), size = ModelCardSize.Large), NOW).countdownAt(NOW, UTC())
        val medium = StoredEvent(event("m", date = LocalDate(2026, 10, 20)), NOW).countdownAt(NOW, UTC())

        val card = CardLook.card(large)
        assertEquals(CardSize.Large, card.size)
        assertEquals("5d 15h 00m 00s", card.tick)
        assertEquals("5", card.number)
        assertEquals("days left", card.unit)
        assertNull(CardLook.card(medium).tick)
    }

    @Test
    fun markersAndDefaultEmoji() {
        val pinned = StoredEvent(event("p", date = LocalDate(2026, 10, 20), pinnedAt = NOW), NOW).countdownAt(NOW, UTC())
        val shared = StoredEvent(event("s", date = LocalDate(2026, 10, 20), role = Role.Viewer, emoji = null), NOW).countdownAt(NOW, UTC())

        assertEquals("Pinned · Tue, Oct 20", CardLook.card(pinned).meta)
        assertEquals("Shared · Tue, Oct 20", CardLook.card(shared).meta)
        assertEquals(CardLook.DEFAULT_EMOJI, CardLook.card(shared).emoji)
    }
}

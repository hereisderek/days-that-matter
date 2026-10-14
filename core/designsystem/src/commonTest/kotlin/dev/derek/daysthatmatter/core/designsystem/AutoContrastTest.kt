package dev.derek.daysthatmatter.core.designsystem

import androidx.compose.ui.graphics.Color
import dev.derek.daysthatmatter.core.designsystem.theme.CardPalette
import dev.derek.daysthatmatter.core.designsystem.theme.CardTextColor
import dev.derek.daysthatmatter.core.designsystem.theme.CardTone
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class AutoContrastTest {

    private fun swatch(name: String) = CardPalette.swatches.first { it.name == name }.color

    @Test
    fun paleBackgroundsGetInk() {
        listOf("Mint", "Sky", "Peach", "Butter", "Marigold", "Paper").forEach {
            assertEquals(CardTone.DarkText, resolveCardTone(swatch(it)), it)
        }
    }

    @Test
    fun darkBackgroundsGetWhite() {
        listOf("Forest", "Ink", "Ocean", "Plum", "Jade", "Coral").forEach {
            assertEquals(CardTone.LightText, resolveCardTone(swatch(it)), it)
        }
    }

    @Test
    fun autoAlwaysPicksTheHigherContrast() {
        CardPalette.swatches.map { it.color }.forEach { bg ->
            val chosen = resolveCardTone(bg)
            val other = if (chosen == CardTone.DarkText) CardTone.LightText else CardTone.DarkText

            assertTrue(toneContrast(bg, 0f, chosen) >= toneContrast(bg, 0f, other))
        }
    }

    @Test
    fun clearCasesReachWcagAa() {
        assertTrue(meetsAa(swatch("Butter"), 0f, resolveCardTone(swatch("Butter"))))
        assertTrue(meetsAa(swatch("Forest"), 0f, resolveCardTone(swatch("Forest"))))
        assertTrue(meetsAa(swatch("Ocean"), 0f, resolveCardTone(swatch("Ocean"))))
    }

    @Test
    fun midLuminanceCannotReachAaWithEitherTone() {
        // At relative luminance 0.2 both white and ink give about 4.3:1; v2 calls this "large text only".
        val mid = Color(0xFF7A7A7A)

        assertFalse(meetsAa(mid, 0f, CardTone.LightText))
        assertFalse(meetsAa(mid, 0f, CardTone.DarkText))
    }

    @Test
    fun dimmingFlipsAPaleBackgroundToWhiteText() {
        val butter = swatch("Butter")

        assertEquals(CardTone.DarkText, resolveCardTone(butter, dim = 0f))
        assertEquals(CardTone.LightText, resolveCardTone(butter, dim = 0.7f))
    }

    @Test
    fun explicitModeOverridesAuto() {
        assertEquals(CardTone.LightText, resolveCardTone(swatch("Butter"), mode = CardTextColor.White))
        assertEquals(CardTone.DarkText, resolveCardTone(swatch("Forest"), mode = CardTextColor.Ink))
    }

    @Test
    fun photoStandInGetsWhite() {
        assertEquals(CardTone.LightText, resolveCardTone(PhotoStandInColor))
    }

    @Test
    fun dimBlendsTowardBlackInSrgb() {
        val dimmed = dimmedBackdrop(Color.White, 0.5f)

        assertEquals(0.5f, dimmed.red, 0.005f)
        assertEquals(Color.White, dimmedBackdrop(Color.White, 0f))
        assertEquals(dimmedBackdrop(Color.White, 1f), dimmedBackdrop(Color.White, 2f))
    }

    @Test
    fun ratioOfInkOnWhiteMatchesKnownValue() {
        assertEquals(18.3f, contrastRatio(Color.White, CardTone.DarkText.text), absoluteTolerance = 0.3f)
    }
}

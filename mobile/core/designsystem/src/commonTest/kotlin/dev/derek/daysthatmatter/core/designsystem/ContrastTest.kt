package dev.derek.daysthatmatter.core.designsystem

import androidx.compose.ui.graphics.Color
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ContrastTest {

    @Test
    fun blackOnWhiteIsTheMaximum() {
        assertEquals(21f, contrastRatio(Color.Black, Color.White), absoluteTolerance = 0.01f)
    }

    @Test
    fun aColorAgainstItselfIsOne() {
        val blue = Color(0xFF2563EB)

        assertEquals(1f, contrastRatio(blue, blue), absoluteTolerance = 0.001f)
    }

    @Test
    fun orderOfArgumentsDoesNotMatter() {
        val background = Color(0xFF0F172A)
        val text = Color(0xFFF8FAFC)

        assertEquals(contrastRatio(background, text), contrastRatio(text, background))
        assertTrue(contrastRatio(background, text) >= 4.5f)
    }

    @Test
    fun inkOnTheV2PageBackgroundPassesAa() {
        assertTrue(contrastRatio(Color(0xFF111714), Color(0xFFF5F7F3)) >= AA_CONTRAST)
        assertTrue(contrastRatio(Color(0xFFECF1EE), Color(0xFF0F1312)) >= AA_CONTRAST)
    }

    @Test
    fun accentTextOnItsOwnSoftSurfaceIsReadableInBothThemes() {
        val light = dev.derek.daysthatmatter.core.designsystem.theme.lightDtmColors()
        val dark = dev.derek.daysthatmatter.core.designsystem.theme.darkDtmColors()

        assertTrue(contrastRatio(light.accent, light.surface) >= 3f)
        assertTrue(contrastRatio(dark.accent, dark.surface) >= AA_CONTRAST)
        assertTrue(contrastRatio(light.onAccent, light.accent) >= 3f)
        assertTrue(contrastRatio(dark.onAccent, dark.accent) >= AA_CONTRAST)
    }
}

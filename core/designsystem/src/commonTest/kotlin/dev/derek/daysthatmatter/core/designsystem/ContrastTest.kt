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
}

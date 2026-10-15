package dev.derek.daysthatmatter.core.designsystem.theme

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import dev.derek.daysthatmatter.core.designsystem.dimmedBackdrop
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

/** Spot checks of the token values against design/v2/styles.css. */
class TokensTest {

    @Test
    fun lightChromeMatchesV2() {
        val c = lightDtmColors()

        assertEquals(Color(0xFFF5F7F3), c.bg) // --bg
        assertEquals(Color(0xFFEDF2EE), c.page) // --page
        assertEquals(Color(0xFFFFFFFF), c.surface)
        assertEquals(Color(0xFFEEF2ED), c.surface2)
        assertEquals(Color(0xFFDCE3DD), c.surface3)
        assertEquals(Color(0xFF111714), c.ink)
        assertEquals(Color(0xFF4A544F), c.ink2)
        assertEquals(Color(0xFF7F8984), c.ink3)
        assertEquals(Color(0xFF0E8F63), c.accent) // --accent-l
        assertEquals(Color(0xFFFFFFFF), c.onAccent)
        assertEquals(Color(0xFFD2433A), c.danger)
        assertEquals(Color(0xFFFFF1CF), c.goldBg)
        assertEquals(Color(0xFF8A5A00), c.goldInk)
        assertEquals(0.07f, c.line.alpha, 0.005f)
        assertEquals(0.13f, c.line2.alpha, 0.005f)
    }

    @Test
    fun darkChromeMatchesV2() {
        val c = darkDtmColors()

        assertEquals(Color(0xFF0F1312), c.bg)
        assertEquals(Color(0xFF0A0D0C), c.page)
        assertEquals(Color(0xFF171C1A), c.surface)
        assertEquals(Color(0xFF1F2623), c.surface2)
        assertEquals(Color(0xFF2C3531), c.surface3)
        assertEquals(Color(0xFFECF1EE), c.ink)
        assertEquals(Color(0xFFA9B3AE), c.ink2)
        assertEquals(Color(0xFF737D78), c.ink3)
        assertEquals(Color(0xFF52D6A3), c.accent) // --accent-d
        assertEquals(Color(0xFF06120D), c.onAccent)
        assertEquals(Color(0xFFF2C46D), c.goldInk)
        assertEquals(0.16f, c.goldBg.alpha, 0.005f)
        assertEquals(0.14f, c.line2.alpha, 0.005f)
    }

    @Test
    fun accentSoftIsThirteenPercentAccentOverSurface() {
        val c = lightDtmColors()

        assertEquals(c.surface.mixSrgb(c.accent, 0.13f), c.accentSoft)
        // 13% of 0E8F63 over white: 255 - 0.13 * (255 - 14) = 223.67 on red.
        assertEquals(223.67f / 255f, c.accentSoft.red, 0.002f)
    }

    @Test
    fun accentChoicesMatchV2() {
        assertEquals(Color(0xFF2A6FD6), AccentChoice.Sky.light)
        assertEquals(Color(0xFF8BBBFF), AccentChoice.Sky.dark)
        assertEquals(Color(0xFFC9472C), AccentChoice.Coral.light)
        assertEquals(Color(0xFFC2A8FF), AccentChoice.Plum.dark)
        assertEquals(Color(0xFF1B2420), AccentChoice.Ink.light)
        assertEquals(AccentChoice.Sky.dark, darkDtmColors(AccentChoice.Sky).accent)
        assertNotEquals(lightDtmColors(AccentChoice.Coral).accentSoft, lightDtmColors(AccentChoice.Jade).accentSoft)
    }

    @Test
    fun statusColorsMatchDesignSystemDoc() {
        val c = lightDtmColors()

        assertEquals(Color(0xFFF43F5E), c.rose)
        assertEquals(Color(0xFF10B981), c.emerald)
        assertEquals(Color(0xFFF59E0B), c.amber)
        assertEquals(Color(0xFF8B5CF6), c.violet)
        assertEquals(c.rose, darkDtmColors().rose)
    }

    @Test
    fun radiiMatchV2() {
        val r = DtmRadii()

        assertEquals(30.dp, r.xl)
        assertEquals(22.dp, r.lg)
        assertEquals(16.dp, r.md)
        assertEquals(12.dp, r.sm)
        assertEquals(18.dp, r.rowSmall)
        assertEquals(26.dp, r.rowLarge)
    }

    @Test
    fun cardTonesMatchV2() {
        assertEquals(Color(0xFF111714), CardTone.DarkText.text)
        assertEquals(0.64f, CardTone.DarkText.textMuted.alpha, 0.005f)
        assertEquals(0.5f, CardTone.DarkText.glass.alpha, 0.005f)
        assertEquals(Color.White, CardTone.LightText.text)
        assertEquals(0.16f, CardTone.LightText.glass.alpha, 0.005f)
        assertEquals(0.3f, CardTone.LightText.glassEdge.alpha, 0.005f)
    }

    @Test
    fun cardPaletteHasSixteenSwatchesAndEightGradients() {
        assertEquals(16, CardPalette.swatches.size)
        assertEquals(8, CardPalette.gradients.size)
        assertEquals(Color(0xFFCDEFDF), CardPalette.swatches.first().color)
        assertEquals(Color(0xFF3F3787), CardPalette.gradients.first { it.first == "Dusk" }.second.base)
    }

    @Test
    fun typographyMatchesV2Sizes() {
        val t = dtmTypographyFallback()

        assertEquals(32.sp, t.screenTitle.fontSize)
        assertEquals((-0.04).em, t.screenTitle.letterSpacing)
        assertEquals(14.sp, t.sectionTitle.fontSize)
        assertEquals(15.sp, t.body.fontSize)
        assertEquals(13.sp, t.kicker.fontSize)
        assertEquals(16.sp, t.button.fontSize)
        assertEquals((-0.045).em, t.number.letterSpacing)
        assertEquals(11.sp, t.pre.fontSize)
    }

    @Test
    fun materialMappingUsesBrandColors() {
        val light = lightDtmColors().toMaterialColorScheme()
        val dark = darkDtmColors().toMaterialColorScheme()

        assertEquals(Color(0xFF0E8F63), light.primary)
        assertEquals(Color(0xFFF5F7F3), light.background)
        assertEquals(Color(0xFF52D6A3), dark.primary)
        assertEquals(Color(0xFF0F1312), dark.background)
        assertEquals(Color(0xFFD2433A), light.error)
    }

    @Test
    fun darkSchemeIsDarker() {
        assertTrue(darkDtmColors().bg.red < lightDtmColors().bg.red)
        assertEquals(Color.Black, dimmedBackdrop(Color.White, 1f))
    }
}

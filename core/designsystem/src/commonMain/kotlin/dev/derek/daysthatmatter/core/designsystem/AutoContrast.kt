package dev.derek.daysthatmatter.core.designsystem

import androidx.compose.ui.graphics.Color
import dev.derek.daysthatmatter.core.designsystem.theme.CardTextColor
import dev.derek.daysthatmatter.core.designsystem.theme.CardTone
import dev.derek.daysthatmatter.core.designsystem.theme.mixSrgb

/** WCAG AA contrast for body text (docs/features/customization/SPEC.md section 4.2). */
const val AA_CONTRAST = 4.5f

/** Photos have no single color; v2 uses this stand-in (`baseColor`) to decide the text color. */
val PhotoStandInColor = Color(0xFF3A4A44)

/** The backdrop as seen by the text: the base color under a black scrim of opacity [dim] (blended in sRGB like CSS). */
fun dimmedBackdrop(base: Color, dim: Float): Color = base.mixSrgb(Color.Black, dim.coerceIn(0f, 1f))

/**
 * Picks the card text tone for [base] under a black scrim of [dim]. [CardTextColor.Auto] takes white or ink,
 * whichever has the higher contrast ratio against the dimmed color. The crossover is a relative luminance of
 * about 0.2, the value v2 uses.
 */
fun resolveCardTone(base: Color, dim: Float = 0f, mode: CardTextColor = CardTextColor.Auto): CardTone = when (mode) {
    CardTextColor.White -> CardTone.LightText
    CardTextColor.Ink -> CardTone.DarkText
    CardTextColor.Auto -> {
        val backdrop = dimmedBackdrop(base, dim)
        val onLight = contrastRatio(backdrop, CardTone.LightText.text)
        val onDark = contrastRatio(backdrop, CardTone.DarkText.text)
        if (onLight >= onDark) CardTone.LightText else CardTone.DarkText
    }
}

/** Contrast ratio of [tone]'s text over [base] dimmed by [dim]. */
fun toneContrast(base: Color, dim: Float, tone: CardTone): Float = contrastRatio(dimmedBackdrop(base, dim), tone.text)

/** True when the tone reaches WCAG AA (4.5:1) on the dimmed backdrop. Not meaningful for photos. */
fun meetsAa(base: Color, dim: Float, tone: CardTone): Boolean = toneContrast(base, dim, tone) >= AA_CONTRAST

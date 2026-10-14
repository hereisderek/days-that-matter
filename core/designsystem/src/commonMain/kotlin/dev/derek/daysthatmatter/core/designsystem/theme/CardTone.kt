package dev.derek.daysthatmatter.core.designsystem.theme

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color

/**
 * Text and glass colors of a day card, chosen from its background (design/v2/styles.css `.card` and
 * `.card.tone-light`). Cards do not follow the app theme: they bring their own background.
 */
@Immutable
data class CardTone(
    /** `--t1`: title and number. */
    val text: Color,
    /** `--t2`: date line and unit label. */
    val textMuted: Color,
    /** `--glass`: emoji chip and pill fill. */
    val glass: Color,
    /** `--glass-edge`: emoji chip and pill border. */
    val glassEdge: Color,
    /** True for light text: v2 adds a soft text shadow so it stays readable over photos. */
    val lightText: Boolean,
) {
    companion object {
        /** Ink text for pale backgrounds. */
        val DarkText = CardTone(
            text = Color(0xFF111714),
            textMuted = Color(0xFF111714).copy(alpha = 0.64f),
            glass = Color(0xFFFFFFFF).copy(alpha = 0.5f),
            glassEdge = Color(0xFFFFFFFF).copy(alpha = 0.75f),
            lightText = false,
        )

        /** White text for dark backgrounds and photos (`.tone-light`). */
        val LightText = CardTone(
            text = Color(0xFFFFFFFF),
            textMuted = Color(0xFFFFFFFF).copy(alpha = 0.8f),
            glass = Color(0xFFFFFFFF).copy(alpha = 0.16f),
            glassEdge = Color(0xFFFFFFFF).copy(alpha = 0.3f),
            lightText = true,
        )
    }
}

/** Customize > Style > Text color. [Auto] picks by contrast ([resolveCardTone]). */
enum class CardTextColor { Auto, White, Ink }

package dev.derek.daysthatmatter.core.designsystem

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance

/**
 * WCAG 2.x contrast ratio between two opaque colors, from 1.0 (same luminance) to 21.0
 * (black on white). Used to pick readable text over user-chosen card colors and photos.
 */
fun contrastRatio(a: Color, b: Color): Float {
    val lighter = maxOf(a.luminance(), b.luminance())
    val darker = minOf(a.luminance(), b.luminance())
    return (lighter + 0.05f) / (darker + 0.05f)
}

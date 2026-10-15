package dev.derek.daysthatmatter.feature.events.presentation.common

import dev.derek.daysthatmatter.core.designsystem.components.CardBackground
import dev.derek.daysthatmatter.core.designsystem.components.CardSize
import dev.derek.daysthatmatter.core.designsystem.components.CardStyle
import dev.derek.daysthatmatter.core.designsystem.components.CardTypeface
import dev.derek.daysthatmatter.core.designsystem.components.DayCardState
import dev.derek.daysthatmatter.core.designsystem.theme.CardPalette
import dev.derek.daysthatmatter.core.model.event.EventDoc
import dev.derek.daysthatmatter.core.model.event.Theme
import dev.derek.daysthatmatter.feature.events.domain.EventCountdown
import androidx.compose.ui.graphics.Color
import dev.derek.daysthatmatter.core.model.event.CardSize as ModelCardSize

/**
 * Maps a day's shared look (`theme`) to the design system's card values. Palette ids are the swatch and gradient
 * names of [CardPalette] in lower case with dashes ("mint", "deep-sea"); unknown ids fall back to Mint, so a
 * newer palette never breaks an older app. Photo backdrops come with the backdrop work.
 */
object CardLook {
    /** Emoji shown when a day has none. */
    const val DEFAULT_EMOJI = "🗓️"

    fun paletteId(name: String): String = name.lowercase().replace(' ', '-')

    fun background(theme: Theme): CardBackground {
        theme.gradient?.let { (a, b) ->
            val first = parseHex(a)
            val second = parseHex(b)
            if (first != null && second != null) return CardBackground.Mesh(first, first, second, second)
        }
        CardPalette.gradients.firstOrNull { paletteId(it.first) == theme.paletteId }?.let { return it.second }
        val swatch = CardPalette.swatches.firstOrNull { paletteId(it.name) == theme.paletteId } ?: CardPalette.Mint
        return CardBackground.Solid(swatch.color)
    }

    fun style(theme: Theme): CardStyle = when (theme.cardStyle.lowercase()) {
        "clean", "minimalistclean" -> CardStyle.Clean
        "outline", "cardoutlined" -> CardStyle.Outline
        "poster", "fullbleedposter" -> CardStyle.Poster
        else -> CardStyle.Glass
    }

    fun typeface(theme: Theme): CardTypeface = when (theme.typography.lowercase()) {
        "serif" -> CardTypeface.Serif
        "rounded" -> CardTypeface.Rounded
        "mono" -> CardTypeface.Mono
        "condensed", "poster" -> CardTypeface.Condensed
        else -> CardTypeface.Sans
    }

    fun size(theme: Theme): CardSize = when (theme.size) {
        ModelCardSize.Small -> CardSize.Small
        ModelCardSize.Medium -> CardSize.Medium
        ModelCardSize.Large -> CardSize.Large
    }

    /**
     * A Home card for [day]. Large rows get the live ticker. Pinned days say so on the date line, since the
     * pinned carousel is not built yet; days shared with the reader name their role.
     */
    fun card(day: EventCountdown): DayCardState {
        val doc: EventDoc = day.event.doc
        val value = CountdownText.value(doc, day.countdown)
        val size = size(doc.theme)
        val marker = when {
            day.event.isPinned && day.event.isOwner -> "Pinned · "
            !day.event.isOwner -> "Shared · "
            else -> ""
        }
        return DayCardState(
            title = doc.title,
            emoji = doc.emoji ?: DEFAULT_EMOJI,
            number = value.number,
            unit = value.unit,
            meta = marker + CountdownText.meta(doc, day.countdown),
            tick = if (size == CardSize.Large) CountdownText.tick(day.countdown) else null,
            background = background(doc.theme),
            style = style(doc.theme),
            typeface = typeface(doc.theme),
            size = size,
        )
    }

    private fun parseHex(text: String): Color? {
        val hex = text.removePrefix("#")
        if (hex.length != 6) return null
        val rgb = hex.toLongOrNull(16) ?: return null
        return Color(0xFF000000 or rgb)
    }
}

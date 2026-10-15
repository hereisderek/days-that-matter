package dev.derek.daysthatmatter.core.designsystem.components

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.painter.Painter
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import dev.derek.daysthatmatter.core.designsystem.theme.CardPalette
import dev.derek.daysthatmatter.core.designsystem.theme.CardTextColor
import dev.derek.daysthatmatter.core.designsystem.theme.DtmSizes

/** Card size (`theme.size`): the Home list row is 64, 84 or 132 dp tall; a Large grid tile spans two columns. */
enum class CardSize(val rowHeight: Dp) {
    Small(DtmSizes.rowSmall),
    Medium(DtmSizes.rowMedium),
    Large(DtmSizes.rowLarge),
}

/** Customize > Style > Card style (`.st-*` in design/v2/styles.css). */
enum class CardStyle { Glass, Clean, Outline, Poster }

/** Customize > Style > Typeface. Serif, Rounded and Condensed fall back to platform families until those fonts ship. */
enum class CardTypeface { Sans, Serif, Rounded, Mono, Condensed }

/** Where the memo badge sits (remote config `ui.memoBadge`). */
enum class MemoBadgePosition { TopLeft, TopRight }

/** The color layer behind a card (Customize > Background). */
@Immutable
sealed interface CardBackground {
    /** Color used for the auto-contrast decision. */
    val baseColor: Color

    data class Solid(val color: Color) : CardBackground {
        override val baseColor: Color get() = color
    }

    /** Four-layer mesh gradient (`mesh()` in design/v2/app.js): three radial blobs over [base]. */
    data class Mesh(val base: Color, val a: Color, val b: Color, val c: Color) : CardBackground {
        override val baseColor: Color get() = base
    }

    /** A photo or art, drawn cropped to fill. [standIn] is the color the contrast decision uses. */
    class Image(
        val painter: Painter,
        val standIn: Color,
        /** Backdrop blur in dp (0 to 16). Applied on Android 12 and later; ignored elsewhere. */
        val blur: Dp = 0.dp,
    ) : CardBackground {
        override val baseColor: Color get() = standIn
    }
}

/**
 * Everything a day card needs to draw, as plain values. Domain types from :core:model are mapped to this later.
 *
 * @param number the big number as text ("1,248", "38"); [pre] a small label above it ("Day").
 * @param unit the label under the number ("days to go").
 * @param meta the date line ("Sat, 30 Nov · yearly").
 * @param tick the live ticker ("37d 04h 12m 08s"), shown on Large rows.
 * @param memoCount owner-only memo count; 0 hides the badge.
 * @param dim black scrim opacity over the background (0 to 0.7).
 */
@Immutable
data class DayCardState(
    val title: String,
    val emoji: String,
    val number: String,
    val unit: String,
    val meta: String = "",
    val pre: String? = null,
    val tick: String? = null,
    val background: CardBackground = CardBackground.Solid(CardPalette.Mint.color),
    val style: CardStyle = CardStyle.Glass,
    val typeface: CardTypeface = CardTypeface.Sans,
    val size: CardSize = CardSize.Medium,
    val textColor: CardTextColor = CardTextColor.Auto,
    val dim: Float = 0f,
    val memoCount: Int = 0,
    val memoBadge: MemoBadgePosition = MemoBadgePosition.TopRight,
) {
    /** Screen reader text: "Norway trip, 38 days to go". */
    val description: String
        get() = listOfNotNull(title, listOfNotNull(pre, number, unit).joinToString(" ")).joinToString(", ")
}

/** Badge text: the count, "9+" above nine. */
fun memoBadgeText(count: Int): String = if (count > 9) "9+" else count.toString()

/** Font size of the card number per context (`.ctx-row .num` and siblings in design/v2/styles.css). */
object CardNumberSize {
    fun row(size: CardSize, style: CardStyle, typeface: CardTypeface): Int = when {
        size == CardSize.Small -> 24
        size == CardSize.Large -> 46
        style == CardStyle.Poster -> 40
        typeface == CardTypeface.Serif -> 36
        else -> 30
    }

    fun tile(size: CardSize, style: CardStyle): Int = when {
        size == CardSize.Large -> 60
        style == CardStyle.Poster -> 60
        else -> 46
    }
}

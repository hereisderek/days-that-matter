package dev.derek.daysthatmatter.core.designsystem.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import dev.derek.daysthatmatter.core.designsystem.theme.CardTone
import dev.derek.daysthatmatter.core.designsystem.theme.DtmTheme
import dev.derek.daysthatmatter.core.designsystem.theme.DtmTypography

/** Font family of a card typeface; the families v2 loads from Google Fonts fall back to platform ones. */
fun CardTypeface.family(type: DtmTypography): FontFamily = when (this) {
    CardTypeface.Sans -> type.sans
    CardTypeface.Mono -> type.mono
    CardTypeface.Serif -> FontFamily.Serif
    CardTypeface.Rounded -> type.sans
    CardTypeface.Condensed -> type.sans
}

/** `.card .num` with the per-typeface overrides of design/v2/styles.css. */
internal fun DtmTypography.cardNumberStyle(typeface: CardTypeface, sizeSp: Int): TextStyle {
    val base = number.copy(fontFamily = typeface.family(this), fontSize = sizeSp.sp, lineHeight = (sizeSp * 0.92f).sp)
    return when (typeface) {
        CardTypeface.Serif -> base.copy(fontWeight = FontWeight.Normal, letterSpacing = (-0.03).em)
        CardTypeface.Rounded -> base.copy(fontWeight = FontWeight.Bold, letterSpacing = (-0.045).em)
        CardTypeface.Mono -> base.copy(fontWeight = FontWeight.Medium, letterSpacing = (-0.07).em)
        CardTypeface.Condensed -> base.copy(fontWeight = FontWeight.SemiBold, letterSpacing = (-0.01).em)
        CardTypeface.Sans -> base
    }
}

/** `.card .t` with the per-typeface overrides. */
internal fun DtmTypography.cardTitleStyle(typeface: CardTypeface, sizeSp: Float): TextStyle {
    val base = cardTitle.copy(fontFamily = typeface.family(this), fontSize = sizeSp.sp)
    return when (typeface) {
        CardTypeface.Serif -> base.copy(fontWeight = FontWeight.Normal, fontStyle = FontStyle.Italic, letterSpacing = 0.em)
        CardTypeface.Rounded -> base.copy(fontWeight = FontWeight.Bold, letterSpacing = (-0.02).em)
        CardTypeface.Mono -> base.copy(fontWeight = FontWeight.Medium, letterSpacing = (-0.02).em)
        CardTypeface.Condensed -> base.copy(fontWeight = FontWeight.Medium, letterSpacing = 0.03.em)
        CardTypeface.Sans -> base
    }
}

/**
 * The countdown number with its unit label under it, right-aligned as in the Home list row. [pre] is the small
 * caps label above the number ("Day"). Colors come from [tone] unless [color] is given.
 */
@Composable
fun CountdownNumber(
    number: String,
    unit: String,
    modifier: Modifier = Modifier,
    pre: String? = null,
    numberSize: TextUnit = 30.sp,
    unitSize: TextUnit = 11.5.sp,
    typeface: CardTypeface = CardTypeface.Sans,
    tone: CardTone = CardTone.DarkText,
    color: Color = tone.text,
    mutedColor: Color = tone.textMuted,
    horizontalAlignment: Alignment.Horizontal = Alignment.End,
    unitGap: Dp = 4.dp,
    textShadow: Boolean = tone.lightText,
) {
    val type = DtmTheme.typography
    Column(modifier, horizontalAlignment = horizontalAlignment) {
        if (pre != null) {
            Text(
                text = pre.uppercase(),
                style = type.pre,
                color = mutedColor,
                modifier = Modifier.padding(bottom = 2.dp),
            )
        }
        Text(
            text = number,
            style = type.cardNumberStyle(typeface, numberSize.value.toInt()).copy(color = color).soft(textShadow),
            maxLines = 1,
            textAlign = TextAlign.End,
        )
        UnitLabel(unit, mutedColor, unitSize, Modifier.padding(top = unitGap), textShadow)
    }
}

/** `.card .u`: the unit under the number, medium weight. */
@Composable
fun UnitLabel(
    unit: String,
    color: Color,
    size: TextUnit = 11.5.sp,
    modifier: Modifier = Modifier,
    textShadow: Boolean = false,
) {
    Text(
        text = unit,
        style = DtmTheme.typography.cardUnit.copy(fontSize = size, color = color).soft(textShadow),
        maxLines = 1,
        modifier = modifier,
    )
}

/** `text-shadow: 0 1px 14px rgba(0,0,0,.2)` of `.tone-light`. */
internal fun TextStyle.soft(enabled: Boolean): TextStyle =
    if (enabled) copy(shadow = Shadow(Color.Black.copy(alpha = 0.2f), Offset(0f, 1f), 14f)) else this

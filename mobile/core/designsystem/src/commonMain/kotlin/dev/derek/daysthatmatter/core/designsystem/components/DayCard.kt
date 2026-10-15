package dev.derek.daysthatmatter.core.designsystem.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import androidx.compose.ui.text.font.FontWeight
import dev.derek.daysthatmatter.core.designsystem.icons.DtmIcons
import androidx.compose.material3.Icon
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.RowScope
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.TextStyle
import dev.derek.daysthatmatter.core.designsystem.PhotoStandInColor
import dev.derek.daysthatmatter.core.designsystem.resolveCardTone
import dev.derek.daysthatmatter.core.designsystem.theme.CardTone
import dev.derek.daysthatmatter.core.designsystem.theme.PhotoEdgeColor
import dev.derek.daysthatmatter.core.designsystem.theme.DtmRadii
import dev.derek.daysthatmatter.core.designsystem.theme.DtmSizes
import dev.derek.daysthatmatter.core.designsystem.theme.DtmTheme
import dev.derek.daysthatmatter.core.designsystem.theme.mixSrgb

/** Test tags of the day card components. */
object DtmTestTags {
    const val DayCard = "dtm-day-card"
    const val MemoBadge = "dtm-memo-badge"
    const val EmojiChip = "dtm-emoji-chip"
    const val DayCardHero = "dtm-day-card-hero"
}

/** Colors a card resolves from its [DayCardState] and the theme. */
internal data class CardLook(
    val tone: CardTone,
    val surface: Color?,
    val edge: Color?,
    val numberColor: Color,
    val outline: Boolean,
)

@Composable
internal fun rememberCardLook(state: DayCardState): CardLook {
    val colors = DtmTheme.colors
    return remember(state.background, state.style, state.textColor, state.dim, colors) {
        if (state.style == CardStyle.Outline) {
            val edge = if (state.background is CardBackground.Image) PhotoEdgeColor else state.background.baseColor
            CardLook(
                tone = CardTone(
                    text = colors.ink,
                    textMuted = colors.ink2,
                    glass = colors.surface2,
                    glassEdge = Color.Transparent,
                    lightText = false,
                ),
                surface = colors.surface,
                edge = edge,
                numberColor = colors.ink.mixSrgb(edge, 0.55f),
                outline = true,
            )
        } else {
            val base = if (state.background is CardBackground.Image) PhotoStandInColor else state.background.baseColor
            val tone = resolveCardTone(base, state.dim, state.textColor)
            CardLook(tone, null, null, tone.text, false)
        }
    }
}

private fun CardSize.rowRadius(radii: DtmRadii): Dp = when (this) {
    CardSize.Small -> radii.rowSmall
    CardSize.Medium -> radii.lg
    CardSize.Large -> radii.rowLarge
}

private fun Modifier.cardSurface(
    state: DayCardState,
    look: CardLook,
    shape: RoundedCornerShape,
    onClick: (() -> Unit)?,
    tag: String = DtmTestTags.DayCard,
): Modifier = this
    .testTag(tag)
    .clip(shape)
    .let { if (look.surface != null) it.background(look.surface) else it }
    .let { if (look.edge != null) it.border(BorderStroke(1.5.dp, look.edge), shape) else it }
    .semantics(mergeDescendants = true) { contentDescription = state.description }
    .let { if (onClick != null) it.clickable(role = Role.Button, onClick = onClick) else it }

/** Poster and Condensed capitalize the title (`.st-poster .t`, `.font-condensed .t`). */
private fun cardTitleText(state: DayCardState): String =
    if (state.typeface == CardTypeface.Condensed || (state.style == CardStyle.Poster && state.typeface != CardTypeface.Serif)) {
        state.title.uppercase()
    } else {
        state.title
    }

@Composable
private fun cardTitleStyle(state: DayCardState, sizeSp: Float, tone: CardTone, shadow: Boolean): TextStyle {
    val poster = state.style == CardStyle.Poster
    val size = when {
        poster && state.typeface == CardTypeface.Serif -> 16f
        poster -> 12f
        else -> sizeSp
    }
    val base = DtmTheme.typography.cardTitleStyle(state.typeface, size).copy(color = tone.text)
    val styled = if (poster && state.typeface != CardTypeface.Serif) {
        base.copy(fontWeight = FontWeight.SemiBold, letterSpacing = 0.08.em)
    } else {
        base
    }
    return styled.soft(shadow)
}

/** `.emo`: the emoji in a round glass chip. Glass shows the chip; Clean and Poster show the bare emoji. */
@Composable
internal fun EmojiChip(
    emoji: String,
    style: CardStyle,
    look: CardLook,
    swatch: Color,
    size: Dp,
    fontSize: Float,
    modifier: Modifier = Modifier,
) {
    val colors = DtmTheme.colors
    val chip = when (style) {
        CardStyle.Glass -> Modifier.background(look.tone.glass, CircleShape).border(1.dp, look.tone.glassEdge, CircleShape)
        CardStyle.Outline -> Modifier.background(swatch, CircleShape).border(1.dp, colors.line, CircleShape)
        CardStyle.Clean, CardStyle.Poster -> Modifier
    }
    Box(
        modifier.size(size).testTag(DtmTestTags.EmojiChip).then(chip),
        contentAlignment = Alignment.Center,
    ) {
        Text(text = emoji, fontSize = fontSize.sp, lineHeight = fontSize.sp)
    }
}

/** `.memo-badge`: a small accent tab with the memo icon and the count ("9+" above nine). */
@Composable
internal fun MemoBadge(count: Int, position: MemoBadgePosition, small: Boolean, modifier: Modifier = Modifier) {
    val colors = DtmTheme.colors
    val shape = when (position) {
        MemoBadgePosition.TopLeft -> RoundedCornerShape(bottomStart = 8.dp, bottomEnd = 8.dp)
        MemoBadgePosition.TopRight -> RoundedCornerShape(topStart = 8.dp, bottomStart = 8.dp)
    }
    val horizontal = when {
        small -> 6.dp
        position == MemoBadgePosition.TopRight -> 8.dp
        else -> 7.dp
    }
    val iconSize = if (small) 9.dp else 11.dp
    Row(
        modifier
            .testTag(DtmTestTags.MemoBadge)
            .height(if (small) 14.dp else 18.dp)
            .background(colors.accent, shape)
            .padding(horizontal = horizontal),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        Icon(DtmIcons.Memo, contentDescription = null, tint = colors.onAccent, modifier = Modifier.size(iconSize))
        Text(
            text = memoBadgeText(count),
            style = DtmTheme.typography.memoBadge.copy(fontSize = if (small) 9.5.sp else 10.5.sp),
            color = colors.onAccent,
        )
    }
}

@Composable
private fun BoxScope.MemoBadgeSlot(state: DayCardState, small: Boolean) {
    if (state.memoCount <= 0) return
    val align = when (state.memoBadge) {
        MemoBadgePosition.TopLeft -> Modifier.align(Alignment.TopStart).padding(start = 24.dp)
        MemoBadgePosition.TopRight -> Modifier.align(Alignment.TopEnd).padding(top = if (small) 6.dp else 10.dp)
    }
    MemoBadge(state.memoCount, state.memoBadge, small, align)
}

/**
 * Home list row in the three sizes: Small 64 dp (emoji, title, number), Medium 84 dp (adds the date line and the
 * unit) and Large 132 dp (46 sp number and the live [DayCardState.tick]). Radii 18, 22 and 26.
 */
@Composable
fun DayCardRow(
    state: DayCardState,
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
) {
    val look = rememberCardLook(state)
    val tone = look.tone
    val radii = DtmTheme.radii
    val shape = RoundedCornerShape(state.size.rowRadius(radii))
    val small = state.size == CardSize.Small
    val large = state.size == CardSize.Large
    val shadow = tone.lightText && !look.outline
    val emojiSize = if (small) 36.dp else if (large) 54.dp else 46.dp
    val emojiFont = if (small) 17f else if (large) 27f else 22f
    val rightBadge = state.memoCount > 0 && state.memoBadge == MemoBadgePosition.TopRight
    Box(modifier.fillMaxWidth().height(state.size.rowHeight).cardSurface(state, look, shape, onClick)) {
        if (!look.outline) CardBackdrop(state.background, state.dim)
        Row(
            Modifier.fillMaxSize().padding(start = if (large) 16.dp else 14.dp, end = if (large) 20.dp else 18.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(if (large) 14.dp else 12.dp),
        ) {
            EmojiChip(state.emoji, state.style, look, state.background.baseColor, emojiSize, emojiFont)
            Column(Modifier.weight(1f)) {
                Text(
                    text = cardTitleText(state),
                    style = cardTitleStyle(state, if (small) 15f else if (large) 19f else 16f, tone, shadow),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                if (!small && state.meta.isNotEmpty()) {
                    Text(
                        text = state.meta,
                        style = DtmTheme.typography.cardMeta.copy(color = tone.textMuted).soft(shadow),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                if (large && state.tick != null) {
                    Text(
                        text = state.tick,
                        style = DtmTheme.typography.tick.copy(color = tone.textMuted).soft(shadow),
                        maxLines = 1,
                        modifier = Modifier.padding(top = 6.dp),
                    )
                }
            }
            CountdownNumber(
                number = state.number,
                unit = state.unit,
                pre = state.pre,
                numberSize = CardNumberSize.row(state.size, state.style, state.typeface).sp,
                unitSize = if (small) 10.5.sp else if (large) 12.5.sp else 11.5.sp,
                unitGap = if (small) 2.dp else 4.dp,
                typeface = state.typeface,
                tone = tone,
                color = look.numberColor,
                textShadow = shadow,
                modifier = Modifier.padding(top = if (rightBadge) 12.dp else 0.dp),
            )
        }
        MemoBadgeSlot(state, small)
    }
}

/**
 * Home grid tile: 1 : 1.1 for Medium, 1 : 0.8 for Small, and a full-width 196 dp for Large, which spans both
 * columns in [DayCardGrid]. Give a Large tile the full width.
 */
@Composable
fun DayCardTile(
    state: DayCardState,
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
) {
    val look = rememberCardLook(state)
    val tone = look.tone
    val shape = RoundedCornerShape(DtmTheme.radii.lg)
    val small = state.size == CardSize.Small
    val large = state.size == CardSize.Large
    val shadow = tone.lightText && !look.outline
    val sizing = when (state.size) {
        CardSize.Large -> Modifier.fillMaxWidth().height(DtmSizes.tileLargeHeight)
        CardSize.Small -> Modifier.fillMaxWidth().aspectRatio(1f / 0.8f)
        CardSize.Medium -> Modifier.fillMaxWidth().aspectRatio(1f / 1.1f)
    }
    val rightBadge = state.memoCount > 0 && state.memoBadge == MemoBadgePosition.TopRight
    Box(modifier.then(sizing).cardSurface(state, look, shape, onClick)) {
        if (!look.outline) CardBackdrop(state.background, state.dim)
        Column(Modifier.fillMaxSize().padding(14.dp), verticalArrangement = Arrangement.SpaceBetween) {
            Row(Modifier.fillMaxWidth().padding(end = if (rightBadge) 26.dp else 0.dp)) {
                EmojiChip(state.emoji, state.style, look, state.background.baseColor, 38.dp, 19f)
            }
            Column {
                CountdownNumber(
                    number = state.number,
                    unit = state.unit,
                    pre = state.pre,
                    numberSize = CardNumberSize.tile(state.size, state.style).sp,
                    unitSize = 12.sp,
                    typeface = state.typeface,
                    tone = tone,
                    color = look.numberColor,
                    horizontalAlignment = Alignment.Start,
                    textShadow = shadow,
                )
                Text(
                    text = cardTitleText(state),
                    style = cardTitleStyle(state, 15f, tone, shadow),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 10.dp),
                )
                if (!small && state.meta.isNotEmpty()) {
                    Text(
                        text = state.meta,
                        style = DtmTheme.typography.cardMeta.copy(fontSize = 12.sp, color = tone.textMuted).soft(shadow),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
        MemoBadgeSlot(state, small = false)
    }
}

/** Two-column grid of [DayCardTile]s with a 10 dp gap; a Large card takes a full row. Not lazy: use it for short lists and previews. */
@Composable
fun DayCardGrid(
    cards: List<DayCardState>,
    modifier: Modifier = Modifier,
    onClick: (Int) -> Unit = {},
) {
    val rows = remember(cards) { gridRows(cards) }
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(DtmTheme.spacing.gap)) {
        rows.forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(DtmTheme.spacing.gap)) {
                row.forEach { index ->
                    DayCardTile(cards[index], Modifier.weight(1f), onClick = { onClick(index) })
                }
                if (row.size == 1 && cards[row[0]].size != CardSize.Large) Spacer(Modifier.weight(1f))
            }
        }
    }
}

/** Groups card indexes into grid rows: a Large card alone, others in pairs. */
internal fun gridRows(cards: List<DayCardState>): List<List<Int>> {
    val rows = mutableListOf<List<Int>>()
    var pending: Int? = null
    cards.forEachIndexed { index, card ->
        if (card.size == CardSize.Large) {
            pending?.let { rows += listOf(it) }
            pending = null
            rows += listOf(index)
        } else if (pending == null) {
            pending = index
        } else {
            rows += listOf(pending, index)
            pending = null
        }
    }
    pending?.let { rows += listOf(it) }
    return rows
}

/** `.glass-pill`: a rounded glass pill for metadata such as "Pinned" or the live ticker. */
@Composable
fun GlassPill(
    tone: CardTone,
    modifier: Modifier = Modifier,
    style: CardStyle = CardStyle.Glass,
    content: @Composable RowScope.() -> Unit,
) {
    val pillModifier = when (style) {
        CardStyle.Clean -> Modifier.border(1.dp, tone.glassEdge, CircleShape)
        CardStyle.Outline -> Modifier.background(tone.glass, CircleShape)
        else -> Modifier.background(tone.glass, CircleShape).border(1.dp, tone.glassEdge, CircleShape)
    }
    Row(
        modifier
            .height(30.dp)
            .then(pillModifier)
            .padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        content = content,
    )
}

/**
 * Pinned hero card (240 dp tall, or 96 dp collapsed strip): top row with the "Pinned" glass pill and emoji,
 * bottom section with title, meta line, big number with unit, and live ticker glass pill. When [compact] is true,
 * swaps to a 96 dp one-line strip with the title on the left and the number + unit on the right.
 */
@Composable
fun DayCardHero(
    state: DayCardState,
    modifier: Modifier = Modifier,
    compact: Boolean = false,
    contentAlpha: Float = 1f,
    onClick: (() -> Unit)? = null,
) {
    val look = rememberCardLook(state)
    val tone = look.tone
    val radii = DtmTheme.radii
    val shape = RoundedCornerShape(radii.xl)
    val shadow = tone.lightText && !look.outline

    Box(
        modifier
            .fillMaxWidth()
            .height(if (compact) DtmSizes.heroCompactHeight else DtmSizes.heroHeight)
            .cardSurface(state, look, shape, onClick, tag = DtmTestTags.DayCardHero)
    ) {
        if (!look.outline) CardBackdrop(state.background, state.dim)
        Box(
            Modifier
                .fillMaxSize()
                .graphicsLayer { alpha = contentAlpha }
        ) {
            if (compact) {
                Row(
                    Modifier
                        .fillMaxSize()
                        .padding(horizontal = 18.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        text = cardTitleText(state),
                        style = cardTitleStyle(state, 17f, tone, shadow),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f).padding(end = 12.dp),
                    )
                    CountdownNumber(
                        number = state.number,
                        unit = state.unit,
                        pre = state.pre,
                        numberSize = if (state.style == CardStyle.Poster) 54.sp else 44.sp,
                        unitSize = 12.5.sp,
                        unitGap = 4.dp,
                        typeface = state.typeface,
                        tone = tone,
                        color = look.numberColor,
                        textShadow = shadow,
                        horizontalAlignment = Alignment.End,
                    )
                }
            } else {
                Column(
                    Modifier
                        .fillMaxSize()
                        .padding(start = 18.dp, end = 18.dp, top = 16.dp, bottom = 18.dp),
                    verticalArrangement = Arrangement.SpaceBetween,
                ) {
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.Top,
                    ) {
                        GlassPill(tone = tone, style = state.style) {
                            Icon(DtmIcons.Pin, contentDescription = null, tint = tone.text, modifier = Modifier.size(13.dp))
                            Text(
                                text = "Pinned",
                                style = TextStyle(fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold, color = tone.text),
                            )
                        }
                        EmojiChip(state.emoji, state.style, look, state.background.baseColor, 46.dp, 23f)
                    }
                    Column {
                        Text(
                            text = cardTitleText(state),
                            style = cardTitleStyle(state, 21f, tone, shadow),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        val metaText = state.meta.removePrefix("Pinned · ")
                        if (metaText.isNotEmpty()) {
                            Text(
                                text = metaText,
                                style = DtmTheme.typography.cardMeta.copy(fontSize = 13.sp, color = tone.textMuted).soft(shadow),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.padding(top = 2.dp),
                            )
                        }
                        Row(
                            Modifier.fillMaxWidth().padding(top = 10.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.Bottom,
                        ) {
                            CountdownNumber(
                                number = state.number,
                                unit = state.unit,
                                pre = state.pre,
                                numberSize = if (state.style == CardStyle.Poster) 92.sp else 76.sp,
                                unitSize = 14.sp,
                                unitGap = 8.dp,
                                typeface = state.typeface,
                                tone = tone,
                                color = look.numberColor,
                                textShadow = shadow,
                                horizontalAlignment = Alignment.Start,
                            )
                            if (state.tick != null) {
                                GlassPill(
                                    modifier = Modifier.height(28.dp),
                                    tone = tone,
                                    style = state.style,
                                ) {
                                    Text(
                                        text = state.tick,
                                        style = DtmTheme.typography.tick.copy(color = tone.text, fontSize = 12.sp),
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
        if (state.memoCount > 0) {
            val align = when (state.memoBadge) {
                MemoBadgePosition.TopLeft -> Modifier.align(Alignment.TopStart).padding(start = 24.dp)
                MemoBadgePosition.TopRight -> Modifier.align(Alignment.TopEnd).padding(top = if (compact) 10.dp else 72.dp)
            }
            MemoBadge(state.memoCount, state.memoBadge, small = compact, align)
        }
    }
}


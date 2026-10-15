package dev.derek.daysthatmatter.feature.events.presentation.common

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.border
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import dev.derek.daysthatmatter.core.designsystem.components.CardSize
import dev.derek.daysthatmatter.core.designsystem.components.DayCardRow
import dev.derek.daysthatmatter.core.designsystem.components.DayCardState
import dev.derek.daysthatmatter.core.designsystem.components.DayCardTile
import dev.derek.daysthatmatter.core.designsystem.theme.DtmTheme

/** One entry of a card's long-press menu. [hint] is a second line ("also unpins it"). */
data class CardAction(val label: String, val hint: String? = null, val onClick: () -> Unit)

/** Test tags of the events screens. */
object EventsTestTags {
    fun card(id: String) = "day-$id"
    fun focusedCard(id: String) = "day-$id-focused"
    const val FocusOutline = "focus-outline"
    const val PinnedCarousel = "pinned-carousel"
    const val PinnedCarouselStrip = "pinned-carousel-strip"
    const val PinnedCarouselDots = "pinned-carousel-dots"
    fun carouselCard(id: String) = "carousel-day-$id"
    fun carouselDot(index: Int) = "carousel-dot-$index"
    const val CarouselSwitch = "carousel-switch"
    const val LiveTicker = "live-ticker"
    const val ArchivedRow = "archived-row"
    const val DayNumber = "day-number"
    const val UnitList = "unit-list"
    fun unit(label: String) = "unit-$label"
    const val WorkdaysNote = "workdays-note"
    const val SortButton = "sort-button"
    const val LayoutButton = "layout-button"
    const val NewDayFab = "new-day-fab"
    const val EditButton = "edit-button"
}

/**
 * A day card (list row or grid tile) that opens on tap and shows [actions] in a menu on long press
 * (design/v2: long-press or right-click a card). [isFocused] outlines the card in accent when centered
 * in the pinned carousel above the list.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun DayCardWithMenu(
    id: String,
    card: DayCardState,
    tile: Boolean,
    onOpen: () -> Unit,
    actions: List<CardAction>,
    modifier: Modifier = Modifier,
    isFocused: Boolean = false,
) {
    var menu by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(cardRadius(card.size, tile))
    val focusModifier = if (isFocused) {
        Modifier
            .testTag(EventsTestTags.focusedCard(id))
            .border(2.5.dp, DtmTheme.colors.accent, shape)
    } else Modifier

    Box(modifier.then(focusModifier)) {
        val clickable = Modifier
            .testTag(EventsTestTags.card(id))
            .clip(shape)
            .combinedClickable(
                role = Role.Button,
                onClickLabel = "Open",
                onLongClickLabel = if (actions.isEmpty()) null else "More actions",
                onLongClick = if (actions.isEmpty()) null else ({ menu = true }),
                onClick = onOpen,
            )
        if (tile) DayCardTile(card, clickable) else DayCardRow(card, clickable)
        if (isFocused) {
            Box(Modifier.matchParentSize().testTag(EventsTestTags.FocusOutline))
        }
        DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
            actions.forEach { action ->
                DropdownMenuItem(
                    text = {
                        if (action.hint == null) {
                            Text(action.label)
                        } else {
                            androidx.compose.foundation.layout.Column {
                                Text(action.label)
                                Text(action.hint, style = DtmTheme.typography.cardMeta, color = DtmTheme.colors.ink3)
                            }
                        }
                    },
                    onClick = {
                        menu = false
                        action.onClick()
                    },
                )
            }
        }
    }
}

@Composable
private fun cardRadius(size: CardSize, tile: Boolean): Dp {
    val radii = DtmTheme.radii
    return when {
        tile -> radii.lg
        size == CardSize.Small -> radii.rowSmall
        size == CardSize.Large -> radii.rowLarge
        else -> radii.lg
    }
}

/** Groups grid items into rows: a Large card alone, the others in pairs (as `DayCardGrid` does). */
fun <T> gridRows(items: List<T>, isLarge: (T) -> Boolean): List<List<T>> {
    val rows = mutableListOf<List<T>>()
    var pending: T? = null
    var hasPending = false
    for (item in items) {
        if (isLarge(item)) {
            if (hasPending) rows += listOf(pending as T)
            hasPending = false
            rows += listOf(item)
        } else if (!hasPending) {
            pending = item
            hasPending = true
        } else {
            rows += listOf(pending as T, item)
            hasPending = false
        }
    }
    if (hasPending) rows += listOf(pending as T)
    return rows
}

package dev.derek.daysthatmatter.feature.events.presentation.home

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.PagerState
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import dev.derek.daysthatmatter.core.designsystem.components.DayCardHero
import dev.derek.daysthatmatter.core.designsystem.theme.DtmSizes
import dev.derek.daysthatmatter.core.designsystem.theme.DtmTheme
import dev.derek.daysthatmatter.feature.events.presentation.common.EventsTestTags
import kotlinx.coroutines.launch
import kotlin.math.absoluteValue

/**
 * Pinned carousel on Home: centered focus card, side cards showing 16 pt peek margins at 92% scale
 * and 60% opacity. Snaps one card per swipe. Indicator dots below track the active card and scroll to it
 * on tap. Tapping a side peek card scrolls it to center; tapping the centered card opens the Day detail screen.
 * When [compact] is true (scrolling up the list), collapses into a 96 pt strip with the prototype collapse fix
 * (fade out, swap layout at 32 dp threshold, fade in; expand below 8 dp).
 */
@Composable
fun PinnedCarousel(
    pinnedDays: List<HomeDayItem>,
    activeIndex: Int,
    onSelectPin: (Int) -> Unit,
    onOpenDay: (String) -> Unit,
    compact: Boolean,
    modifier: Modifier = Modifier,
    reduceMotion: Boolean = DtmTheme.reducedMotion,
    pagerState: PagerState = rememberPagerState(
        initialPage = activeIndex.coerceIn(0, (pinnedDays.size - 1).coerceAtLeast(0)),
        pageCount = { pinnedDays.size },
    ),
) {
    if (pinnedDays.isEmpty()) return

    val coroutineScope = rememberCoroutineScope()

    LaunchedEffect(activeIndex) {
        // Only trigger programmatic scroll when not already scrolling or being dragged by the user
        if (!pagerState.isScrollInProgress && pagerState.currentPage != activeIndex && activeIndex in pinnedDays.indices) {
            if (reduceMotion) {
                pagerState.scrollToPage(activeIndex)
            } else {
                pagerState.animateScrollToPage(activeIndex)
            }
        }
    }

    LaunchedEffect(pagerState) {
        snapshotFlow { pagerState.settledPage }.collect { page ->
            if (page in pinnedDays.indices && page != activeIndex) {
                onSelectPin(page)
            }
        }
    }

    // Prototype collapse fix: fade out contents (90ms), switch layout, fade in (220ms, 40ms delay)
    val targetHeight = if (compact) DtmSizes.heroCompactHeight else DtmSizes.heroHeight
    val animatedHeight by animateDpAsState(
        targetValue = targetHeight,
        animationSpec = if (reduceMotion) snap() else tween(350, easing = FastOutSlowInEasing),
    )

    var displayedCompact by remember { mutableStateOf(compact) }
    val contentAlpha = remember { Animatable(1f) }

    LaunchedEffect(compact, reduceMotion) {
        if (displayedCompact != compact) {
            if (reduceMotion) {
                displayedCompact = compact
                contentAlpha.snapTo(1f)
            } else {
                contentAlpha.animateTo(0f, animationSpec = tween(90, easing = LinearEasing))
                displayedCompact = compact
                contentAlpha.animateTo(1f, animationSpec = tween(220, delayMillis = 40, easing = FastOutSlowInEasing))
            }
        }
    }

    val multi = pinnedDays.size > 1
    val horizontalPadding = if (multi) 26.dp else 16.dp
    val pageSpacing = if (multi) 10.dp else 0.dp

    Column(
        modifier = modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        HorizontalPager(
            state = pagerState,
            contentPadding = PaddingValues(horizontal = horizontalPadding),
            pageSpacing = pageSpacing,
            modifier = Modifier
                .fillMaxWidth()
                .height(animatedHeight)
                .testTag(if (displayedCompact) EventsTestTags.PinnedCarouselStrip else EventsTestTags.PinnedCarousel),
        ) { page ->
            val day = pinnedDays[page]
            val pageOffset = ((pagerState.currentPage - page) + pagerState.currentPageOffsetFraction)
                .absoluteValue
                .coerceIn(0f, 1f)
            val scale = 1f - pageOffset * 0.08f // 92% scale at distance 1
            val alpha = 1f - pageOffset * 0.40f // 60% opacity at distance 1
            val pageDiff = (page - pagerState.currentPage) - pagerState.currentPageOffsetFraction
            val transformOrigin = when {
                pageDiff < -0.05f -> TransformOrigin(1f, 0.5f)
                pageDiff > 0.05f -> TransformOrigin(0f, 0.5f)
                else -> TransformOrigin.Center
            }

            Box(
                Modifier
                    .fillMaxSize()
                    .graphicsLayer {
                        scaleX = scale
                        scaleY = scale
                        this.alpha = alpha
                        this.transformOrigin = transformOrigin
                    }
                    .testTag(EventsTestTags.carouselCard(day.id)),
            ) {
                DayCardHero(
                    state = day.card,
                    compact = displayedCompact,
                    contentAlpha = contentAlpha.value,
                    onClick = {
                        if (page == pagerState.currentPage) {
                            onOpenDay(day.id)
                        } else {
                            onSelectPin(page)
                            coroutineScope.launch {
                                if (reduceMotion) pagerState.scrollToPage(page)
                                else pagerState.animateScrollToPage(page)
                            }
                        }
                    },
                    modifier = Modifier.fillMaxSize(),
                )
            }
        }

        if (multi) {
            val continuousPos = (pagerState.currentPage + pagerState.currentPageOffsetFraction)
                .coerceIn(0f, (pinnedDays.size - 1).toFloat())
            CarouselDots(
                count = pinnedDays.size,
                continuousPosition = continuousPos,
                onSelect = { index ->
                    onSelectPin(index)
                    coroutineScope.launch {
                        if (reduceMotion) pagerState.scrollToPage(index)
                        else pagerState.animateScrollToPage(index)
                    }
                },
                reduceMotion = reduceMotion,
                pinnedDays = pinnedDays,
                modifier = Modifier
                    .align(Alignment.CenterHorizontally)
                    .testTag(EventsTestTags.PinnedCarouselDots),
            )
        }
    }
}

/** Indicator dots below the carousel tracking the active card. */
@Composable
fun CarouselDots(
    count: Int,
    continuousPosition: Float,
    onSelect: (Int) -> Unit,
    reduceMotion: Boolean,
    pinnedDays: List<HomeDayItem>,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.padding(top = 10.dp, bottom = 2.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        for (i in 0 until count) {
            val progress = (1f - (continuousPosition - i).absoluteValue).coerceIn(0f, 1f)
            val isSelected = progress >= 0.5f
            val dotWidth = if (reduceMotion) {
                if (isSelected) 18.dp else 6.dp
            } else {
                (6f + 12f * progress).dp
            }
            val dotColor = if (reduceMotion) {
                if (isSelected) DtmTheme.colors.ink else DtmTheme.colors.line2
            } else {
                lerp(DtmTheme.colors.line2, DtmTheme.colors.ink, progress)
            }
            val title = pinnedDays.getOrNull(i)?.card?.title.orEmpty()
            Box(
                modifier = Modifier
                    .size(width = dotWidth, height = 6.dp)
                    .clip(RoundedCornerShape(99.dp))
                    .background(dotColor)
                    .clickable(
                        role = Role.Tab,
                        onClickLabel = "Show $title",
                        onClick = { onSelect(i) },
                    )
                    .testTag(EventsTestTags.carouselDot(i))
                    .semantics {
                        selected = isSelected
                    },
            )
        }
    }
}

/** Backward compatible overload with discrete activeIndex. */
@Composable
fun CarouselDots(
    count: Int,
    activeIndex: Int,
    onSelect: (Int) -> Unit,
    reduceMotion: Boolean,
    pinnedDays: List<HomeDayItem>,
    modifier: Modifier = Modifier,
) = CarouselDots(
    count = count,
    continuousPosition = activeIndex.toFloat(),
    onSelect = onSelect,
    reduceMotion = reduceMotion,
    pinnedDays = pinnedDays,
    modifier = modifier,
)

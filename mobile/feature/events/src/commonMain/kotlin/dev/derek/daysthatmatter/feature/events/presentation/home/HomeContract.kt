package dev.derek.daysthatmatter.feature.events.presentation.home

import dev.derek.daysthatmatter.core.designsystem.components.DayCardState
import dev.derek.daysthatmatter.feature.events.domain.HomeFilter
import dev.derek.daysthatmatter.feature.events.domain.HomeSort

enum class HomeLayout { List, Grid }

enum class HomeSectionKind(val title: String) { Pinned("Pinned"), Upcoming("Upcoming"), Since("Since") }

/** One day on Home. [canPin] is false for days shared with the reader (pin state is owner-only). */
data class HomeDayItem(
    val id: String,
    val card: DayCardState,
    val pinned: Boolean,
    val canPin: Boolean,
    val isOwner: Boolean,
)

data class HomeSection(val kind: HomeSectionKind, val items: List<HomeDayItem>)

/** Why Home has no rows: nothing stored yet, or nothing matches the search or filter. */
enum class HomeEmpty { NothingYet, NoMatches }

/** A filter chip. */
data class FilterChip(val filter: HomeFilter, val label: String)

data class HomeUiState(
    val loading: Boolean = true,
    /** Today's date ("Wednesday, October 14"). */
    val kicker: String = "",
    val searching: Boolean = false,
    val query: String = "",
    val filter: HomeFilter = HomeFilter.All,
    val sort: HomeSort = HomeSort.Closest,
    val layout: HomeLayout = HomeLayout.List,
    val chips: List<FilterChip> = emptyList(),
    val sections: List<HomeSection> = emptyList(),
    val archivedCount: Int = 0,
    val empty: HomeEmpty? = null,
    val pinnedDays: List<HomeDayItem> = emptyList(),
    val showPinnedCarousel: Boolean = true,
    val activePinIndex: Int = 0,
) {
    /** The "Archived · N" row: shown with archived days, and only on the unfiltered, unsearched list (design/v2). */
    val showArchivedRow: Boolean get() = archivedCount > 0 && filter == HomeFilter.All && query.isBlank()

    /** Carousel sits at the top of Home when enabled, pinned days exist, and not searching or filtering (spec 2.8). */
    val showCarousel: Boolean
        get() = showPinnedCarousel &&
                pinnedDays.isNotEmpty() &&
                !searching &&
                query.isBlank() &&
                filter == HomeFilter.All
}

sealed interface HomeIntent {
    data object ToggleSearch : HomeIntent
    data class QueryChanged(val text: String) : HomeIntent
    data class SelectFilter(val filter: HomeFilter) : HomeIntent
    data class SelectSort(val sort: HomeSort) : HomeIntent
    data object ToggleLayout : HomeIntent
    data class OpenDay(val id: String) : HomeIntent
    data object OpenArchived : HomeIntent
    data class SetPinned(val id: String, val pinned: Boolean) : HomeIntent
    data class Archive(val id: String) : HomeIntent
    data class Delete(val id: String) : HomeIntent
    data class UndoDelete(val id: String) : HomeIntent
    data class SetShowPinnedCarousel(val show: Boolean) : HomeIntent
    data object TogglePinnedCarousel : HomeIntent
    data class SelectPin(val index: Int) : HomeIntent
}

sealed interface HomeEffect {
    data class OpenDay(val id: String) : HomeEffect
    data object OpenArchived : HomeEffect

    /** A short message; [undoDeleteId] adds an Undo action that restores that day. */
    data class Message(val text: String, val undoDeleteId: String? = null) : HomeEffect
}

/** Sort menu labels (`SORTS` in design/v2/app.js). */
fun HomeSort.label(): String = when (this) {
    HomeSort.Closest -> "Closest first"
    HomeSort.Furthest -> "Furthest first"
    HomeSort.AToZ -> "A to Z"
    HomeSort.RecentlyAdded -> "Recently added"
}

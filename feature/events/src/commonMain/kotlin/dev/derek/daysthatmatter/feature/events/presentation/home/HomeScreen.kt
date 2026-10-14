package dev.derek.daysthatmatter.feature.events.presentation.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.derek.daysthatmatter.core.designsystem.components.CardSize
import dev.derek.daysthatmatter.core.designsystem.components.CategoryChip
import dev.derek.daysthatmatter.core.designsystem.components.DtmTopBar
import dev.derek.daysthatmatter.core.designsystem.components.EmptyState
import dev.derek.daysthatmatter.core.designsystem.components.IconCircleButton
import dev.derek.daysthatmatter.core.designsystem.components.SearchField
import dev.derek.daysthatmatter.core.designsystem.components.SectionHeader
import dev.derek.daysthatmatter.core.designsystem.components.dtmShadow
import dev.derek.daysthatmatter.core.designsystem.icons.DtmIcons
import dev.derek.daysthatmatter.core.designsystem.theme.DtmTheme
import dev.derek.daysthatmatter.feature.events.domain.HomeSort
import dev.derek.daysthatmatter.feature.events.presentation.common.CardAction
import dev.derek.daysthatmatter.feature.events.presentation.common.DayCardWithMenu
import dev.derek.daysthatmatter.feature.events.presentation.common.EventsTestTags
import dev.derek.daysthatmatter.feature.events.presentation.common.gridRows
import org.koin.compose.viewmodel.koinViewModel

/** A debug-only button for the top bar (the design gallery entry). */
data class DebugAction(val label: String, val onClick: () -> Unit)

/** Home with its ViewModel from Koin. [debugAction] is shown in debug builds only. */
@Composable
fun HomeRoute(
    onOpenDay: (String) -> Unit,
    onOpenArchived: () -> Unit,
    modifier: Modifier = Modifier,
    debugAction: DebugAction? = null,
    viewModel: HomeViewModel = koinViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }
    LaunchedEffect(viewModel) {
        viewModel.effect.collect { effect ->
            when (effect) {
                is HomeEffect.OpenDay -> onOpenDay(effect.id)
                HomeEffect.OpenArchived -> onOpenArchived()
                is HomeEffect.Message -> {
                    val result = snackbar.showSnackbar(
                        message = effect.text,
                        actionLabel = effect.undoDeleteId?.let { "Undo" },
                        duration = SnackbarDuration.Short,
                    )
                    if (result == SnackbarResult.ActionPerformed && effect.undoDeleteId != null) {
                        viewModel.onIntent(HomeIntent.UndoDelete(effect.undoDeleteId))
                    }
                }
            }
        }
    }
    HomeScreen(state, viewModel::onIntent, modifier, snackbar, debugAction)
}

/**
 * Home (design/v2 `homeView`): fixed header with today's date and "Your days", search, filter chips, the Pinned,
 * Upcoming and Since sections in list or grid, and the "Archived · N" row at the end. Edge to edge: the header
 * sits under the status bar and the list scrolls behind the navigation bar.
 */
@Composable
fun HomeScreen(
    state: HomeUiState,
    onIntent: (HomeIntent) -> Unit,
    modifier: Modifier = Modifier,
    snackbar: SnackbarHostState = remember { SnackbarHostState() },
    debugAction: DebugAction? = null,
) {
    val colors = DtmTheme.colors
    val insets = WindowInsets.safeDrawing
    Box(modifier.fillMaxSize().background(colors.bg)) {
        Column(Modifier.fillMaxSize()) {
            DtmTopBar(
                title = "Your days",
                kicker = state.kicker,
                modifier = Modifier.windowInsetsPadding(insets.only(WindowInsetsSides.Top + WindowInsetsSides.Horizontal)),
                actions = {
                    if (debugAction != null) IconCircleButton(DtmIcons.Grid, debugAction.label, onClick = debugAction.onClick)
                    IconCircleButton(
                        icon = if (state.searching) DtmIcons.Close else DtmIcons.Search,
                        contentDescription = if (state.searching) "Close search" else "Search",
                        onClick = { onIntent(HomeIntent.ToggleSearch) },
                    )
                },
            )
            if (state.searching) {
                SearchField(
                    value = state.query,
                    onValueChange = { onIntent(HomeIntent.QueryChanged(it)) },
                    placeholder = "Search your days",
                    onClose = { onIntent(HomeIntent.ToggleSearch) },
                    modifier = Modifier
                        .windowInsetsPadding(insets.only(WindowInsetsSides.Horizontal))
                        .padding(start = 16.dp, end = 16.dp, bottom = 8.dp),
                )
            }
            HomeList(state, onIntent, Modifier.weight(1f))
        }
        SnackbarHost(
            snackbar,
            Modifier.align(Alignment.BottomCenter).windowInsetsPadding(insets.only(WindowInsetsSides.Bottom + WindowInsetsSides.Horizontal)),
        )
    }
}

@Composable
private fun HomeList(state: HomeUiState, onIntent: (HomeIntent) -> Unit, modifier: Modifier) {
    val insets = WindowInsets.safeDrawing
    val bottom = insets.only(WindowInsetsSides.Bottom).asPaddingValues().calculateBottomPadding()
    LazyColumn(
        modifier.fillMaxWidth().windowInsetsPadding(insets.only(WindowInsetsSides.Horizontal)),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(bottom = bottom + 40.dp),
    ) {
        item(key = "chips") { FilterChips(state, onIntent) }
        if (state.loading) return@LazyColumn
        if (state.sections.isEmpty()) {
            item(key = "empty-head") { SectionHeader("", actions = { Tools(state, onIntent) }) }
            item(key = "empty") {
                when (state.empty) {
                    HomeEmpty.NoMatches -> EmptyState("🌤️", "No matches", "Try another word or filter.")
                    else -> EmptyState("🌤️", "Nothing here yet", "Add a day and give it a photo or a color.")
                }
            }
        }
        state.sections.forEachIndexed { index, section ->
            item(key = "head-${section.kind}") {
                SectionHeader(
                    title = section.kind.title,
                    count = section.items.size,
                    actions = { if (index == 0) Tools(state, onIntent) },
                )
            }
            if (state.layout == HomeLayout.List) {
                items(section.items, key = { "${section.kind}-${it.id}" }) { item ->
                    DayCardWithMenu(
                        id = item.id,
                        card = item.card,
                        tile = false,
                        onOpen = { onIntent(HomeIntent.OpenDay(item.id)) },
                        actions = actions(item, onIntent),
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 5.dp),
                    )
                }
            } else {
                val rows = gridRows(section.items) { it.card.size == CardSize.Large }
                items(rows, key = { row -> "${section.kind}-" + row.joinToString("+") { it.id } }) { row ->
                    Row(
                        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 5.dp),
                        horizontalArrangement = Arrangement.spacedBy(DtmTheme.spacing.gap),
                    ) {
                        row.forEach { item ->
                            DayCardWithMenu(
                                id = item.id,
                                card = item.card,
                                tile = true,
                                onOpen = { onIntent(HomeIntent.OpenDay(item.id)) },
                                actions = actions(item, onIntent),
                                modifier = Modifier.weight(1f),
                            )
                        }
                        if (row.size == 1 && row[0].card.size != CardSize.Large) Spacer(Modifier.weight(1f))
                    }
                }
            }
        }
        if (state.showArchivedRow) {
            item(key = "archived") { ArchivedRow(state.archivedCount) { onIntent(HomeIntent.OpenArchived) } }
        }
    }
}

private fun actions(item: HomeDayItem, onIntent: (HomeIntent) -> Unit): List<CardAction> = buildList {
    if (item.canPin) {
        add(CardAction(if (item.pinned) "Unpin" else "Pin to top") { onIntent(HomeIntent.SetPinned(item.id, !item.pinned)) })
    }
    add(CardAction("Archive", hint = if (item.pinned) "also unpins it" else null) { onIntent(HomeIntent.Archive(item.id)) })
    add(CardAction(if (item.isOwner) "Delete" else "Leave") { onIntent(HomeIntent.Delete(item.id)) })
}

@Composable
private fun FilterChips(state: HomeUiState, onIntent: (HomeIntent) -> Unit) {
    Row(
        Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        state.chips.forEach { chip ->
            CategoryChip(chip.label, selected = chip.filter == state.filter, onClick = { onIntent(HomeIntent.SelectFilter(chip.filter)) })
        }
    }
}

/** List/grid switch and the sort menu (`.tools` in the first section header). */
@Composable
private fun Tools(state: HomeUiState, onIntent: (HomeIntent) -> Unit) {
    var sortMenu by remember { mutableStateOf(false) }
    IconCircleButton(
        icon = if (state.layout == HomeLayout.List) DtmIcons.Grid else DtmIcons.List,
        contentDescription = if (state.layout == HomeLayout.List) "Show as grid" else "Show as list",
        onClick = { onIntent(HomeIntent.ToggleLayout) },
        modifier = Modifier.testTag(EventsTestTags.LayoutButton),
    )
    Box {
        IconCircleButton(DtmIcons.Sort, "Sort", onClick = { sortMenu = true }, modifier = Modifier.testTag(EventsTestTags.SortButton))
        DropdownMenu(expanded = sortMenu, onDismissRequest = { sortMenu = false }) {
            HomeSort.entries.forEach { sort ->
                DropdownMenuItem(
                    text = { Text(sort.label()) },
                    trailingIcon = if (sort == state.sort) ({ Icon(DtmIcons.Check, contentDescription = "Selected", modifier = Modifier.size(18.dp)) }) else null,
                    onClick = {
                        sortMenu = false
                        onIntent(HomeIntent.SelectSort(sort))
                    },
                )
            }
        }
    }
}

/** `.arch-row`: "Archived" with the count and a chevron, at the end of the list. */
@Composable
private fun ArchivedRow(count: Int, onClick: () -> Unit) {
    val colors = DtmTheme.colors
    val shape = RoundedCornerShape(18.dp)
    Row(
        Modifier
            .testTag(EventsTestTags.ArchivedRow)
            .fillMaxWidth()
            .padding(start = 16.dp, end = 16.dp, top = 18.dp)
            .dtmShadow(shape)
            .background(colors.surface, shape)
            .clickable(role = Role.Button, onClickLabel = "Open archived days", onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp)
            .height(22.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(DtmIcons.Archive, contentDescription = null, tint = colors.ink2, modifier = Modifier.size(20.dp))
        Text("Archived", style = DtmTheme.typography.body, color = colors.ink2, modifier = Modifier.weight(1f))
        Text(count.toString(), style = DtmTheme.typography.body, color = colors.ink2)
        Icon(DtmIcons.Chevron, contentDescription = null, tint = colors.ink3, modifier = Modifier.size(18.dp))
    }
}

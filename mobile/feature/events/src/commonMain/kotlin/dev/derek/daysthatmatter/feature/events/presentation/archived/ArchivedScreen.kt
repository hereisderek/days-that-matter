package dev.derek.daysthatmatter.feature.events.presentation.archived

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.derek.daysthatmatter.core.designsystem.components.EmptyState
import dev.derek.daysthatmatter.core.designsystem.components.IconCircleButton
import dev.derek.daysthatmatter.core.designsystem.icons.DtmIcons
import dev.derek.daysthatmatter.core.designsystem.theme.DtmTheme
import dev.derek.daysthatmatter.feature.events.presentation.common.CardAction
import dev.derek.daysthatmatter.feature.events.presentation.common.DayCardWithMenu
import org.koin.compose.viewmodel.koinViewModel

/** The Archived screen with its ViewModel from Koin. */
@Composable
fun ArchivedRoute(
    onOpenDay: (String) -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: ArchivedViewModel = koinViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }
    LaunchedEffect(viewModel) {
        viewModel.effect.collect { effect ->
            when (effect) {
                is ArchivedEffect.OpenDay -> onOpenDay(effect.id)
                ArchivedEffect.Close -> onClose()
                is ArchivedEffect.Message -> {
                    val result = snackbar.showSnackbar(effect.text, actionLabel = effect.undoDeleteId?.let { "Undo" })
                    if (result == SnackbarResult.ActionPerformed && effect.undoDeleteId != null) {
                        viewModel.onIntent(ArchivedIntent.UndoDelete(effect.undoDeleteId))
                    }
                }
            }
        }
    }
    ArchivedScreen(state, viewModel::onIntent, modifier, snackbar)
}

/**
 * Archived days (design/v2 `archiveView`): back, the title, a line on what archiving does, and the days as list
 * rows. A day opens normally; long press offers Unarchive and Delete (Leave for days shared with the reader).
 */
@Composable
fun ArchivedScreen(
    state: ArchivedUiState,
    onIntent: (ArchivedIntent) -> Unit,
    modifier: Modifier = Modifier,
    snackbar: SnackbarHostState = remember { SnackbarHostState() },
) {
    val colors = DtmTheme.colors
    val insets = WindowInsets.safeDrawing
    Box(modifier.fillMaxSize().background(colors.bg)) {
        LazyColumn(
            Modifier.fillMaxSize().windowInsetsPadding(insets.only(WindowInsetsSides.Top + WindowInsetsSides.Horizontal)),
            contentPadding = PaddingValues(bottom = insets.only(WindowInsetsSides.Bottom).asPaddingValues().calculateBottomPadding() + 40.dp),
        ) {
            item(key = "head") {
                Row(Modifier.padding(horizontal = 12.dp, vertical = 6.dp)) {
                    IconCircleButton(DtmIcons.Back, "Back", onClick = { onIntent(ArchivedIntent.Back) })
                }
            }
            item(key = "title") {
                Text("Archived", style = DtmTheme.typography.screenTitle, color = colors.ink, modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 6.dp, bottom = 14.dp))
            }
            item(key = "lead") {
                Text(
                    "Hidden from Home and widgets. Reminders and notifications are off. Long-press a day to unarchive it.",
                    style = DtmTheme.typography.body.copy(fontSize = 14.5.sp),
                    color = colors.ink2,
                    modifier = Modifier.padding(start = 20.dp, end = 20.dp, bottom = 16.dp),
                )
            }
            if (!state.loading && state.items.isEmpty()) {
                item(key = "empty") { EmptyState("🗂️", "Nothing archived", "Archive a day from its menu to tidy up Home.") }
            }
            items(state.items, key = { it.id }) { item ->
                DayCardWithMenu(
                    id = item.id,
                    card = item.card,
                    tile = false,
                    onOpen = { onIntent(ArchivedIntent.Open(item.id)) },
                    actions = listOf(
                        CardAction("Unarchive") { onIntent(ArchivedIntent.Unarchive(item.id)) },
                        CardAction(if (item.isOwner) "Delete" else "Leave") { onIntent(ArchivedIntent.Delete(item.id)) },
                    ),
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 5.dp),
                )
            }
        }
        SnackbarHost(
            snackbar,
            Modifier.align(Alignment.BottomCenter).windowInsetsPadding(insets.only(WindowInsetsSides.Bottom + WindowInsetsSides.Horizontal)),
        )
    }
}

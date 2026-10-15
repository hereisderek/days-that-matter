package dev.derek.daysthatmatter.feature.events.presentation.day

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.derek.daysthatmatter.core.designsystem.components.CardBackdrop
import dev.derek.daysthatmatter.core.designsystem.components.CardStyle
import dev.derek.daysthatmatter.core.designsystem.components.DtmButton
import dev.derek.daysthatmatter.core.designsystem.components.DtmButtonSize
import dev.derek.daysthatmatter.core.designsystem.components.DtmButtonStyle
import dev.derek.daysthatmatter.core.designsystem.components.EmptyState
import dev.derek.daysthatmatter.core.designsystem.components.dtmShadow
import dev.derek.daysthatmatter.core.designsystem.components.family
import dev.derek.daysthatmatter.core.designsystem.icons.DtmIcons
import dev.derek.daysthatmatter.core.designsystem.icons.EditorIcons
import dev.derek.daysthatmatter.core.designsystem.resolveCardTone
import dev.derek.daysthatmatter.core.designsystem.theme.CardTone
import dev.derek.daysthatmatter.core.designsystem.theme.DtmTheme
import dev.derek.daysthatmatter.core.model.event.Role as EventRole
import dev.derek.daysthatmatter.core.model.event.UnitMode
import dev.derek.daysthatmatter.feature.events.presentation.common.CountdownText
import dev.derek.daysthatmatter.feature.events.presentation.common.EventsTestTags
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

/** The day page for [eventId] with its ViewModel from Koin. */
@Composable
fun DayRoute(
    eventId: String,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
    onEdit: ((String) -> Unit)? = null,
    viewModel: EventDetailViewModel = koinViewModel(key = "day-$eventId") { parametersOf(eventId) },
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }
    LaunchedEffect(viewModel) {
        viewModel.effect.collect { effect ->
            when (effect) {
                DayEffect.Close -> onClose()
                is DayEffect.Message -> snackbar.showSnackbar(effect.text)
            }
        }
    }
    DayScreen(state, viewModel::onIntent, modifier, snackbar, onEdit?.let { edit -> { edit(eventId) } })
}

/**
 * The day page (design/v2 `detailView`): the day's backdrop fills the top of the screen with the back button,
 * the badge, emoji, title, date line, the big number (tap to switch the unit), the live ticker and the unit list;
 * the panel below holds the Details block and, for archived days, Unarchive and Delete. Edge to edge: the backdrop
 * runs under the status bar. With [onEdit], the owner gets an Edit button at the top right (v2's "Customize"
 * action; members cannot open the editor).
 */
@Composable
fun DayScreen(
    state: DayUiState,
    onIntent: (DayIntent) -> Unit,
    modifier: Modifier = Modifier,
    snackbar: SnackbarHostState = remember { SnackbarHostState() },
    onEdit: (() -> Unit)? = null,
) {
    val colors = DtmTheme.colors
    Box(modifier.fillMaxSize().background(colors.bg)) {
        when (state) {
            DayUiState.Loading -> Unit
            DayUiState.NotFound -> Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing)) {
                GlassButton(CardTone.DarkText, onClick = { onIntent(DayIntent.Back) }, modifier = Modifier.padding(16.dp))
                EmptyState("🗂️", "This day is gone", "It was deleted, or it is no longer shared with you.")
            }
            is DayUiState.Content -> DayContent(state, onIntent, onEdit.takeIf { state.role == EventRole.Owner })
        }
        SnackbarHost(
            snackbar,
            Modifier.align(Alignment.BottomCenter)
                .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Bottom + WindowInsetsSides.Horizontal)),
        )
    }
}

@Composable
private fun DayContent(state: DayUiState.Content, onIntent: (DayIntent) -> Unit, onEdit: (() -> Unit)?) {
    val tone = remember(state.background) { resolveCardTone(state.background.baseColor) }
    val insets = WindowInsets.safeDrawing
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val heroHeight = maxHeight * 0.76f
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
            Box(Modifier.fillMaxWidth().heightIn(min = heroHeight)) {
                CardBackdrop(state.background, dim = 0f, modifier = Modifier.matchParentSize())
                Column(
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = heroHeight)
                        .windowInsetsPadding(insets.only(WindowInsetsSides.Top + WindowInsetsSides.Horizontal)),
                ) {
                    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                        GlassButton(tone, onClick = { onIntent(DayIntent.Back) })
                        if (onEdit != null) {
                            Spacer(Modifier.weight(1f))
                            GlassAction("Edit", tone, onClick = onEdit)
                        }
                    }
                    Spacer(Modifier.weight(1f))
                    Hero(state, tone, onIntent)
                }
            }
            Panel(state, onIntent)
        }
    }
}

@Composable
private fun Hero(state: DayUiState.Content, tone: CardTone, onIntent: (DayIntent) -> Unit) {
    val type = DtmTheme.typography
    val family = state.typeface.family(type)
    Column(Modifier.fillMaxWidth().padding(start = 24.dp, end = 24.dp, top = 24.dp, bottom = 60.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            GlassPill(state.badge, tone)
            if (state.archived) GlassPill("Archived", tone)
        }
        Box(
            Modifier
                .padding(top = 16.dp, bottom = 14.dp)
                .size(58.dp)
                .background(tone.glass, RoundedCornerShape(18.dp))
                .border(1.dp, tone.glassEdge, RoundedCornerShape(18.dp)),
            contentAlignment = Alignment.Center,
        ) { Text(state.emoji, fontSize = 29.sp) }
        Text(
            text = state.title,
            style = type.cardTitle.copy(fontFamily = family, fontSize = 32.sp, lineHeight = 34.sp, letterSpacing = (-0.03).em),
            color = tone.text,
        )
        Text(state.dateLine, style = type.body.copy(fontSize = 14.5.sp), color = tone.textMuted, modifier = Modifier.padding(top = 6.dp))
        val numberSize = when {
            state.longNumber -> 64.sp
            state.style == CardStyle.Poster -> 136.sp
            else -> 112.sp
        }
        val numberModifier = Modifier
            .padding(top = 22.dp)
            .testTag(EventsTestTags.DayNumber)
            .let {
                if (state.canChangeUnit) {
                    it.clickable(role = Role.Button, onClickLabel = "Switch unit") { onIntent(DayIntent.CycleUnit) }
                } else {
                    it
                }
            }
            .semantics(mergeDescendants = true) { contentDescription = "${state.number} ${state.unit}" }
        Column(numberModifier) {
            Text(
                text = state.number,
                style = type.number.copy(fontFamily = family, fontSize = numberSize, lineHeight = numberSize * 0.95f),
                color = tone.text,
                maxLines = 1,
            )
            Text(state.unit, style = type.cardUnit.copy(fontSize = 16.sp), color = tone.textMuted)
        }
        Text(state.tick, style = type.tick.copy(fontSize = 13.sp), color = tone.textMuted, modifier = Modifier.padding(top = 8.dp))
        if (state.canChangeUnit) UnitList(state.unitMode, tone) { onIntent(DayIntent.SelectUnit(it)) }
        if (state.showWorkdaysNote) {
            Text(
                WORKDAYS_NOTE,
                style = type.body.copy(fontSize = 12.5.sp),
                color = tone.textMuted,
                modifier = Modifier.padding(top = 10.dp).testTag(EventsTestTags.WorkdaysNote),
            )
        }
    }
}

/** `.seg.seg-glass.units`: the six units, scrolling sideways; the selected one is filled white. */
@Composable
private fun UnitList(selected: UnitMode, tone: CardTone, onSelect: (UnitMode) -> Unit) {
    val shape = RoundedCornerShape(DtmTheme.radii.pill)
    Row(
        Modifier
            .testTag(EventsTestTags.UnitList)
            .padding(top = 18.dp)
            .fillMaxWidth()
            .clip(shape)
            .background(tone.glass, shape)
            .border(1.dp, tone.glassEdge, shape)
            .horizontalScroll(rememberScrollState())
            .padding(3.dp),
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        UnitMode.entries.forEach { mode ->
            val on = mode == selected
            val label = CountdownText.unitLabel(mode)
            Box(
                Modifier
                    .testTag(EventsTestTags.unit(label))
                    .minimumInteractiveComponentSize()
                    .height(30.dp)
                    .clip(shape)
                    .background(if (on) Color.White.copy(alpha = 0.92f) else Color.Transparent, shape)
                    .clickable(role = Role.Tab) { onSelect(mode) }
                    .semantics { this.selected = on }
                    .padding(horizontal = 12.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    label,
                    style = DtmTheme.typography.chip.copy(fontSize = 12.5.sp, fontWeight = FontWeight.Medium),
                    color = if (on) Color(0xFF111714) else tone.textMuted,
                    maxLines = 1,
                )
            }
        }
    }
}

/** The sheet under the backdrop: Details, and Unarchive / Delete for archived days. */
@Composable
private fun Panel(state: DayUiState.Content, onIntent: (DayIntent) -> Unit) {
    val colors = DtmTheme.colors
    val insets = WindowInsets.safeDrawing
    Column(
        Modifier
            .offset(y = (-28).dp)
            .fillMaxWidth()
            .background(colors.bg, RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp))
            .windowInsetsPadding(insets.only(WindowInsetsSides.Bottom + WindowInsetsSides.Horizontal))
            .padding(start = 16.dp, end = 16.dp, top = 10.dp, bottom = 20.dp),
    ) {
        val shape = RoundedCornerShape(22.dp)
        Column(
            Modifier.padding(top = 12.dp).fillMaxWidth().dtmShadow(shape).background(colors.surface, shape).padding(16.dp),
        ) {
            Text("Details", style = DtmTheme.typography.heading.copy(fontSize = 15.sp, fontWeight = FontWeight.SemiBold), color = colors.ink)
            state.details.forEachIndexed { index, row ->
                if (index > 0) HorizontalDivider(color = colors.line)
                Row(
                    Modifier.fillMaxWidth().padding(vertical = 11.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text(row.label, style = DtmTheme.typography.body.copy(fontSize = 14.5.sp), color = colors.ink2)
                    Text(
                        row.value,
                        style = DtmTheme.typography.body.copy(fontSize = 14.5.sp),
                        color = colors.ink,
                        textAlign = TextAlign.End,
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
        if (state.archived) {
            Column(Modifier.padding(top = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                DtmButton("Unarchive", onClick = { onIntent(DayIntent.Unarchive) }, style = DtmButtonStyle.Secondary, size = DtmButtonSize.Compact)
                DtmButton(
                    if (state.role == EventRole.Owner) "Delete day" else "Leave day",
                    onClick = { onIntent(DayIntent.Delete) },
                    style = DtmButtonStyle.Text,
                )
            }
        }
    }
}

/** `.gbtn`: a 42 dp glass circle with the back arrow; 48 dp touch target. */
@Composable
private fun GlassButton(tone: CardTone, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Box(
        modifier
            .minimumInteractiveComponentSize()
            .size(42.dp)
            .clip(CircleShape)
            .background(tone.glass, CircleShape)
            .border(1.dp, tone.glassEdge, CircleShape)
            .clickable(role = Role.Button, onClick = onClick)
            .semantics { contentDescription = "Back" },
        contentAlignment = Alignment.Center,
    ) {
        Icon(DtmIcons.Back, contentDescription = null, tint = tone.text, modifier = Modifier.size(20.dp))
    }
}

/** `.act` on the backdrop: a 42 dp glass pill with an edit icon and a label; 48 dp touch target. */
@Composable
private fun GlassAction(label: String, tone: CardTone, onClick: () -> Unit) {
    val shape = RoundedCornerShape(DtmTheme.radii.pill)
    Row(
        Modifier
            .testTag(EventsTestTags.EditButton)
            .minimumInteractiveComponentSize()
            .height(42.dp)
            .clip(shape)
            .background(tone.glass, shape)
            .border(1.dp, tone.glassEdge, shape)
            .clickable(role = Role.Button, onClick = onClick)
            .padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Icon(EditorIcons.Edit, contentDescription = null, tint = tone.text, modifier = Modifier.size(18.dp))
        Text(label, style = DtmTheme.typography.pill, color = tone.text, maxLines = 1)
    }
}

/** `.glass-pill`. */
@Composable
private fun GlassPill(text: String, tone: CardTone) {
    val shape = RoundedCornerShape(DtmTheme.radii.pill)
    Box(
        Modifier.height(30.dp).background(tone.glass, shape).border(1.dp, tone.glassEdge, shape).padding(horizontal = 12.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, style = DtmTheme.typography.pill, color = tone.text, maxLines = 1)
    }
}

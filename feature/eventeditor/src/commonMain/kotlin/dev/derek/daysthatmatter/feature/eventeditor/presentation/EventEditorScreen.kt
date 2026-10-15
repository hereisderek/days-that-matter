@file:OptIn(ExperimentalLayoutApi::class)

package dev.derek.daysthatmatter.feature.eventeditor.presentation

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigationevent.NavigationEventInfo
import androidx.navigationevent.compose.NavigationBackHandler
import androidx.navigationevent.compose.rememberNavigationEventState
import dev.derek.daysthatmatter.core.designsystem.components.CardSize as UiCardSize
import dev.derek.daysthatmatter.core.designsystem.components.CategoryChip
import dev.derek.daysthatmatter.core.designsystem.components.ColorSwatchPicker
import dev.derek.daysthatmatter.core.designsystem.components.ContrastNote
import dev.derek.daysthatmatter.core.designsystem.components.DayCardRow
import dev.derek.daysthatmatter.core.designsystem.components.DtmButton
import dev.derek.daysthatmatter.core.designsystem.components.DtmButtonStyle
import dev.derek.daysthatmatter.core.designsystem.components.DtmDateField
import dev.derek.daysthatmatter.core.designsystem.components.DtmSegmentedControl
import dev.derek.daysthatmatter.core.designsystem.components.DtmTabRow
import dev.derek.daysthatmatter.core.designsystem.components.DtmTextField
import dev.derek.daysthatmatter.core.designsystem.components.DtmTimeField
import dev.derek.daysthatmatter.core.designsystem.components.EditorTopBar
import dev.derek.daysthatmatter.core.designsystem.components.EmojiPicker
import dev.derek.daysthatmatter.core.designsystem.components.EmptyState
import dev.derek.daysthatmatter.core.designsystem.components.FieldError
import dev.derek.daysthatmatter.core.designsystem.components.FieldLabel
import dev.derek.daysthatmatter.core.designsystem.components.FieldNote
import dev.derek.daysthatmatter.core.designsystem.components.GradientTilePicker
import dev.derek.daysthatmatter.core.designsystem.components.PreviewStage
import dev.derek.daysthatmatter.core.designsystem.components.SearchField
import dev.derek.daysthatmatter.core.designsystem.components.SelectableTile
import dev.derek.daysthatmatter.core.designsystem.components.ToggleRow
import dev.derek.daysthatmatter.core.designsystem.components.family
import dev.derek.daysthatmatter.core.designsystem.theme.CardPalette
import dev.derek.daysthatmatter.core.designsystem.theme.DtmTheme
import dev.derek.daysthatmatter.core.model.event.CardSize
import dev.derek.daysthatmatter.core.model.event.Theme
import dev.derek.daysthatmatter.core.model.event.UnitMode
import dev.derek.daysthatmatter.core.model.validation.Limits
import dev.derek.daysthatmatter.feature.eventeditor.domain.DraftField
import dev.derek.daysthatmatter.feature.eventeditor.domain.RepeatKind
import dev.derek.daysthatmatter.feature.events.domain.Categories
import dev.derek.daysthatmatter.feature.events.presentation.common.CardLook
import dev.derek.daysthatmatter.feature.events.presentation.common.CountdownText
import kotlinx.datetime.LocalDate
import kotlinx.datetime.LocalTime
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

/** Test tags of the editor screen. */
object EditorTestTags {
    const val Body = "editor-body"
    const val PinRow = "editor-pin"
    const val OtherZone = "editor-zone-other"
    const val ZoneList = "editor-zone-list"
    const val DiscardConfirm = "editor-discard"
    const val KeepEditing = "editor-keep-editing"
    const val GateOk = "editor-gate-ok"
    const val GeneralError = "editor-general-error"
    fun chip(label: String): String = "editor-chip-$label"
    fun style(id: String): String = "editor-style-$id"
    fun typeface(id: String): String = "editor-typeface-$id"
}

/**
 * The editor with its ViewModel from Koin. [onClose] leaves without saving; [onSaved] gets the day's id and whether it
 * was created.
 */
@Composable
fun EventEditorRoute(
    mode: EditorMode,
    onClose: () -> Unit,
    onSaved: (id: String, created: Boolean) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: EventEditorViewModel = koinViewModel(key = "editor-$mode") { parametersOf(mode) },
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(viewModel) {
        viewModel.effect.collect { effect ->
            when (effect) {
                EditorEffect.Close -> onClose()
                is EditorEffect.Saved -> onSaved(effect.id, effect.created)
                is EditorEffect.Message -> Unit
            }
        }
    }
    EventEditorScreen(state, viewModel::onIntent, modifier)
}

/**
 * The editor (design/v2 `editorView`): the bar with Cancel, the title and Save; the live preview card in the chosen
 * size; the Details, Background and Style tabs. Errors show under their fields; Save is off until the draft is valid.
 * Back asks before dropping unsaved changes. Edge to edge: the top area sits under the status bar's inset and the
 * form scrolls above the navigation bar and the keyboard.
 */
@Composable
fun EventEditorScreen(
    state: EditorUiState,
    onIntent: (EditorIntent) -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = DtmTheme.colors
    NavigationBackHandler(
        state = rememberNavigationEventState(NavigationEventInfo.None),
        isBackEnabled = true,
        onBackCompleted = { onIntent(EditorIntent.Cancel) },
    )
    Box(modifier.fillMaxSize().background(colors.bg)) {
        when (state) {
            EditorUiState.Loading -> Unit
            EditorUiState.NotFound -> Unavailable("🗂️", "This day is gone", "It was deleted, or it is no longer shared with you.", onIntent)
            EditorUiState.NotAllowed -> Unavailable(
                "🔒",
                "Only the owner can edit this day",
                "You can still change its unit on the day page if you are an editor.",
                onIntent,
            )
            is EditorUiState.Editing -> Editing(state, onIntent)
        }
    }
}

@Composable
private fun Unavailable(emoji: String, title: String, message: String, onIntent: (EditorIntent) -> Unit) {
    Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).padding(16.dp)) {
        EmptyState(emoji, title, message)
        DtmButton("Back", onClick = { onIntent(EditorIntent.Cancel) }, style = DtmButtonStyle.Secondary)
    }
}

@Composable
private fun Editing(state: EditorUiState.Editing, onIntent: (EditorIntent) -> Unit) {
    val colors = DtmTheme.colors
    val insets = WindowInsets.safeDrawing
    Column(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxWidth().background(colors.bg).windowInsetsPadding(insets.only(WindowInsetsSides.Top + WindowInsetsSides.Horizontal))) {
            EditorTopBar(
                title = state.title,
                onCancel = { onIntent(EditorIntent.Cancel) },
                onSave = { onIntent(EditorIntent.Save) },
                saveEnabled = state.canSave,
            )
            PreviewStage(Modifier.padding(horizontal = 16.dp)) {
                DayCardRow(state.preview.card, Modifier.fillMaxWidth())
            }
            DtmTabRow(
                tabs = EditorTab.entries.map { it.label },
                selectedIndex = state.tab.ordinal,
                onSelect = { onIntent(EditorIntent.TabPicked(EditorTab.entries[it])) },
            )
            Box(Modifier.fillMaxWidth().height(1.dp).background(colors.line))
        }
        val bottom = insets.only(WindowInsetsSides.Bottom).asPaddingValues().calculateBottomPadding()
        Column(
            Modifier
                .weight(1f)
                .fillMaxWidth()
                .testTag(EditorTestTags.Body)
                .verticalScroll(rememberScrollState())
                .windowInsetsPadding(insets.only(WindowInsetsSides.Horizontal))
                .padding(start = 16.dp, end = 16.dp, top = 18.dp, bottom = bottom + 72.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            when (state.tab) {
                EditorTab.Details -> DetailsTab(state, onIntent)
                EditorTab.Background -> BackgroundTab(state, onIntent)
                EditorTab.Style -> StyleTab(state, onIntent)
            }
            state.errors[DraftField.Other]?.let { error ->
                FieldError(error, Modifier.testTag(EditorTestTags.GeneralError))
            }
        }
    }
    if (state.confirmDiscard) DiscardDialog(onIntent)
    state.gate?.let { GateDialog(it, onIntent) }
}

@Composable
private fun ColumnScope.DetailsTab(state: EditorUiState.Editing, onIntent: (EditorIntent) -> Unit) {
    val draft = state.draft
    val errors = state.errors
    Column {
        FieldLabel("Title", trailing = EditorText.titleCounter(draft.title))
        DtmTextField(
            value = draft.title,
            onValueChange = { onIntent(EditorIntent.TitleChanged(it)) },
            placeholder = EditorText.TITLE_PLACEHOLDER,
            error = errors[DraftField.Title],
            large = true,
            contentDescription = "Title",
        )
    }
    Column {
        FieldLabel("Emoji")
        EmojiPicker(EditorText.emojis, draft.emoji, onSelect = { onIntent(EditorIntent.EmojiPicked(it)) })
        errors[DraftField.Emoji]?.let { FieldError(it) }
    }
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Column(Modifier.weight(1.25f)) {
            FieldLabel("Date")
            DtmDateField(
                text = CountdownText.dateYear(draft.date),
                selectedDateMillis = draft.date.toEpochDays() * MILLIS_PER_DAY,
                onDateSelected = { onIntent(EditorIntent.DatePicked(LocalDate.fromEpochDays(it.floorDiv(MILLIS_PER_DAY)))) },
                yearRange = Limits.MIN_YEAR..Limits.MAX_YEAR,
            )
            errors[DraftField.Date]?.let { FieldError(it) }
        }
        Column(Modifier.weight(1f)) {
            FieldLabel("Time", trailing = "optional")
            DtmTimeField(
                text = draft.time?.let(CountdownText::time),
                hour = draft.time?.hour ?: DEFAULT_HOUR,
                minute = draft.time?.minute ?: 0,
                onTimeSelected = { h, m -> onIntent(EditorIntent.TimePicked(LocalTime(h, m))) },
                onClear = { onIntent(EditorIntent.TimeCleared) },
                is24Hour = false,
            )
            errors[DraftField.Time]?.let { FieldError(it) }
        }
    }
    ZoneSection(state, onIntent)
    Column {
        FieldLabel("Repeat")
        Chips(RepeatKind.entries, draft.repeat, EditorText::repeatLabel) { onIntent(EditorIntent.RepeatPicked(it)) }
        if (draft.repeat == RepeatKind.EveryNDays) {
            Row(Modifier.padding(top = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Every", style = DtmTheme.typography.body.copy(fontSize = 14.sp), color = DtmTheme.colors.ink2)
                DtmTextField(
                    value = draft.everyDays,
                    onValueChange = { onIntent(EditorIntent.EveryDaysChanged(it)) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    contentDescription = "Every N days",
                    modifier = Modifier.width(88.dp),
                )
                Text("days", style = DtmTheme.typography.body.copy(fontSize = 14.sp), color = DtmTheme.colors.ink2)
            }
        }
        (errors[DraftField.EveryDays] ?: errors[DraftField.Repeat])?.let { FieldError(it) }
    }
    Column {
        FieldLabel("Category", trailing = "only you")
        Chips(Categories.all, Categories.byId(draft.categoryId), { "${it.emoji} ${it.name}" }) { onIntent(EditorIntent.CategoryPicked(it.id)) }
        errors[DraftField.Category]?.let { FieldError(it) }
    }
    if (!state.archived) {
        ToggleRow(
            title = "Pin to top",
            checked = draft.pinned,
            onCheckedChange = { onIntent(EditorIntent.PinnedChanged(it)) },
            subtitle = if (draft.pinned) "In the Pinned section at the top of Home" else "Shows first on Home, in the Pinned section",
            modifier = Modifier.testTag(EditorTestTags.PinRow),
        )
    }
    Column {
        FieldLabel("Notes", trailing = EditorText.notesCounter(draft.notes))
        DtmTextField(
            value = draft.notes,
            onValueChange = { onIntent(EditorIntent.NotesChanged(it)) },
            placeholder = EditorText.NOTES_PLACEHOLDER,
            error = errors[DraftField.Notes],
            minLines = 3,
            contentDescription = "Notes",
        )
    }
}

@Composable
private fun ZoneSection(state: EditorUiState.Editing, onIntent: (EditorIntent) -> Unit) {
    var picking by remember { mutableStateOf(false) }
    val zone = state.draft.timeZone
    Column {
        FieldLabel("Time zone")
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            state.zoneChoices.forEach { choice ->
                CategoryChip(
                    label = choice.label,
                    selected = choice.zoneId == zone,
                    onClick = { onIntent(EditorIntent.ZonePicked(choice.zoneId)) },
                    modifier = Modifier.testTag(EditorTestTags.chip(choice.label)),
                )
            }
            CategoryChip("Other…", selected = false, onClick = { picking = true }, modifier = Modifier.testTag(EditorTestTags.OtherZone))
        }
        FieldNote(if (zone != null) EditorText.FIXED_NOTE else EditorText.FLOATING_NOTE)
        state.errors[DraftField.TimeZone]?.let { FieldError(it) }
    }
    if (picking) {
        ZonePicker(
            onPick = {
                picking = false
                onIntent(EditorIntent.ZonePicked(it))
            },
            onDismiss = { picking = false },
        )
    }
}

/** A list of every time zone with a search field, for a fixed zone other than the chips offer. */
@Composable
private fun ZonePicker(onPick: (String) -> Unit, onDismiss: () -> Unit) {
    val zones = remember { EditorText.allZones() }
    var query by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = {},
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
        title = { Text("Time zone") },
        text = {
            Column {
                SearchField(query, { query = it }, placeholder = "Search cities")
                LazyColumn(Modifier.padding(top = 8.dp).heightIn(max = 360.dp).testTag(EditorTestTags.ZoneList)) {
                    items(EditorText.filterZones(zones, query), key = { it }) { id ->
                        Column(
                            Modifier
                                .fillMaxWidth()
                                .heightIn(min = 48.dp)
                                .clickable(role = Role.Button) { onPick(id) }
                                .padding(vertical = 8.dp),
                        ) {
                            Text(CountdownText.city(id), style = DtmTheme.typography.body, color = DtmTheme.colors.ink)
                            Text(id, style = DtmTheme.typography.body.copy(fontSize = 12.sp), color = DtmTheme.colors.ink3)
                        }
                    }
                }
            }
        },
    )
}

@Composable
private fun ColumnScope.BackgroundTab(state: EditorUiState.Editing, onIntent: (EditorIntent) -> Unit) {
    val draft = state.draft
    DtmSegmentedControl(
        options = BackgroundKind.entries.map { it.label },
        selectedIndex = state.background.ordinal,
        onSelect = { onIntent(EditorIntent.BackgroundPicked(BackgroundKind.entries[it])) },
    )
    val selectedName = (CardPalette.swatches.map { it.name } + CardPalette.gradients.map { it.first })
        .firstOrNull { CardLook.paletteId(it) == draft.paletteId && draft.gradient == null }
    when (state.background) {
        BackgroundKind.Color -> ColorSwatchPicker(
            swatches = CardPalette.swatches,
            selected = selectedName,
            onSelect = { onIntent(EditorIntent.PalettePicked(CardLook.paletteId(it.name))) },
        )
        BackgroundKind.Gradient -> GradientTilePicker(
            gradients = CardPalette.gradients,
            selected = selectedName,
            onSelect = { onIntent(EditorIntent.PalettePicked(CardLook.paletteId(it))) },
        )
    }
    ContrastNote(state.preview.contrastText, state.preview.contrastOk)
    state.errors[DraftField.Look]?.let { FieldError(it) }
}

@Composable
private fun ColumnScope.StyleTab(state: EditorUiState.Editing, onIntent: (EditorIntent) -> Unit) {
    val draft = state.draft
    val card = state.preview.card
    Column {
        FieldLabel("Card style")
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            EditorText.styles.chunked(2).forEach { pair ->
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    pair.forEach { (id, name, sub) ->
                        SelectableTile(
                            selected = draft.cardStyle == id,
                            onClick = { onIntent(EditorIntent.StylePicked(id)) },
                            modifier = Modifier.weight(1f).testTag(EditorTestTags.style(id)),
                            label = name,
                            radius = 20,
                        ) {
                            Column(Modifier.fillMaxWidth().padding(8.dp)) {
                                val look = Theme(draft.paletteId, id, draft.typography, draft.gradient)
                                DayCardRow(card.copy(style = CardLook.style(look), size = UiCardSize.Small, meta = "", tick = null))
                                Text(name, style = DtmTheme.typography.body.copy(fontSize = 13.sp, fontWeight = FontWeight.SemiBold), color = DtmTheme.colors.ink, modifier = Modifier.padding(start = 4.dp, top = 8.dp))
                                Text(sub, style = DtmTheme.typography.body.copy(fontSize = 11.5.sp), color = DtmTheme.colors.ink3, modifier = Modifier.padding(start = 4.dp))
                            }
                        }
                    }
                }
            }
        }
    }
    Column {
        FieldLabel("Size in the list", trailing = "Home list and grid")
        DtmSegmentedControl(
            options = CardSize.entries.map { sizeLabel(it) },
            selectedIndex = draft.size.ordinal,
            onSelect = { onIntent(EditorIntent.SizePicked(CardSize.entries[it])) },
        )
        FieldNote(EditorText.SIZE_NOTE)
    }
    Column {
        FieldLabel("Typeface")
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            EditorText.typefaces.forEach { (id, name) ->
                val face = CardLook.typeface(Theme(draft.paletteId, draft.cardStyle, id))
                SelectableTile(
                    selected = draft.typography == id,
                    onClick = { onIntent(EditorIntent.TypefacePicked(id)) },
                    modifier = Modifier.weight(1f).height(74.dp).testTag(EditorTestTags.typeface(id)),
                    label = name,
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(
                            card.number.filter { it.isDigit() }.take(4).ifEmpty { "38" },
                            style = DtmTheme.typography.number.copy(fontFamily = face.family(DtmTheme.typography), fontSize = 26.sp),
                            color = DtmTheme.colors.ink,
                            maxLines = 1,
                        )
                        Text(name, style = DtmTheme.typography.body.copy(fontSize = 11.sp), color = DtmTheme.colors.ink3, maxLines = 1)
                    }
                }
            }
        }
    }
    Column {
        FieldLabel("Count in")
        Chips(UnitMode.entries, draft.unitMode, CountdownText::unitLabel) { onIntent(EditorIntent.UnitPicked(it)) }
        FieldNote(EditorText.UNIT_NOTE)
        state.errors[DraftField.Unit]?.let { FieldError(it) }
    }
}

/** `.chips-wrap`: v2's chips in a wrapping row, one selected. */
@Composable
private fun <T> Chips(items: List<T>, selected: T?, label: (T) -> String, onPick: (T) -> Unit) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        items.forEach { item ->
            val text = label(item)
            CategoryChip(text, selected = item == selected, onClick = { onPick(item) }, modifier = Modifier.testTag(EditorTestTags.chip(text)))
        }
    }
}

@Composable
private fun DiscardDialog(onIntent: (EditorIntent) -> Unit) {
    AlertDialog(
        onDismissRequest = { onIntent(EditorIntent.KeepEditing) },
        title = { Text("Discard changes?") },
        text = { Text("Your changes to this day are not saved.") },
        confirmButton = {
            TextButton(onClick = { onIntent(EditorIntent.ConfirmDiscard) }, modifier = Modifier.testTag(EditorTestTags.DiscardConfirm)) {
                Text("Discard", color = DtmTheme.colors.danger)
            }
        },
        dismissButton = {
            TextButton(onClick = { onIntent(EditorIntent.KeepEditing) }, modifier = Modifier.testTag(EditorTestTags.KeepEditing)) {
                Text("Keep editing")
            }
        },
    )
}

@Composable
private fun GateDialog(notice: GateNotice, onIntent: (EditorIntent) -> Unit) {
    AlertDialog(
        onDismissRequest = { onIntent(EditorIntent.DismissGate) },
        title = { Text(notice.title) },
        text = { Text(notice.text) },
        confirmButton = {
            TextButton(onClick = { onIntent(EditorIntent.DismissGate) }, modifier = Modifier.testTag(EditorTestTags.GateOk)) { Text("OK") }
        },
    )
}

private fun sizeLabel(size: CardSize): String = when (size) {
    CardSize.Small -> "Small"
    CardSize.Medium -> "Medium"
    CardSize.Large -> "Large"
}

private const val MILLIS_PER_DAY = 86_400_000L

/** The time the picker opens on for a day without a time. */
private const val DEFAULT_HOUR = 9

package dev.derek.daysthatmatter.core.designsystem.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.derek.daysthatmatter.core.designsystem.theme.DtmTheme

/** Test tags of the editor chrome. */
object DtmEditorTestTags {
    const val Cancel = "dtm-editor-cancel"
    const val Save = "dtm-editor-save"
    const val Preview = "dtm-editor-preview"
    fun tab(label: String): String = "dtm-editor-tab-$label"
}

/**
 * `.ed-bar`: a 50 dp bar with the Cancel text button, the bold [title] in the middle and the accent Save pill. Save
 * is dimmed and not clickable when [saveEnabled] is false. Both buttons have 48 dp touch targets.
 */
@Composable
fun EditorTopBar(
    title: String,
    onCancel: () -> Unit,
    onSave: () -> Unit,
    modifier: Modifier = Modifier,
    saveEnabled: Boolean = true,
    cancelLabel: String = "Cancel",
    saveLabel: String = "Save",
) {
    val colors = DtmTheme.colors
    val pill = RoundedCornerShape(DtmTheme.radii.pill)
    Box(modifier.fillMaxWidth().height(50.dp).padding(horizontal = 12.dp)) {
        Box(
            Modifier
                .align(Alignment.CenterStart)
                .testTag(DtmEditorTestTags.Cancel)
                .minimumInteractiveComponentSize()
                .clip(pill)
                .clickable(role = Role.Button, onClick = onCancel)
                .padding(horizontal = 12.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(cancelLabel, style = DtmTheme.typography.body.copy(fontWeight = FontWeight.Medium), color = colors.ink2)
        }
        Text(
            title,
            style = DtmTheme.typography.body.copy(fontWeight = FontWeight.SemiBold),
            color = colors.ink,
            maxLines = 1,
            modifier = Modifier.align(Alignment.Center),
        )
        Box(
            Modifier
                .align(Alignment.CenterEnd)
                .testTag(DtmEditorTestTags.Save)
                .minimumInteractiveComponentSize()
                .alpha(if (saveEnabled) 1f else 0.45f)
                .clickable(enabled = saveEnabled, role = Role.Button, onClick = onSave),
            contentAlignment = Alignment.Center,
        ) {
            Box(
                Modifier.height(36.dp).background(colors.accent, pill).padding(horizontal = 18.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(saveLabel, style = DtmTheme.typography.body.copy(fontWeight = FontWeight.SemiBold), color = colors.onAccent)
            }
        }
    }
}

/** `.tabs`: equal-width 44 dp text tabs; the selected one is ink with a 2 dp ink underline. */
@Composable
fun DtmTabRow(
    tabs: List<String>,
    selectedIndex: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = DtmTheme.colors
    Row(modifier.fillMaxWidth().selectableGroup().padding(start = 12.dp, end = 12.dp, top = 4.dp)) {
        tabs.forEachIndexed { index, label ->
            val on = index == selectedIndex
            val line = colors.ink
            Box(
                Modifier
                    .weight(1f)
                    .height(44.dp)
                    .testTag(DtmEditorTestTags.tab(label))
                    .selectable(selected = on, role = Role.Tab, onClick = { onSelect(index) })
                    .drawBehind {
                        if (on) {
                            val y = size.height - 1.dp.toPx()
                            drawLine(line, Offset(0f, y), Offset(size.width, y), strokeWidth = 2.dp.toPx())
                        }
                    },
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    label,
                    style = DtmTheme.typography.body.copy(fontSize = 14.sp, fontWeight = FontWeight.SemiBold),
                    color = if (on) colors.ink else colors.ink3,
                    maxLines = 1,
                )
            }
        }
    }
}

/**
 * `.ed-preview`: the stage of the live preview card, a 26 dp rounded area on the second surface with a dot grid
 * (1 dp dots every 14 dp in the strong line color). [content] is centered.
 */
@Composable
fun PreviewStage(
    modifier: Modifier = Modifier,
    height: Dp = 196.dp,
    content: @Composable BoxScope.() -> Unit,
) {
    val colors = DtmTheme.colors
    val shape = RoundedCornerShape(26.dp)
    val dot = colors.line2
    Box(
        modifier
            .testTag(DtmEditorTestTags.Preview)
            .fillMaxWidth()
            .height(height)
            .clip(shape)
            .background(colors.surface2, shape)
            .drawBehind {
                val step = 14.dp.toPx()
                val r = 1.dp.toPx()
                var x = step / 2
                while (x < size.width) {
                    var y = step / 2
                    while (y < size.height) {
                        drawCircle(dot, r, Offset(x, y))
                        y += step
                    }
                    x += step
                }
            }
            .padding(horizontal = 12.dp),
        contentAlignment = Alignment.Center,
        content = content,
    )
}

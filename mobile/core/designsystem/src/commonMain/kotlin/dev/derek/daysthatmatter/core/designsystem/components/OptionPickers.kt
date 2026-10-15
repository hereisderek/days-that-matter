package dev.derek.daysthatmatter.core.designsystem.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.derek.daysthatmatter.core.designsystem.resolveCardTone
import dev.derek.daysthatmatter.core.designsystem.theme.CardSwatch
import dev.derek.daysthatmatter.core.designsystem.theme.DtmTheme

/** Test tags of the option pickers; [option] is the tag of one option by its name. */
object DtmPickerTestTags {
    fun option(name: String): String = "dtm-option-$name"
}

/**
 * `.emojis`: 46 dp emoji tiles in a row that scrolls sideways. The selected one gets the soft accent fill and a
 * 2 dp accent ring (`.emoji-opt[aria-pressed]`).
 */
@Composable
fun EmojiPicker(
    options: List<String>,
    selected: String?,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = DtmTheme.colors
    val shape = RoundedCornerShape(14.dp)
    Row(
        modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).selectableGroup().padding(2.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        options.forEach { emoji ->
            val on = emoji == selected
            Box(
                Modifier
                    .testTag(DtmPickerTestTags.option(emoji))
                    .size(46.dp)
                    .clip(shape)
                    .background(if (on) colors.accentSoft else colors.surface, shape)
                    .border(if (on) 2.dp else 1.dp, if (on) colors.accent else colors.line, shape)
                    .selectable(selected = on, role = Role.RadioButton, onClick = { onSelect(emoji) })
                    .semantics { contentDescription = "Emoji $emoji" },
                contentAlignment = Alignment.Center,
            ) {
                Text(emoji, fontSize = 22.sp)
            }
        }
    }
}

/**
 * `.swatches`: color circles in an 8-column grid. The selected circle gets a gap in the screen color and a 2 dp ink
 * ring (`.sw[aria-pressed]`). Each circle is announced by its name.
 */
@Composable
fun ColorSwatchPicker(
    swatches: List<CardSwatch>,
    selected: String?,
    onSelect: (CardSwatch) -> Unit,
    modifier: Modifier = Modifier,
    columns: Int = 8,
) {
    val colors = DtmTheme.colors
    Column(modifier.fillMaxWidth().selectableGroup(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        swatches.chunked(columns).forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                row.forEach { swatch ->
                    val on = swatch.name == selected
                    Box(
                        Modifier
                            .weight(1f)
                            .aspectRatio(1f)
                            .testTag(DtmPickerTestTags.option(swatch.name))
                            .selectedRing(on, CircleShape)
                            .clip(CircleShape)
                            .background(swatch.color, CircleShape)
                            .border(1.dp, colors.line2, CircleShape)
                            .selectable(selected = on, role = Role.RadioButton, onClick = { onSelect(swatch) })
                            .semantics { contentDescription = swatch.name },
                    )
                }
                repeat(columns - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

/**
 * `.tiles` of gradient presets: 3:4 tiles in a 4-column grid, the name in the corner in white or ink by contrast
 * (`.tile-opt .lbl`). The selected tile gets the ink ring.
 */
@Composable
fun GradientTilePicker(
    gradients: List<Pair<String, CardBackground.Mesh>>,
    selected: String?,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
    columns: Int = 4,
) {
    val shape = RoundedCornerShape(14.dp)
    Column(modifier.fillMaxWidth().selectableGroup(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        gradients.chunked(columns).forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEach { (name, mesh) ->
                    val on = name == selected
                    Box(
                        Modifier
                            .weight(1f)
                            .aspectRatio(3f / 4f)
                            .testTag(DtmPickerTestTags.option(name))
                            .selectedRing(on, shape)
                            .clip(shape)
                            .selectable(selected = on, role = Role.RadioButton, onClick = { onSelect(name) }),
                    ) {
                        CardBackdrop(mesh, dim = 0f, modifier = Modifier.matchParentSize())
                        Text(
                            name,
                            style = DtmTheme.typography.body.copy(fontSize = 11.sp, fontWeight = FontWeight.SemiBold),
                            color = resolveCardTone(mesh.baseColor).text,
                            modifier = Modifier.align(Alignment.BottomStart).padding(start = 7.dp, bottom = 6.dp),
                        )
                    }
                }
                repeat(columns - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

/**
 * `.style-opt` and `.font-opt`: a surface tile with an inset hairline that turns into a 2 dp accent ring when
 * [selected]. Holds any [content] (a mini card, a typeface sample).
 */
@Composable
fun SelectableTile(
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    label: String? = null,
    radius: Int = 16,
    content: @Composable BoxScope.() -> Unit,
) {
    val colors = DtmTheme.colors
    val shape = RoundedCornerShape(radius.dp)
    Box(
        modifier
            .clip(shape)
            .background(colors.surface, shape)
            .border(if (selected) 2.dp else 1.dp, if (selected) colors.accent else colors.line, shape)
            .selectable(selected = selected, role = Role.RadioButton, onClick = onClick)
            .let { m -> if (label != null) m.semantics { contentDescription = label } else m },
        contentAlignment = Alignment.Center,
        content = content,
    )
}

/** The ring of a selected swatch or tile: 2 dp of screen color, then 2 dp of ink, outside the shape. */
@Composable
private fun Modifier.selectedRing(on: Boolean, shape: Shape): Modifier {
    if (!on) return this
    val colors = DtmTheme.colors
    return border(2.dp, colors.ink, shape).padding(2.dp).border(2.dp, colors.bg, shape).padding(2.dp)
}

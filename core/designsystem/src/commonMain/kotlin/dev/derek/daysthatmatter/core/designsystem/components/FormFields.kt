package dev.derek.daysthatmatter.core.designsystem.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.error
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import dev.derek.daysthatmatter.core.designsystem.icons.EditorIcons
import dev.derek.daysthatmatter.core.designsystem.theme.DtmTheme

/** Test tags of the form components. */
object DtmFormTestTags {
    const val FieldError = "dtm-field-error"
    const val Counter = "dtm-field-counter"
    const val ContrastNote = "dtm-contrast-note"
}

/** `.flabel`: a 13 sp label above a field, with an optional muted note on the right (`.opt`, "optional", "12/100"). */
@Composable
fun FieldLabel(
    text: String,
    modifier: Modifier = Modifier,
    trailing: String? = null,
    trailingTestTag: String? = null,
) {
    val colors = DtmTheme.colors
    Row(
        modifier.fillMaxWidth().padding(bottom = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.Bottom,
    ) {
        Text(text, style = labelStyle(), color = colors.ink2)
        if (trailing != null) {
            Text(
                trailing,
                style = labelStyle().copy(fontWeight = FontWeight.Medium),
                color = colors.ink3,
                modifier = if (trailingTestTag != null) Modifier.testTag(trailingTestTag) else Modifier,
            )
        }
    }
}

@Composable
private fun labelStyle(): TextStyle = DtmTheme.typography.body.copy(fontSize = 13.sp, fontWeight = FontWeight.SemiBold)

/**
 * `.input`: a 50 dp field on the surface color with a 14 dp radius and an inset hairline that turns into a 2 dp
 * accent ring on focus and a danger ring when [error] is set. [large] is `.input.title` (18 sp, semibold).
 * [minLines] above 1 makes it the multi-line `.input.area`. [error] is shown under the field (`FieldError`).
 */
@Composable
fun DtmTextField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    error: String? = null,
    large: Boolean = false,
    minLines: Int = 1,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    contentDescription: String? = null,
) {
    val colors = DtmTheme.colors
    val shape = RoundedCornerShape(14.dp)
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    val ring = when {
        error != null -> colors.danger
        focused -> colors.accent
        else -> colors.line2
    }
    val base = DtmTheme.typography.body.copy(fontSize = 16.sp)
    val style = if (large) base.copy(fontSize = 18.sp, fontWeight = FontWeight.SemiBold, letterSpacing = (-0.01).em) else base
    Column(modifier.fillMaxWidth()) {
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            singleLine = minLines == 1,
            minLines = minLines,
            textStyle = style.copy(color = colors.ink),
            cursorBrush = SolidColor(colors.accent),
            keyboardOptions = keyboardOptions,
            interactionSource = interaction,
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = 50.dp)
                .background(colors.surface, shape)
                .border(if (focused || error != null) 2.dp else 1.dp, ring, shape)
                .semantics {
                    if (contentDescription != null) this.contentDescription = contentDescription
                    if (error != null) error(error)
                },
            decorationBox = { inner ->
                Box(
                    Modifier.padding(horizontal = 14.dp, vertical = if (minLines > 1) 12.dp else 14.dp),
                    contentAlignment = Alignment.CenterStart,
                ) {
                    if (value.isEmpty()) Text(placeholder, style = style, color = colors.ink3)
                    inner()
                }
            },
        )
        if (error != null) FieldError(error)
    }
}

/** An inline validation message in the danger color, under a field. */
@Composable
fun FieldError(text: String, modifier: Modifier = Modifier) {
    Text(
        text,
        style = DtmTheme.typography.body.copy(fontSize = 12.5.sp, fontWeight = FontWeight.Medium),
        color = DtmTheme.colors.danger,
        modifier = modifier.padding(top = 6.dp).testTag(DtmFormTestTags.FieldError),
    )
}

/** `.note`: 12.5 sp help text in the tertiary ink, under a control. */
@Composable
fun FieldNote(text: String, modifier: Modifier = Modifier) {
    Text(
        text,
        style = DtmTheme.typography.body.copy(fontSize = 12.5.sp),
        color = DtmTheme.colors.ink3,
        modifier = modifier.padding(top = 8.dp),
    )
}

/** `.info`: an icon and a line of text on the soft accent color, 16 dp radius. */
@Composable
fun InfoNote(text: String, modifier: Modifier = Modifier, icon: ImageVector = EditorIcons.Info) {
    val colors = DtmTheme.colors
    Row(
        modifier
            .fillMaxWidth()
            .background(colors.accentSoft, RoundedCornerShape(16.dp))
            .padding(horizontal = 14.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(icon, contentDescription = null, tint = colors.accent, modifier = Modifier.size(18.dp))
        Text(text, style = DtmTheme.typography.body.copy(fontSize = 13.sp), color = colors.ink2)
    }
}

/**
 * `.contrast`: a dot and a line saying whether the card text is readable on its background. [ok] false shows the
 * amber warning dot (`.contrast.warn`).
 */
@Composable
fun ContrastNote(text: String, ok: Boolean, modifier: Modifier = Modifier) {
    val colors = DtmTheme.colors
    Row(
        modifier.padding(top = 10.dp).testTag(DtmFormTestTags.ContrastNote),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Box(Modifier.size(8.dp).background(if (ok) colors.accent else colors.amber, CircleShape))
        Text(text, style = DtmTheme.typography.body.copy(fontSize = 13.sp), color = colors.ink2)
    }
}

package dev.derek.daysthatmatter.core.designsystem.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.derek.daysthatmatter.core.designsystem.icons.DtmIcons
import dev.derek.daysthatmatter.core.designsystem.theme.DtmSizes
import dev.derek.daysthatmatter.core.designsystem.theme.DtmTheme

/** Shadow standing in for v2's `--shadow-1` ([raised]) or `--shadow-2` (floating). */
@Composable
fun Modifier.dtmShadow(shape: Shape, floating: Boolean = false): Modifier {
    val tint = DtmTheme.colors.shadowTint
    val elevation = if (floating) DtmTheme.elevation.floating else DtmTheme.elevation.raised
    return shadow(elevation, shape, ambientColor = tint, spotColor = tint)
}

/**
 * `.icon-btn`: a 40 dp white circle with a soft shadow. The touch target is 48 dp (Android guideline); the circle
 * itself stays 40 dp.
 */
@Composable
fun IconCircleButton(
    icon: ImageVector,
    contentDescription: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = DtmTheme.colors
    Box(
        modifier
            .minimumInteractiveComponentSize()
            .size(DtmSizes.iconButton)
            .dtmShadow(CircleShape)
            .background(colors.surface, CircleShape)
            .clickable(role = Role.Button, onClick = onClick)
            .semantics { this.contentDescription = contentDescription },
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = null, tint = colors.ink, modifier = Modifier.size(20.dp))
    }
}

/** Button looks of v2: Primary `.btn-primary` (ink), Accent `.btn-accent`, Secondary `.btn-ghost`, Text `.btn-text`. */
enum class DtmButtonStyle { Primary, Accent, Secondary, Text }

/** Button sizes: Regular 54 dp / 16 sp (`.btn`), Compact 50 dp / 15 sp (`.btn-row .btn`), Small 36 dp / 14 sp (`.btn.sm`, wraps its text). */
enum class DtmButtonSize(val height: Int, val font: Float) {
    Regular(54, 16f),
    Compact(50, 15f),
    Small(36, 14f),
}

@Composable
fun DtmButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    style: DtmButtonStyle = DtmButtonStyle.Primary,
    size: DtmButtonSize = DtmButtonSize.Regular,
    enabled: Boolean = true,
    leadingIcon: ImageVector? = null,
) {
    val colors = DtmTheme.colors
    val shape = RoundedCornerShape(DtmTheme.radii.pill)
    val (container, content) = when (style) {
        DtmButtonStyle.Primary -> colors.ink to colors.bg
        DtmButtonStyle.Accent -> colors.accent to colors.onAccent
        DtmButtonStyle.Secondary -> colors.surface to colors.ink
        DtmButtonStyle.Text -> Color.Transparent to colors.ink2
    }
    val height = if (style == DtmButtonStyle.Text && size == DtmButtonSize.Regular) 44 else size.height
    val width = if (size == DtmButtonSize.Small) Modifier else Modifier.fillMaxWidth()
    Row(
        modifier
            .then(width)
            .height(height.dp)
            .alpha(if (enabled) 1f else 0.45f)
            .background(container, shape)
            .let { if (style == DtmButtonStyle.Secondary) it.border(BorderStroke(1.dp, colors.line2), shape) else it }
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
            .padding(horizontal = if (size == DtmButtonSize.Small) 14.dp else 0.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(if (size == DtmButtonSize.Small) 6.dp else 10.dp, Alignment.CenterHorizontally),
    ) {
        if (leadingIcon != null) {
            Icon(leadingIcon, contentDescription = null, tint = content, modifier = Modifier.size(18.dp))
        }
        Text(
            text = text,
            style = DtmTheme.typography.button.copy(
                fontSize = size.font.sp,
                fontWeight = if (style == DtmButtonStyle.Text) FontWeight.Medium else FontWeight.SemiBold,
            ),
            color = content,
            maxLines = 1,
        )
    }
}

/** `.chip`: a 34 dp pill filter. Selected chips are filled with ink. The touch target is 48 dp. */
@Composable
fun CategoryChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = DtmTheme.colors
    val shape = RoundedCornerShape(DtmTheme.radii.pill)
    Box(
        modifier
            .minimumInteractiveComponentSize()
            .height(DtmSizes.chip)
            .background(if (selected) colors.ink else colors.surface, shape)
            .let { if (selected) it else it.border(1.dp, colors.line, shape) }
            .clickable(role = Role.Tab, onClick = onClick)
            .semantics { this.selected = selected }
            .padding(horizontal = 14.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            style = DtmTheme.typography.chip,
            color = if (selected) colors.bg else colors.ink2,
            maxLines = 1,
        )
    }
}

/** `.sec-head`: a 14 sp section title with its count, and optional trailing tools. */
@Composable
fun SectionHeader(
    title: String,
    modifier: Modifier = Modifier,
    count: Int? = null,
    actions: @Composable RowScope.() -> Unit = {},
) {
    val colors = DtmTheme.colors
    Row(
        modifier
            .fillMaxWidth()
            .heightIn(min = 40.dp)
            .padding(start = 20.dp, end = 20.dp, top = 18.dp, bottom = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(text = title, style = DtmTheme.typography.sectionTitle, color = colors.ink2)
            if (count != null) {
                Text(
                    text = count.toString(),
                    style = DtmTheme.typography.sectionTitle.copy(fontWeight = FontWeight.Medium),
                    color = colors.ink3,
                    modifier = Modifier.padding(start = 4.dp),
                )
            }
        }
        Row(content = actions, verticalAlignment = Alignment.CenterVertically)
    }
}

/** `.empty`: a big emoji, a bold title and a line of help, centered. */
@Composable
fun EmptyState(
    emoji: String,
    title: String,
    message: String,
    modifier: Modifier = Modifier,
) {
    val colors = DtmTheme.colors
    Column(
        modifier.fillMaxWidth().padding(horizontal = 32.dp, vertical = 48.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(text = emoji, fontSize = 40.sp, modifier = Modifier.padding(bottom = 8.dp))
        Text(
            text = title,
            style = DtmTheme.typography.heading.copy(fontWeight = FontWeight.Bold),
            color = colors.ink,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(bottom = 4.dp),
        )
        Text(
            text = message,
            style = DtmTheme.typography.body,
            color = colors.ink3,
            textAlign = TextAlign.Center,
        )
    }
}

/**
 * `.fab`: the "New day" pill that floats at the bottom of Home. v2 has no tab bar; this button and
 * [BottomFade] are its bottom navigation.
 */
@Composable
fun NewDayFab(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = DtmTheme.colors
    val shape = RoundedCornerShape(DtmTheme.radii.pill)
    Row(
        modifier
            .height(DtmSizes.fab)
            .dtmShadow(shape, floating = true)
            .background(colors.ink, shape)
            .clickable(role = Role.Button, onClick = onClick)
            .padding(start = 18.dp, end = 24.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(DtmIcons.Plus, contentDescription = null, tint = colors.bg, modifier = Modifier.size(20.dp))
        Text(text = text, style = DtmTheme.typography.button, color = colors.bg, maxLines = 1)
    }
}

/** `.bottom-fade`: 120 dp of screen background rising from the bottom edge, so cards fade out under the FAB. */
@Composable
fun BottomFade(modifier: Modifier = Modifier) {
    val bg = DtmTheme.colors.bg
    Box(
        modifier
            .fillMaxWidth()
            .height(120.dp)
            .background(Brush.verticalGradient(0f to bg.copy(alpha = 0f), 0.72f to bg, 1f to bg)),
    )
}

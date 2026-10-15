package dev.derek.daysthatmatter.core.designsystem.components

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.derek.daysthatmatter.core.designsystem.theme.DtmTheme

/** `.switch`: a 50 x 30 dp track (accent when on) with a 24 dp white thumb. Drawing only; the row handles the tap. */
@Composable
fun DtmSwitch(checked: Boolean, modifier: Modifier = Modifier) {
    val colors = DtmTheme.colors
    val offset by animateDpAsState(if (checked) 20.dp else 0.dp)
    Box(
        modifier
            .width(50.dp)
            .height(30.dp)
            .background(if (checked) colors.accent else colors.surface3, RoundedCornerShape(DtmTheme.radii.pill))
            .padding(3.dp),
    ) {
        Box(
            Modifier
                .offset(x = offset)
                .size(24.dp)
                .shadow(1.dp, CircleShape)
                .background(Color.White, CircleShape),
        )
    }
}

/**
 * `.switch-row`: a title, an optional line of help and a [DtmSwitch] on a 16 dp surface card. The whole row is the
 * switch for touch and screen readers.
 */
@Composable
fun ToggleRow(
    title: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    enabled: Boolean = true,
) {
    val colors = DtmTheme.colors
    val shape = RoundedCornerShape(16.dp)
    Row(
        modifier
            .fillMaxWidth()
            .background(colors.surface, shape)
            .border(1.dp, colors.line, shape)
            .toggleable(value = checked, enabled = enabled, role = Role.Switch, onValueChange = onCheckedChange)
            .padding(horizontal = 14.dp, vertical = 13.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(Modifier.weight(1f)) {
            Text(title, style = DtmTheme.typography.body.copy(fontSize = 15.sp, fontWeight = FontWeight.SemiBold), color = colors.ink)
            if (subtitle != null) {
                Text(
                    subtitle,
                    style = DtmTheme.typography.body.copy(fontSize = 12.5.sp),
                    color = colors.ink3,
                    modifier = Modifier.padding(top = 1.dp),
                )
            }
        }
        DtmSwitch(checked)
    }
}

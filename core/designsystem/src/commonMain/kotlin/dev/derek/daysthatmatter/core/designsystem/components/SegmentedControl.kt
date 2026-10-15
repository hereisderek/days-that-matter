package dev.derek.daysthatmatter.core.designsystem.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.derek.daysthatmatter.core.designsystem.theme.DtmTheme

/**
 * `.seg`: options in a pill on the second surface; the selected one is a raised pill on the surface color.
 * [small] is `.seg.sm` (28 dp buttons, 12.5 sp). Each option takes an equal share of the width and a 48 dp touch
 * target; the drawn pill keeps v2's height.
 */
@Composable
fun DtmSegmentedControl(
    options: List<String>,
    selectedIndex: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
    small: Boolean = false,
) {
    val colors = DtmTheme.colors
    val shape = RoundedCornerShape(DtmTheme.radii.pill)
    Row(
        modifier
            .fillMaxWidth()
            .selectableGroup()
            .background(colors.surface2, shape)
            .padding(3.dp),
        horizontalArrangement = Arrangement.spacedBy(2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        options.forEachIndexed { index, label ->
            val on = index == selectedIndex
            Box(
                Modifier
                    .weight(1f)
                    .minimumInteractiveComponentSize()
                    .selectable(selected = on, role = Role.Tab, onClick = { onSelect(index) }),
                contentAlignment = Alignment.Center,
            ) {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .height(if (small) 28.dp else 32.dp)
                        .let { if (on) it.dtmShadow(shape).background(colors.surface, shape) else it },
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        label,
                        style = DtmTheme.typography.body.copy(
                            fontSize = if (small) 12.5.sp else 13.sp,
                            fontWeight = FontWeight.Medium,
                        ),
                        color = if (on) colors.ink else colors.ink2,
                        maxLines = 1,
                        modifier = Modifier.padding(horizontal = if (small) 9.dp else 10.dp),
                    )
                }
            }
        }
    }
}

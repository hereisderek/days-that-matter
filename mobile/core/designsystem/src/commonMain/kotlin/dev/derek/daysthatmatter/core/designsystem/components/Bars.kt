package dev.derek.daysthatmatter.core.designsystem.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import dev.derek.daysthatmatter.core.designsystem.icons.DtmIcons
import dev.derek.daysthatmatter.core.designsystem.theme.DtmSizes
import dev.derek.daysthatmatter.core.designsystem.theme.DtmTheme

/**
 * `.home-head`: a small [kicker] line (the date, or a sync note), the 32 sp screen [title] and round [actions]
 * on the right (search, account).
 */
@Composable
fun DtmTopBar(
    title: String,
    modifier: Modifier = Modifier,
    kicker: String? = null,
    actions: @Composable RowScope.() -> Unit = {},
) {
    val colors = DtmTheme.colors
    Row(
        modifier.fillMaxWidth().padding(start = 20.dp, end = 12.dp, top = 10.dp, bottom = 16.dp),
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Column(Modifier.weight(1f)) {
            if (kicker != null) Text(text = kicker, style = DtmTheme.typography.kicker, color = colors.ink3)
            Text(
                text = title,
                style = DtmTheme.typography.screenTitle,
                color = colors.ink,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(0.dp), verticalAlignment = Alignment.CenterVertically, content = actions)
    }
}

/**
 * `.search`: a 46 dp white field with a 16 dp radius, a search icon and a close button. [onClose] is shown as
 * an x on the right.
 */
@Composable
fun SearchField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    onClose: (() -> Unit)? = null,
) {
    val colors = DtmTheme.colors
    val shape = RoundedCornerShape(DtmTheme.radii.md)
    Row(
        modifier
            .fillMaxWidth()
            .height(DtmSizes.search)
            .dtmShadow(shape)
            .background(colors.surface, shape)
            .padding(start = 14.dp, end = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(DtmIcons.Search, contentDescription = null, tint = colors.ink3, modifier = Modifier.size(20.dp))
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            singleLine = true,
            textStyle = DtmTheme.typography.body.copy(color = colors.ink),
            cursorBrush = SolidColor(colors.accent),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            modifier = Modifier.weight(1f),
            decorationBox = { inner ->
                if (value.isEmpty()) {
                    Text(text = placeholder, style = DtmTheme.typography.body, color = colors.ink3)
                }
                inner()
            },
        )
        if (onClose != null) {
            Icon(
                DtmIcons.Close,
                contentDescription = "Close search",
                tint = colors.ink3,
                modifier = Modifier
                    .size(34.dp)
                    .clickable(role = Role.Button, onClick = onClose)
                    .padding(7.dp),
            )
        }
    }
}

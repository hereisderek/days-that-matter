package dev.derek.daysthatmatter.core.designsystem.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.derek.daysthatmatter.core.designsystem.icons.DtmIcons
import dev.derek.daysthatmatter.core.designsystem.theme.DtmTheme

/** Test tags of the date and time fields and their dialogs. */
object DtmDateTimeTestTags {
    const val DateField = "dtm-date-field"
    const val TimeField = "dtm-time-field"
    const val ClearTime = "dtm-time-clear"
    const val Confirm = "dtm-picker-confirm"
    const val Dismiss = "dtm-picker-dismiss"
}

/**
 * The `.input` of a date: shows [text] and opens the Material 3 date picker dialog
 * (docs/features/events/SPEC.md section 4.3). Dates are passed as UTC midnight in epoch milliseconds, as the
 * Material picker uses them. [yearRange] limits the years the picker offers.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DtmDateField(
    text: String,
    selectedDateMillis: Long?,
    onDateSelected: (Long) -> Unit,
    modifier: Modifier = Modifier,
    yearRange: IntRange = 1900..2100,
    label: String = "Date",
    confirmLabel: String = "OK",
    dismissLabel: String = "Cancel",
) {
    var open by remember { mutableStateOf(false) }
    PickerBox(text, placeholder = false, onClick = { open = true }, modifier.testTag(DtmDateTimeTestTags.DateField), label)
    if (open) {
        val state = rememberDatePickerState(initialSelectedDateMillis = selectedDateMillis, yearRange = yearRange)
        DatePickerDialog(
            onDismissRequest = { open = false },
            confirmButton = {
                TextButton(
                    onClick = {
                        state.selectedDateMillis?.let(onDateSelected)
                        open = false
                    },
                    modifier = Modifier.testTag(DtmDateTimeTestTags.Confirm),
                ) { Text(confirmLabel) }
            },
            dismissButton = {
                TextButton(onClick = { open = false }, modifier = Modifier.testTag(DtmDateTimeTestTags.Dismiss)) { Text(dismissLabel) }
            },
        ) {
            DatePicker(state)
        }
    }
}

/**
 * The optional `.input` of a time: shows [text], or [placeholder] when there is no time, and opens the Material 3
 * time picker in a dialog. [onClear] shows an x that removes the time.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DtmTimeField(
    text: String?,
    hour: Int,
    minute: Int,
    onTimeSelected: (hour: Int, minute: Int) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "Add time",
    onClear: (() -> Unit)? = null,
    is24Hour: Boolean = true,
    label: String = "Time",
    confirmLabel: String = "OK",
    dismissLabel: String = "Cancel",
) {
    var open by remember { mutableStateOf(false) }
    Box(modifier) {
        PickerBox(
            text ?: placeholder,
            placeholder = text == null,
            onClick = { open = true },
            Modifier.testTag(DtmDateTimeTestTags.TimeField),
            label,
        )
        if (text != null && onClear != null) {
            Icon(
                DtmIcons.Close,
                contentDescription = "Remove time",
                tint = DtmTheme.colors.ink3,
                modifier = Modifier
                    .align(Alignment.CenterEnd)
                    .testTag(DtmDateTimeTestTags.ClearTime)
                    .size(48.dp)
                    .clickable(role = Role.Button, onClick = onClear)
                    .padding(14.dp),
            )
        }
    }
    if (open) {
        val state = rememberTimePickerState(initialHour = hour, initialMinute = minute, is24Hour = is24Hour)
        AlertDialog(
            onDismissRequest = { open = false },
            confirmButton = {
                TextButton(
                    onClick = {
                        onTimeSelected(state.hour, state.minute)
                        open = false
                    },
                    modifier = Modifier.testTag(DtmDateTimeTestTags.Confirm),
                ) { Text(confirmLabel) }
            },
            dismissButton = {
                TextButton(onClick = { open = false }, modifier = Modifier.testTag(DtmDateTimeTestTags.Dismiss)) { Text(dismissLabel) }
            },
            text = { TimePicker(state) },
        )
    }
}

/** A tappable box drawn like `.input`. */
@Composable
private fun PickerBox(text: String, placeholder: Boolean, onClick: () -> Unit, modifier: Modifier, label: String) {
    val colors = DtmTheme.colors
    val shape = RoundedCornerShape(14.dp)
    Row(
        modifier
            .fillMaxWidth()
            .height(50.dp)
            .background(colors.surface, shape)
            .border(1.dp, colors.line2, shape)
            .clickable(role = Role.Button, onClick = onClick)
            .semantics { contentDescription = "$label, $text" }
            .padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text,
            style = DtmTheme.typography.body.copy(fontSize = 16.sp),
            color = if (placeholder) colors.ink3 else colors.ink,
            maxLines = 1,
        )
    }
}

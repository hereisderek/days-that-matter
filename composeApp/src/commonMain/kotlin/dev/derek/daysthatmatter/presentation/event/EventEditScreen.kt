package dev.derek.daysthatmatter.presentation.event

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import io.github.vinceglb.filekit.compose.rememberFilePickerLauncher
import io.github.vinceglb.filekit.core.PickerType
import kotlinx.coroutines.launch
import kotlinx.datetime.Clock
import kotlinx.datetime.Instant
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import kotlinx.datetime.toInstant
import kotlinx.datetime.LocalDateTime
import org.koin.compose.viewmodel.koinViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EventEditScreen(
    onEventSaved: () -> Unit,
    onNavigateBack: () -> Unit,
    eventId: String? = null
) {
    val viewModel = koinViewModel<EventEditViewModel>()
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    var title by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var dateMillis: Long by remember { mutableStateOf(Clock.System.now().toEpochMilliseconds()) }
    var showDatePicker by remember { mutableStateOf(false) }
    var showTimePicker by remember { mutableStateOf(false) }
    var includeTime by remember { mutableStateOf(false) }
    var backgroundMusicName by remember { mutableStateOf<String?>(null) }
    var backgroundMusicUrl by remember { mutableStateOf<String?>(null) }

    val scope = rememberCoroutineScope()

    val musicPickerLauncher = rememberFilePickerLauncher(type = PickerType.File(extensions = listOf("mp3", "wav", "m4a", "aac"))) { file ->
        if (file != null) {
            backgroundMusicName = file.name
            scope.launch {
                val bytes = file.readBytes()
                viewModel.uploadMusic(bytes, file.name) { url ->
                    backgroundMusicUrl = url
                }
            }
        }
    }

    LaunchedEffect(eventId) {
        if (eventId != null) {
            viewModel.loadEvent(eventId)
        }
    }

    LaunchedEffect(uiState) {
        when (val state = uiState) {
            is EventEditUiState.Success -> {
                onEventSaved()
                viewModel.resetState()
            }
            is EventEditUiState.Loaded -> {
                title = state.event.title
                notes = state.event.notes ?: ""
                dateMillis = state.event.date
                includeTime = state.event.includeTime
                backgroundMusicName = state.event.backgroundMusicName
                backgroundMusicUrl = state.event.backgroundMusicUrl
            }
            else -> {}
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (eventId == null) "New Event" else "Edit Event") },
                navigationIcon = {
                    TextButton(onClick = onNavigateBack) {
                        Text("Cancel")
                    }
                },
                actions = {
                    TextButton(
                        onClick = {
                            viewModel.saveEvent(
                                id = eventId,
                                title = title,
                                date = dateMillis,
                                notes = notes,
                                style = "Simple", // Default style for now
                                backgroundMusicUrl = backgroundMusicUrl,
                                backgroundMusicName = backgroundMusicName,
                                includeTime = includeTime
                            )
                        },
                        enabled = title.isNotBlank() && uiState !is EventEditUiState.Loading
                    ) {
                        if (uiState is EventEditUiState.Loading) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(24.dp),
                                color = MaterialTheme.colorScheme.primary
                            )
                        } else {
                            Text("Save")
                        }
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            OutlinedTextField(
                value = title,
                onValueChange = { title = it },
                label = { Text("Title") },
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedButton(
                onClick = { showDatePicker = true },
                modifier = Modifier.fillMaxWidth()
            ) {
                val date = Instant.fromEpochMilliseconds(dateMillis)
                    .toLocalDateTime(TimeZone.currentSystemDefault())
                val dateStr = "${date.date}" + if (includeTime) " ${date.hour}:${date.minute}" else ""
                Text("Date: $dateStr")
            }

            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Checkbox(
                    checked = includeTime,
                    onCheckedChange = {
                        includeTime = it
                        if (it) showTimePicker = true
                    }
                )
                Text("Include Time")
                if (includeTime) {
                    Spacer(modifier = Modifier.width(8.dp))
                    TextButton(onClick = { showTimePicker = true }) {
                        Text("Edit Time")
                    }
                }
            }

            OutlinedTextField(
                value = notes,
                onValueChange = { notes = it },
                label = { Text("Notes") },
                modifier = Modifier.fillMaxWidth(),
                minLines = 3
            )

            OutlinedButton(
                onClick = { musicPickerLauncher.launch() },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(if (backgroundMusicName != null) "Music: $backgroundMusicName" else "Select Background Music")
            }

            if (uiState is EventEditUiState.Error) {
                Text(
                    text = (uiState as EventEditUiState.Error).message,
                    color = MaterialTheme.colorScheme.error
                )
            }
        }
    }

    if (showDatePicker) {
        val datePickerState = rememberDatePickerState(initialSelectedDateMillis = dateMillis)
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(
                    onClick = {
                        datePickerState.selectedDateMillis?.let {
                            dateMillis = it
                        }
                        showDatePicker = false
                    }
                ) {
                    Text("OK")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDatePicker = false }) {
                    Text("Cancel")
                }
            }
        ) {
            DatePicker(state = datePickerState)
        }
    }

    if (showTimePicker) {
        val currentDateTime = Instant.fromEpochMilliseconds(dateMillis).toLocalDateTime(TimeZone.currentSystemDefault())
        val timePickerState = rememberTimePickerState(
            initialHour = currentDateTime.hour,
            initialMinute = currentDateTime.minute,
            is24Hour = true
        )

        AlertDialog(
            onDismissRequest = { showTimePicker = false },
            confirmButton = {
                TextButton(
                    onClick = {
                        val newDateTime = LocalDateTime(
                            currentDateTime.year, currentDateTime.month, currentDateTime.dayOfMonth,
                            timePickerState.hour, timePickerState.minute, 0, 0
                        )
                        dateMillis = newDateTime.toInstant(TimeZone.currentSystemDefault()).toEpochMilliseconds()
                        showTimePicker = false
                    }
                ) {
                    Text("OK")
                }
            },
            dismissButton = {
                TextButton(onClick = { showTimePicker = false }) {
                    Text("Cancel")
                }
            },
            text = {
                TimePicker(state = timePickerState)
            }
        )
    }
}

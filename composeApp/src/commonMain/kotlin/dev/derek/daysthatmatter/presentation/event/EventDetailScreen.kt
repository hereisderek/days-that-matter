package dev.derek.daysthatmatter.presentation.event

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.derek.daysthatmatter.presentation.main.MainViewModel
import kotlinx.datetime.Clock
import kotlinx.datetime.Instant
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import kotlinx.datetime.periodUntil
import org.koin.compose.viewmodel.koinViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EventDetailScreen(
    eventId: String,
    onNavigateBack: () -> Unit,
    onNavigateToEdit: (String) -> Unit
) {
    val viewModel = koinViewModel<EventDetailViewModel>()
    val mainViewModel = koinViewModel<MainViewModel>()
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val currentUser by mainViewModel.currentUser.collectAsStateWithLifecycle()

    LaunchedEffect(eventId) {
        viewModel.loadEvent(eventId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Event Details") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    if (uiState is EventDetailUiState.Success) {
                        val event = (uiState as EventDetailUiState.Success).event
                        val isOwner = currentUser?.id == event.ownerId

                        if (isOwner) {
                            IconButton(onClick = { onNavigateToEdit(eventId) }) {
                                Icon(Icons.Default.Edit, contentDescription = "Edit")
                            }
                            IconButton(onClick = {
                                viewModel.deleteEvent(eventId)
                                onNavigateBack()
                            }) {
                                Icon(Icons.Default.Delete, contentDescription = "Delete")
                            }
                        } else {
                            // Shared view actions
                            // TODO: Add "Import" button logic here if needed,
                            // but for now we just show details.
                            // If we want to support importing, we need an "Import" button
                            // that copies the event to the current user's list.
                        }
                    }
                }
            )
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues),
            contentAlignment = Alignment.Center
        ) {
            when (val state = uiState) {
                is EventDetailUiState.Loading -> {
                    CircularProgressIndicator()
                }
                is EventDetailUiState.Error -> {
                    Text(
                        text = state.message,
                        color = MaterialTheme.colorScheme.error
                    )
                }
                is EventDetailUiState.Success -> {
                    val event = state.event
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        Text(
                            text = event.title,
                            style = MaterialTheme.typography.headlineLarge
                        )

                        val date = Instant.fromEpochMilliseconds(event.date)
                            .toLocalDateTime(TimeZone.currentSystemDefault())

                        val dateStr = if (event.includeTime) {
                            "${date.date} ${date.hour}:${date.minute}"
                        } else {
                            "${date.date}"
                        }

                        Text(
                            text = "Date: $dateStr",
                            style = MaterialTheme.typography.titleLarge
                        )

                        val now = Clock.System.now()
                        val eventInstant = Instant.fromEpochMilliseconds(event.date)

                        val diffText = if (event.includeTime) {
                            val duration = eventInstant - now
                            val days = duration.inWholeDays
                            val hours = duration.inWholeHours % 24
                            val minutes = duration.inWholeMinutes % 60
                            if (days >= 0) {
                                "$days days, $hours hours, $minutes minutes left"
                            } else {
                                "${-days} days, ${-hours} hours, ${-minutes} minutes ago"
                            }
                        } else {
                            val today = now.toLocalDateTime(TimeZone.currentSystemDefault()).date
                            val eventDate = eventInstant.toLocalDateTime(TimeZone.currentSystemDefault()).date
                            val days = today.periodUntil(eventDate).days
                            if (days >= 0) {
                                "$days days left"
                            } else {
                                "${-days} days ago"
                            }
                        }

                        Text(
                            text = diffText,
                            style = MaterialTheme.typography.headlineMedium,
                            color = MaterialTheme.colorScheme.primary
                        )

                        if (!event.notes.isNullOrBlank()) {
                            Text(
                                text = "Notes:",
                                style = MaterialTheme.typography.titleMedium
                            )
                            Text(
                                text = event.notes,
                                style = MaterialTheme.typography.bodyLarge
                            )
                        }

                        if (event.backgroundMusicUrl != null) {
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                text = "Background Music:",
                                style = MaterialTheme.typography.titleMedium
                            )
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Text(
                                    text = event.backgroundMusicName ?: "Unknown Track",
                                    style = MaterialTheme.typography.bodyMedium,
                                    modifier = Modifier.weight(1f)
                                )
                                IconButton(onClick = { viewModel.playMusic(event.backgroundMusicUrl) }) {
                                    Icon(Icons.Default.PlayArrow, contentDescription = "Play")
                                }
                                IconButton(onClick = { viewModel.pauseMusic() }) {
                                    Icon(Icons.Default.Pause, contentDescription = "Pause")
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

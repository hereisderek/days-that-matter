package dev.derek.daysthatmatter.feature.settings.presentation.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.derek.daysthatmatter.core.designsystem.components.IconCircleButton
import dev.derek.daysthatmatter.core.designsystem.icons.DtmIcons
import dev.derek.daysthatmatter.core.designsystem.theme.DtmTheme
import dev.derek.daysthatmatter.feature.settings.presentation.common.SettingsTestTags
import org.koin.compose.viewmodel.koinViewModel

@Composable
fun SettingsRoute(
    onBack: () -> Unit,
    onSignIn: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: SettingsViewModel = koinViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    SettingsScreen(
        state = state,
        onIntent = viewModel::onIntent,
        onBack = onBack,
        onSignIn = onSignIn,
        modifier = modifier,
    )
}

@Composable
fun SettingsScreen(
    state: SettingsUiState,
    onIntent: (SettingsIntent) -> Unit,
    onBack: () -> Unit,
    onSignIn: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = DtmTheme.colors
    val insets = WindowInsets.safeDrawing
    val scroll = rememberScrollState()

    Box(modifier = modifier.fillMaxSize().background(colors.bg)) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .windowInsetsPadding(insets.only(WindowInsetsSides.Top + WindowInsetsSides.Horizontal))
                .verticalScroll(scroll)
                .padding(horizontal = 20.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // Header with Back button and Screen Title
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconCircleButton(
                    icon = DtmIcons.Back,
                    contentDescription = "Back",
                    onClick = onBack,
                    modifier = Modifier.testTag(SettingsTestTags.BackButton),
                )
            }

            Text(
                text = "Settings",
                style = DtmTheme.typography.screenTitle,
                color = colors.ink,
                modifier = Modifier.padding(bottom = 4.dp),
            )

            // Account / Profile Card
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(colors.surface)
                    .clickable { onIntent(SettingsIntent.OpenNameDialog) }
                    .padding(16.dp)
                    .testTag(SettingsTestTags.NameButton),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .background(colors.bg),
                    contentAlignment = Alignment.Center,
                ) {
                    Text("🌤️", fontSize = 24.sp)
                }
                Column(modifier = Modifier.weight(1f)) {
                    if (state.localName.isNotBlank()) {
                        Text(
                            text = state.localName,
                            style = DtmTheme.typography.heading,
                            color = colors.ink,
                        )
                    } else {
                        Text(
                            text = "Add your name",
                            style = DtmTheme.typography.heading,
                            color = colors.ink3,
                        )
                    }
                    Text(
                        text = "Local",
                        style = DtmTheme.typography.kicker,
                        color = colors.ink3,
                    )
                }
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(colors.bg)
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                ) {
                    Text(
                        text = "Free",
                        style = DtmTheme.typography.kicker,
                        color = colors.ink2,
                    )
                }
            }

            // Local mode info
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(colors.surface2)
                    .padding(14.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Text(
                    text = "Local mode. Everything about your own days works here, offline. Sharing, sync, history and invites need an account.",
                    style = DtmTheme.typography.body,
                    color = colors.ink2,
                )
            }

            // Sign in CTA
            Button(
                onClick = onSignIn,
                colors = ButtonDefaults.buttonColors(
                    containerColor = colors.accent,
                    contentColor = colors.onAccent,
                ),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp)
                    .testTag(SettingsTestTags.SignInButton),
            ) {
                Text(
                    text = "Sign in or create an account",
                    style = DtmTheme.typography.button,
                )
            }

            // Appearance Section
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = "Appearance",
                    style = DtmTheme.typography.kicker,
                    color = colors.ink3,
                )
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(colors.surface)
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Greeting on Home",
                            style = DtmTheme.typography.heading,
                            color = colors.ink,
                        )
                        Text(
                            text = state.greetingPreview,
                            style = DtmTheme.typography.kicker,
                            color = colors.ink3,
                        )
                    }
                    Switch(
                        checked = state.greetingEnabled,
                        onCheckedChange = { onIntent(SettingsIntent.SetGreetingEnabled(it)) },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = colors.onAccent,
                            checkedTrackColor = colors.accent,
                            uncheckedThumbColor = colors.ink3,
                            uncheckedTrackColor = colors.line,
                        ),
                        modifier = Modifier.testTag(SettingsTestTags.GreetingToggle),
                    )
                }
            }

            // Needs an account Section
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = "Needs an account",
                    style = DtmTheme.typography.kicker,
                    color = colors.ink3,
                )
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(colors.surface),
                ) {
                    LockedRow("Sync across devices", onSignIn)
                    HorizontalDivider(color = colors.line, thickness = 0.5.dp)
                    LockedRow("Sharing and invites", onSignIn)
                    HorizontalDivider(color = colors.line, thickness = 0.5.dp)
                    LockedRow("History and restore", onSignIn)
                    HorizontalDivider(color = colors.line, thickness = 0.5.dp)
                    LockedRow("Backup and download my data", onSignIn)
                }
            }

            Spacer(Modifier.height(32.dp))
        }

        if (state.showNameDialog) {
            NameDialog(
                nameDraft = state.nameDraft,
                onIntent = onIntent,
            )
        }
    }
}

@Composable
private fun LockedRow(label: String, onClick: () -> Unit) {
    val colors = DtmTheme.colors
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(text = label, style = DtmTheme.typography.heading, color = colors.ink)
            Text(text = "Needs an account", style = DtmTheme.typography.kicker, color = colors.ink3)
        }
        Text("🔒", fontSize = 16.sp)
    }
}

@Composable
private fun NameDialog(
    nameDraft: String,
    onIntent: (SettingsIntent) -> Unit,
) {
    val colors = DtmTheme.colors
    AlertDialog(
        onDismissRequest = { onIntent(SettingsIntent.DismissNameDialog) },
        title = {
            Text(
                "What should we call you?",
                style = DtmTheme.typography.heading,
                color = colors.ink,
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = nameDraft,
                    onValueChange = { onIntent(SettingsIntent.UpdateNameDraft(it)) },
                    placeholder = { Text("Add your name", color = colors.ink3) },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = colors.ink,
                        unfocusedTextColor = colors.ink,
                        focusedBorderColor = colors.accent,
                        unfocusedBorderColor = colors.line,
                        cursorColor = colors.accent,
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag(SettingsTestTags.NameInput),
                )
                Text(
                    "Used in greetings. Stays on this device.",
                    style = DtmTheme.typography.kicker,
                    color = colors.ink3,
                )
            }
        },
        confirmButton = {
            Button(
                onClick = { onIntent(SettingsIntent.SaveName(nameDraft)) },
                colors = ButtonDefaults.buttonColors(
                    containerColor = colors.accent,
                    contentColor = colors.onAccent,
                ),
                modifier = Modifier.testTag(SettingsTestTags.NameSave),
            ) {
                Text("Save")
            }
        },
        dismissButton = {
            TextButton(
                onClick = { onIntent(SettingsIntent.DismissNameDialog) },
                colors = ButtonDefaults.textButtonColors(contentColor = colors.ink2),
                modifier = Modifier.testTag(SettingsTestTags.NameCancel),
            ) {
                Text("Cancel")
            }
        },
        containerColor = colors.surface,
        modifier = Modifier.testTag(SettingsTestTags.NameDialog),
    )
}

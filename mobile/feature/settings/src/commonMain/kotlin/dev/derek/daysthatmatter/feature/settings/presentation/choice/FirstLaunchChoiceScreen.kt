package dev.derek.daysthatmatter.feature.settings.presentation.choice

import androidx.compose.foundation.background
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.derek.daysthatmatter.core.designsystem.icons.DtmIcons
import dev.derek.daysthatmatter.core.designsystem.theme.DtmTheme
import dev.derek.daysthatmatter.feature.settings.presentation.common.SettingsTestTags
import org.koin.compose.viewmodel.koinViewModel

@Composable
fun FirstLaunchChoiceRoute(
    onUseOnDevice: () -> Unit,
    onSignIn: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: FirstLaunchChoiceViewModel = koinViewModel(),
) {
    LaunchedEffect(viewModel) {
        viewModel.effect.collect { effect ->
            when (effect) {
                FirstLaunchChoiceEffect.NavigateHome -> onUseOnDevice()
                FirstLaunchChoiceEffect.NavigateSignIn -> onSignIn()
            }
        }
    }
    FirstLaunchChoiceScreen(
        onChooseThisDevice = { viewModel.onIntent(FirstLaunchChoiceIntent.ChooseThisDevice) },
        onChooseSignIn = { viewModel.onIntent(FirstLaunchChoiceIntent.ChooseSignIn) },
        modifier = modifier,
    )
}

/**
 * First-launch choice screen presenting two equal options:
 * "Use on this device" and "Sign in or create an account".
 *
 * Online features need an account; everything else works on this device.
 * Plan limits are never mentioned here (USER_COPY rule 7).
 */
@Composable
fun FirstLaunchChoiceScreen(
    onChooseThisDevice: () -> Unit,
    onChooseSignIn: () -> Unit,
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
                .padding(horizontal = 20.dp, vertical = 24.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    text = "Where should your days live?",
                    style = DtmTheme.typography.screenTitle,
                    color = colors.ink,
                )
                Text(
                    text = "You can change this later in Settings.",
                    style = DtmTheme.typography.kicker,
                    color = colors.ink3,
                )
            }

            // Choice 1: Use on this device
            ChoiceCard(
                icon = "🔒",
                title = "Use on this device",
                subtitle = "No account. Nothing leaves your phone.",
                benefits = listOf(
                    "All your own days, looks, widgets and reminders",
                    "Works offline, no sign-in",
                ),
                note = "Sharing, sync, history and invites need an account. Everything else works on this device.",
                buttonText = "Use on this device",
                buttonTestTag = SettingsTestTags.ChoiceUseOnDevice,
                onClick = onChooseThisDevice,
            )

            // Choice 2: Sign in or create an account
            ChoiceCard(
                icon = "☁️",
                title = "Sign in or create an account",
                subtitle = "Free to start. No password.",
                benefits = listOf(
                    "Share days with people you choose",
                    "Sync across all your devices",
                    "History, restore and backup",
                ),
                note = null,
                buttonText = "Sign in or create an account",
                buttonTestTag = SettingsTestTags.ChoiceSignIn,
                onClick = onChooseSignIn,
            )

            Text(
                text = "Creating an account means agreeing to the Terms of Service and Privacy Policy.",
                style = DtmTheme.typography.tick,
                color = colors.ink3,
                modifier = Modifier.padding(top = 8.dp, bottom = 16.dp),
            )

            Spacer(Modifier.height(16.dp))
        }
    }
}

@Composable
private fun ChoiceCard(
    icon: String,
    title: String,
    subtitle: String,
    benefits: List<String>,
    note: String?,
    buttonText: String,
    buttonTestTag: String,
    onClick: () -> Unit,
) {
    val colors = DtmTheme.colors
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(colors.surface)
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(icon, fontSize = 24.sp)
            Column {
                Text(
                    text = title,
                    style = DtmTheme.typography.heading,
                    color = colors.ink,
                )
                Text(
                    text = subtitle,
                    style = DtmTheme.typography.kicker,
                    color = colors.ink3,
                )
            }
        }

        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            benefits.forEach { benefit ->
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Icon(
                        imageVector = DtmIcons.Check,
                        contentDescription = null,
                        tint = colors.accent,
                        modifier = Modifier.size(16.dp),
                    )
                    Text(
                        text = benefit,
                        style = DtmTheme.typography.body,
                        color = colors.ink2,
                    )
                }
            }
        }

        if (note != null) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(colors.bg)
                    .padding(12.dp),
            ) {
                Text(
                    text = note,
                    style = DtmTheme.typography.body,
                    color = colors.ink2,
                )
            }
        }

        Button(
            onClick = onClick,
            colors = ButtonDefaults.buttonColors(
                containerColor = colors.accent,
                contentColor = colors.onAccent,
            ),
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp)
                .testTag(buttonTestTag),
        ) {
            Text(
                text = buttonText,
                style = DtmTheme.typography.button,
            )
        }
    }
}

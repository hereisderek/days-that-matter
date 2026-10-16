@file:OptIn(ExperimentalTestApi::class)

package dev.derek.daysthatmatter.feature.settings.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.v2.runComposeUiTest
import androidx.compose.ui.unit.dp
import dev.derek.daysthatmatter.core.designsystem.theme.DaysThatMatterTheme
import dev.derek.daysthatmatter.feature.settings.presentation.choice.FirstLaunchChoiceScreen
import dev.derek.daysthatmatter.feature.settings.presentation.common.SettingsTestTags
import kotlin.test.Test
import kotlin.test.assertTrue

class FirstLaunchChoiceScreenTest {

    private fun render(
        onChooseThisDevice: () -> Unit = {},
        onChooseSignIn: () -> Unit = {},
    ) = @androidx.compose.runtime.Composable {
        DaysThatMatterTheme(darkTheme = false) {
            Box(Modifier.size(width = 400.dp, height = 900.dp)) {
                FirstLaunchChoiceScreen(
                    onChooseThisDevice = onChooseThisDevice,
                    onChooseSignIn = onChooseSignIn,
                )
            }
        }
    }

    @Test
    fun displaysTwoEqualChoicesWithClearCopyAndNoPlanLimits() = runComposeUiTest {
        setContent(render())

        // Header
        onNodeWithText("Where should your days live?").assertExists()
        onNodeWithText("You can change this later in Settings.").assertExists()

        // Choice 1
        onNodeWithText("No account. Nothing leaves your phone.").assertExists()
        onNodeWithText("All your own days, looks, widgets and reminders").assertExists()
        onNodeWithText("Works offline, no sign-in").assertExists()
        onNodeWithText("Sharing, sync, history and invites need an account. Everything else works on this device.").assertExists()
        onNodeWithTag(SettingsTestTags.ChoiceUseOnDevice).assertExists()

        // Choice 2
        onNodeWithText("Free to start. No password.").assertExists()
        onNodeWithText("Share days with people you choose").assertExists()
        onNodeWithText("Sync across all your devices").assertExists()
        onNodeWithText("History, restore and backup").assertExists()
        onNodeWithTag(SettingsTestTags.ChoiceSignIn).assertExists()

        // Verify plan limits are not mentioned
        onNodeWithText("20 events").assertDoesNotExist()
        onNodeWithText("plan limit").assertDoesNotExist()
        onNodeWithText("Free plan").assertDoesNotExist()
    }

    @Test
    fun clickingUseOnDeviceTriggersCallback() = runComposeUiTest {
        var clicked = false
        setContent(render(onChooseThisDevice = { clicked = true }))

        onNodeWithTag(SettingsTestTags.ChoiceUseOnDevice).performClick()
        assertTrue(clicked)
    }

    @Test
    fun clickingSignInTriggersCallback() = runComposeUiTest {
        var clicked = false
        setContent(render(onChooseSignIn = { clicked = true }))

        onNodeWithTag(SettingsTestTags.ChoiceSignIn).performClick()
        assertTrue(clicked)
    }
}

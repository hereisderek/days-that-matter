@file:OptIn(ExperimentalTestApi::class)

package dev.derek.daysthatmatter.feature.settings.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertIsOff
import androidx.compose.ui.test.assertIsOn
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.v2.runComposeUiTest
import androidx.compose.ui.unit.dp
import dev.derek.daysthatmatter.core.designsystem.theme.DaysThatMatterTheme
import dev.derek.daysthatmatter.feature.settings.presentation.common.SettingsTestTags
import dev.derek.daysthatmatter.feature.settings.presentation.settings.SettingsIntent
import dev.derek.daysthatmatter.feature.settings.presentation.settings.SettingsScreen
import dev.derek.daysthatmatter.feature.settings.presentation.settings.SettingsUiState
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class SettingsScreenTest {

    private fun render(
        state: SettingsUiState,
        intents: MutableList<SettingsIntent>,
        onBack: () -> Unit = {},
        onSignIn: () -> Unit = {},
    ) = @androidx.compose.runtime.Composable {
        DaysThatMatterTheme(darkTheme = false) {
            Box(Modifier.size(width = 400.dp, height = 800.dp)) {
                SettingsScreen(
                    state = state,
                    onIntent = { intents += it },
                    onBack = onBack,
                    onSignIn = onSignIn,
                )
            }
        }
    }

    @Test
    fun showsAddYourNameWhenLocalNameIsEmpty() = runComposeUiTest {
        val intents = mutableListOf<SettingsIntent>()
        setContent(render(SettingsUiState(localName = ""), intents))

        onNodeWithText("Settings").assertExists()
        onNodeWithText("Add your name").assertExists()
        onNodeWithText("Local").assertExists()
        onNodeWithText("Free").assertExists()
    }

    @Test
    fun showsLocalNameWhenSet() = runComposeUiTest {
        val intents = mutableListOf<SettingsIntent>()
        setContent(render(SettingsUiState(localName = "Sam"), intents))

        onNodeWithText("Sam").assertExists()
    }

    @Test
    fun tappingNameButtonOpensDialog() = runComposeUiTest {
        val intents = mutableListOf<SettingsIntent>()
        setContent(render(SettingsUiState(localName = ""), intents))

        onNodeWithTag(SettingsTestTags.NameButton).performClick()
        assertEquals(listOf<SettingsIntent>(SettingsIntent.OpenNameDialog), intents)
    }

    @Test
    fun dialogShowsTitleInputAndHint() = runComposeUiTest {
        val intents = mutableListOf<SettingsIntent>()
        setContent(
            render(
                SettingsUiState(
                    localName = "Sam",
                    showNameDialog = true,
                    nameDraft = "Sam",
                ),
                intents,
            )
        )

        onNodeWithText("What should we call you?").assertExists()
        onNodeWithText("Used in greetings. Stays on this device.").assertExists()
        onNodeWithTag(SettingsTestTags.NameInput).assertExists()
        onNodeWithTag(SettingsTestTags.NameSave).assertExists()
        onNodeWithTag(SettingsTestTags.NameCancel).assertExists()
    }

    @Test
    fun dialogSaveTriggersSaveNameIntent() = runComposeUiTest {
        val intents = mutableListOf<SettingsIntent>()
        setContent(
            render(
                SettingsUiState(
                    localName = "",
                    showNameDialog = true,
                    nameDraft = "Alex",
                ),
                intents,
            )
        )

        onNodeWithTag(SettingsTestTags.NameSave).performClick()
        assertEquals(listOf<SettingsIntent>(SettingsIntent.SaveName("Alex")), intents)
    }

    @Test
    fun dialogCancelTriggersDismissIntent() = runComposeUiTest {
        val intents = mutableListOf<SettingsIntent>()
        setContent(
            render(
                SettingsUiState(
                    showNameDialog = true,
                    nameDraft = "Alex",
                ),
                intents,
            )
        )

        onNodeWithTag(SettingsTestTags.NameCancel).performClick()
        assertEquals(listOf<SettingsIntent>(SettingsIntent.DismissNameDialog), intents)
    }

    @Test
    fun greetingToggleReflectsStateAndEmitsIntent() = runComposeUiTest {
        val intents = mutableListOf<SettingsIntent>()
        setContent(render(SettingsUiState(greetingEnabled = true), intents))

        onNodeWithTag(SettingsTestTags.GreetingToggle).assertIsOn().performClick()
        assertEquals(listOf<SettingsIntent>(SettingsIntent.SetGreetingEnabled(false)), intents)
    }

    @Test
    fun greetingToggleOffState() = runComposeUiTest {
        val intents = mutableListOf<SettingsIntent>()
        setContent(render(SettingsUiState(greetingEnabled = false), intents))

        onNodeWithTag(SettingsTestTags.GreetingToggle).assertIsOff().performClick()
        assertEquals(listOf<SettingsIntent>(SettingsIntent.SetGreetingEnabled(true)), intents)
    }

    @Test
    fun signInButtonClicked() = runComposeUiTest {
        var signedIn = false
        setContent(render(SettingsUiState(), mutableListOf(), onSignIn = { signedIn = true }))

        onNodeWithTag(SettingsTestTags.SignInButton).performClick()
        assertTrue(signedIn)
    }

    @Test
    fun backButtonClicked() = runComposeUiTest {
        var backClicked = false
        setContent(render(SettingsUiState(), mutableListOf(), onBack = { backClicked = true }))

        onNodeWithTag(SettingsTestTags.BackButton).performClick()
        assertTrue(backClicked)
    }
}

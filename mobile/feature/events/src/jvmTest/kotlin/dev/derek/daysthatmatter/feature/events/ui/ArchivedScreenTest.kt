@file:OptIn(ExperimentalTestApi::class)

package dev.derek.daysthatmatter.feature.events.ui

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.longClick
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.v2.runComposeUiTest
import dev.derek.daysthatmatter.core.designsystem.theme.DaysThatMatterTheme
import dev.derek.daysthatmatter.feature.events.presentation.archived.ArchivedIntent
import dev.derek.daysthatmatter.feature.events.presentation.archived.ArchivedItem
import dev.derek.daysthatmatter.feature.events.presentation.archived.ArchivedScreen
import dev.derek.daysthatmatter.feature.events.presentation.archived.ArchivedUiState
import dev.derek.daysthatmatter.feature.events.presentation.common.EventsTestTags
import kotlin.test.Test
import kotlin.test.assertEquals

class ArchivedScreenTest {

    private val state = ArchivedUiState(
        loading = false,
        items = listOf(ArchivedItem("test", card("Driving test"), isOwner = true), ArchivedItem("g", card("Grandma"), isOwner = false)),
    )

    private fun longPressThenPick(id: String, pick: String): List<ArchivedIntent> {
        val intents = mutableListOf<ArchivedIntent>()
        runComposeUiTest {
            setContent { DaysThatMatterTheme(darkTheme = false) { ArchivedScreen(state, onIntent = { intents += it }) } }
            onNodeWithTag(EventsTestTags.card(id)).performTouchInput { longClick() }
            onNodeWithText(pick).performClick()
        }
        return intents
    }

    @Test
    fun daysOpenAndBackCloses() = runComposeUiTest {
        val intents = mutableListOf<ArchivedIntent>()
        setContent { DaysThatMatterTheme(darkTheme = false) { ArchivedScreen(state, onIntent = { intents += it }) } }

        onNodeWithText("Archived").assertExists()
        onNodeWithTag(EventsTestTags.card("test")).performClick()
        onNodeWithContentDescription("Back").performClick()
        assertEquals(listOf(ArchivedIntent.Open("test"), ArchivedIntent.Back), intents)
    }

    @Test
    fun menuOffersUnarchiveAndDeleteOrLeave() {
        assertEquals(listOf<ArchivedIntent>(ArchivedIntent.Unarchive("test")), longPressThenPick("test", "Unarchive"))
        assertEquals(listOf<ArchivedIntent>(ArchivedIntent.Delete("test")), longPressThenPick("test", "Delete"))
        assertEquals(listOf<ArchivedIntent>(ArchivedIntent.Delete("g")), longPressThenPick("g", "Leave"))
    }

    @Test
    fun nothingArchived() = runComposeUiTest {
        setContent { DaysThatMatterTheme(darkTheme = false) { ArchivedScreen(ArchivedUiState(loading = false), onIntent = {}) } }

        onNodeWithText("Nothing archived").assertExists()
    }
}

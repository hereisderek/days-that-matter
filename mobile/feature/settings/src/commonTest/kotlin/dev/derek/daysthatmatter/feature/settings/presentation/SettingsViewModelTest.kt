package dev.derek.daysthatmatter.feature.settings.presentation

import app.cash.turbine.test
import dev.derek.daysthatmatter.feature.settings.data.FakeSettingsRepository
import dev.derek.daysthatmatter.feature.settings.domain.UserSettings
import dev.derek.daysthatmatter.feature.settings.presentation.settings.SettingsIntent
import dev.derek.daysthatmatter.feature.settings.presentation.settings.SettingsViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class SettingsViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private lateinit var repository: FakeSettingsRepository

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        repository = FakeSettingsRepository()
    }

    @AfterTest
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun initialStateReflectsRepositoryDefaults() = runTest(testDispatcher) {
        val vm = SettingsViewModel(repository)
        vm.state.test {
            val state = awaitItem()
            assertEquals("", state.localName)
            assertTrue(state.greetingEnabled)
            assertFalse(state.showNameDialog)
            assertEquals("", state.nameDraft)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun openNameDialogPrefillsCurrentName() = runTest(testDispatcher) {
        repository.setLocalName("Sam")
        val vm = SettingsViewModel(repository)
        vm.state.test {
            awaitItem() // initial
            vm.onIntent(SettingsIntent.OpenNameDialog)
            val dialogState = awaitItem()
            assertTrue(dialogState.showNameDialog)
            assertEquals("Sam", dialogState.nameDraft)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun updateNameDraftCapsAt40Chars() = runTest(testDispatcher) {
        val vm = SettingsViewModel(repository)
        vm.state.test {
            awaitItem()
            vm.onIntent(SettingsIntent.OpenNameDialog)
            awaitItem()
            val longName = "A".repeat(50)
            vm.onIntent(SettingsIntent.UpdateNameDraft(longName))
            val updated = awaitItem()
            assertEquals(40, updated.nameDraft.length)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun dismissNameDialogClearsState() = runTest(testDispatcher) {
        val vm = SettingsViewModel(repository)
        vm.state.test {
            awaitItem()
            vm.onIntent(SettingsIntent.OpenNameDialog)
            awaitItem()
            vm.onIntent(SettingsIntent.DismissNameDialog)
            val dismissed = awaitItem()
            assertFalse(dismissed.showNameDialog)
            assertEquals("", dismissed.nameDraft)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun saveNamePersistsTrimmedNameToRepository() = runTest(testDispatcher) {
        val vm = SettingsViewModel(repository)
        vm.state.test {
            awaitItem()
            vm.onIntent(SettingsIntent.SaveName("   Jordan   "))
            val saved = awaitItem()
            assertEquals("Jordan", saved.localName)
            assertFalse(saved.showNameDialog)
            assertEquals("Jordan", repository.getSettings().localName)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun toggleGreetingUpdatesRepository() = runTest(testDispatcher) {
        val vm = SettingsViewModel(repository)
        vm.state.test {
            val initial = awaitItem()
            assertTrue(initial.greetingEnabled)
            vm.onIntent(SettingsIntent.SetGreetingEnabled(false))
            val toggled = awaitItem()
            assertFalse(toggled.greetingEnabled)
            assertFalse(repository.getSettings().greetingEnabled)
            cancelAndIgnoreRemainingEvents()
        }
    }
}

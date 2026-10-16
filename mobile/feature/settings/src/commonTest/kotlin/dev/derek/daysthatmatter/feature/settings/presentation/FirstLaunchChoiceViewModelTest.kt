package dev.derek.daysthatmatter.feature.settings.presentation

import app.cash.turbine.test
import dev.derek.daysthatmatter.feature.settings.data.FakeSettingsRepository
import dev.derek.daysthatmatter.feature.settings.presentation.choice.FirstLaunchChoiceEffect
import dev.derek.daysthatmatter.feature.settings.presentation.choice.FirstLaunchChoiceIntent
import dev.derek.daysthatmatter.feature.settings.presentation.choice.FirstLaunchChoiceViewModel
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
class FirstLaunchChoiceViewModelTest {

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
    fun chooseThisDeviceCompletesOnboardingAndNavigatesHome() = runTest(testDispatcher) {
        val vm = FirstLaunchChoiceViewModel(repository)
        assertFalse(repository.getSettings().onboardingCompleted)

        vm.effect.test {
            vm.onIntent(FirstLaunchChoiceIntent.ChooseThisDevice)
            assertEquals(FirstLaunchChoiceEffect.NavigateHome, awaitItem())
            assertTrue(repository.getSettings().onboardingCompleted)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun chooseSignInNavigatesToSignInFlowWithoutCompletingOnboarding() = runTest(testDispatcher) {
        val vm = FirstLaunchChoiceViewModel(repository)
        assertFalse(repository.getSettings().onboardingCompleted)

        vm.effect.test {
            vm.onIntent(FirstLaunchChoiceIntent.ChooseSignIn)
            assertEquals(FirstLaunchChoiceEffect.NavigateSignIn, awaitItem())
            assertFalse(repository.getSettings().onboardingCompleted)
            cancelAndIgnoreRemainingEvents()
        }
    }
}

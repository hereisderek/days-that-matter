package dev.derek.daysthatmatter.presentation.main

import dev.derek.daysthatmatter.data.repository.FakeAuthRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

@OptIn(ExperimentalCoroutinesApi::class)
class MainViewModelTest {
    private lateinit var repository: FakeAuthRepository
    private lateinit var viewModel: MainViewModel

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(StandardTestDispatcher())
        repository = FakeAuthRepository()
        viewModel = MainViewModel(repository)
    }

    @AfterTest
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `currentUser updates when repository updates`() = runTest {
        // Start collecting to trigger stateIn
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) {
            viewModel.currentUser.collect {}
        }

        // Initial state should be null (as per FakeAuthRepository default)
        assertNull(viewModel.currentUser.value)

        // Simulate sign in
        repository.signInAnonymously()
        advanceUntilIdle()

        assertNotNull(viewModel.currentUser.value)
        assertEquals("anon_id", viewModel.currentUser.value?.id)

        // Simulate sign out
        repository.signOut()
        advanceUntilIdle()

        assertNull(viewModel.currentUser.value)
    }
}


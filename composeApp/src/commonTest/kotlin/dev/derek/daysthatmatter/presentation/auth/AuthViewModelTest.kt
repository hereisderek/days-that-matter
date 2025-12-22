package dev.derek.daysthatmatter.presentation.auth

import dev.derek.daysthatmatter.data.repository.FakeAuthRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class AuthViewModelTest {
    private lateinit var repository: FakeAuthRepository
    private lateinit var viewModel: AuthViewModel

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(StandardTestDispatcher())
        repository = FakeAuthRepository()
        viewModel = AuthViewModel(repository)
    }

    @AfterTest
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `signIn success`() = runTest {
        viewModel.signIn("test@example.com", "password")
        advanceUntilIdle()
        assertTrue(viewModel.uiState.value is AuthUiState.Success)
    }

    @Test
    fun `signIn failure`() = runTest {
        viewModel.signIn("wrong@example.com", "password")
        advanceUntilIdle()
        assertTrue(viewModel.uiState.value is AuthUiState.Error)
    }

    @Test
    fun `signUp success`() = runTest {
        viewModel.signUp("new@example.com", "password")
        advanceUntilIdle()
        assertTrue(viewModel.uiState.value is AuthUiState.Success)
    }
}


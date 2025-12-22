package dev.derek.daysthatmatter.presentation.home

import dev.derek.daysthatmatter.data.repository.FakeEventRepository
import dev.derek.daysthatmatter.domain.model.Event
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals

@OptIn(ExperimentalCoroutinesApi::class)
class HomeViewModelTest {
    private lateinit var repository: FakeEventRepository
    private lateinit var viewModel: HomeViewModel

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(StandardTestDispatcher())
        repository = FakeEventRepository()
        viewModel = HomeViewModel(repository)
    }

    @AfterTest
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `events are loaded from repository`() = runTest {
        val event = Event(id = "1", title = "Test Event")
        repository.saveEvent(event)

        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) {
            viewModel.events.collect {}
        }

        advanceUntilIdle()

        assertEquals(listOf(event), viewModel.events.value)
    }
}


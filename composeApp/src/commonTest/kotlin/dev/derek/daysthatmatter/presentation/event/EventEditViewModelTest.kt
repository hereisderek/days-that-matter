package dev.derek.daysthatmatter.presentation.event

import dev.derek.daysthatmatter.data.repository.FakeEventRepository
import dev.derek.daysthatmatter.data.repository.FakeStorageRepository
import dev.derek.daysthatmatter.domain.model.Event
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
import kotlin.test.assertEquals
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class EventEditViewModelTest {
    private lateinit var repository: FakeEventRepository
    private lateinit var storageRepository: FakeStorageRepository
    private lateinit var viewModel: EventEditViewModel

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(StandardTestDispatcher())
        repository = FakeEventRepository()
        storageRepository = FakeStorageRepository()
        viewModel = EventEditViewModel(repository, storageRepository)
    }

    @AfterTest
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `loadEvent loads event successfully`() = runTest {
        val event = Event(id = "1", title = "Test Event")
        repository.saveEvent(event)

        viewModel.loadEvent("1")
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state is EventEditUiState.Loaded)
        assertEquals(event, state.event)
    }

    @Test
    fun `saveEvent saves event successfully`() = runTest {
        viewModel.saveEvent(
            id = "1",
            title = "New Event",
            date = 123456789L,
            notes = "Notes",
            style = "Simple"
        )
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state is EventEditUiState.Success)

        val savedEvent = repository.getEvent("1")
        assertEquals("New Event", savedEvent?.title)
    }

    @Test
    fun `uploadMusic uploads file successfully`() = runTest {
        var uploadedUrl: String? = null
        viewModel.uploadMusic(byteArrayOf(1, 2, 3), "test.mp3") { url ->
            uploadedUrl = url
        }
        advanceUntilIdle()

        assertTrue(uploadedUrl?.contains("test.mp3") == true)
    }
}


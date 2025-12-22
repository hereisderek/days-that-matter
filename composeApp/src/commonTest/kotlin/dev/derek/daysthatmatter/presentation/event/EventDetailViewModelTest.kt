package dev.derek.daysthatmatter.presentation.event

import dev.derek.daysthatmatter.data.repository.FakeEventRepository
import dev.derek.daysthatmatter.domain.model.Event
import dev.derek.daysthatmatter.domain.service.FakeAudioPlayer
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
import kotlin.test.assertNull
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class EventDetailViewModelTest {
    private lateinit var repository: FakeEventRepository
    private lateinit var audioPlayer: FakeAudioPlayer
    private lateinit var viewModel: EventDetailViewModel

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(StandardTestDispatcher())
        repository = FakeEventRepository()
        audioPlayer = FakeAudioPlayer()
        viewModel = EventDetailViewModel(repository, audioPlayer)
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
        assertTrue(state is EventDetailUiState.Success)
        assertEquals(event, state.event)
    }

    @Test
    fun `deleteEvent deletes event successfully`() = runTest {
        val event = Event(id = "1", title = "Test Event")
        repository.saveEvent(event)

        viewModel.deleteEvent("1")
        advanceUntilIdle()

        val deletedEvent = repository.getEvent("1")
        assertNull(deletedEvent)
    }

    @Test
    fun `playMusic plays audio`() {
        viewModel.playMusic("http://test.url")
        assertTrue(audioPlayer.isPlaying)
        assertEquals("http://test.url", audioPlayer.currentUrl)
    }

    @Test
    fun `pauseMusic pauses audio`() {
        viewModel.playMusic("http://test.url")
        viewModel.pauseMusic()
        assertTrue(!audioPlayer.isPlaying)
    }
}


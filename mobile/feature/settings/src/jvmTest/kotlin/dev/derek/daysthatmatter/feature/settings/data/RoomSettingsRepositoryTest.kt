package dev.derek.daysthatmatter.feature.settings.data

import androidx.room.Room
import app.cash.turbine.test
import dev.derek.daysthatmatter.core.database.AppDatabase
import dev.derek.daysthatmatter.core.database.buildAppDatabase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.test.runTest
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class RoomSettingsRepositoryTest {

    private lateinit var database: AppDatabase
    private lateinit var repository: RoomSettingsRepository

    @BeforeTest
    fun setUp() {
        database = Room.inMemoryDatabaseBuilder<AppDatabase>().buildAppDatabase(Dispatchers.IO)
        repository = RoomSettingsRepository(database.appMetaDao())
    }

    @AfterTest
    fun tearDown() {
        database.close()
    }

    @Test
    fun defaultsWhenEmpty() = runTest {
        val initial = repository.getSettings()
        assertEquals("", initial.localName)
        assertTrue(initial.greetingEnabled)
        assertFalse(initial.onboardingCompleted)
    }

    @Test
    fun setLocalNameTrimsAndPersists() = runTest {
        repository.setLocalName("  Sam  ")
        val updated = repository.getSettings()
        assertEquals("Sam", updated.localName)
    }

    @Test
    fun setGreetingEnabledPersists() = runTest {
        repository.setGreetingEnabled(false)
        val updated = repository.getSettings()
        assertFalse(updated.greetingEnabled)

        repository.setGreetingEnabled(true)
        assertTrue(repository.getSettings().greetingEnabled)
    }

    @Test
    fun setOnboardingCompletedPersists() = runTest {
        repository.setOnboardingCompleted(true)
        assertTrue(repository.getSettings().onboardingCompleted)
    }

    @Test
    fun settingsFlowEmitsUpdates() = runTest {
        repository.settings.test {
            val initial = awaitItem()
            assertEquals("", initial.localName)
            assertTrue(initial.greetingEnabled)
            assertFalse(initial.onboardingCompleted)

            repository.setLocalName("Alex")
            val withName = awaitItem()
            assertEquals("Alex", withName.localName)

            repository.setGreetingEnabled(false)
            val withoutGreeting = awaitItem()
            assertFalse(withoutGreeting.greetingEnabled)

            cancelAndIgnoreRemainingEvents()
        }
    }
}

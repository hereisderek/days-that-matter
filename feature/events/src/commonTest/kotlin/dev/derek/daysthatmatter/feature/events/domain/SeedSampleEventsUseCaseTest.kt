package dev.derek.daysthatmatter.feature.events.domain

import dev.derek.daysthatmatter.core.model.event.Role
import dev.derek.daysthatmatter.feature.events.FakeClock
import dev.derek.daysthatmatter.feature.events.FakeEventRepository
import dev.derek.daysthatmatter.feature.events.UTC
import dev.derek.daysthatmatter.feature.events.debug.SeedSampleEventsUseCase
import dev.derek.daysthatmatter.feature.events.event
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class SeedSampleEventsUseCaseTest {

    @Test
    fun seedsTheGallerySamplesIntoAnEmptyDatabase() = runTest {
        val repository = FakeEventRepository()

        assertTrue(SeedSampleEventsUseCase(repository, FakeClock(), UTC)())

        val home = repository.observeHome().first()
        assertEquals(9, home.size)
        assertEquals(listOf("sample-norway", "sample-together", "sample-mia"), home.take(3).map { it.id })
        assertEquals(listOf("sample-driving-test"), repository.observeArchived().first().map { it.id })
        val shared = home.single { it.id == "sample-grandma" }
        assertEquals(Role.Editor, shared.role)
        assertNull(shared.doc.pinnedAt)
    }

    @Test
    fun leavesAnExistingDatabaseAlone() = runTest {
        val repository = FakeEventRepository(event("mine"))

        assertFalse(SeedSampleEventsUseCase(repository, FakeClock(), UTC)())
        assertEquals(listOf("mine"), repository.observeHome().first().map { it.id })
    }
}

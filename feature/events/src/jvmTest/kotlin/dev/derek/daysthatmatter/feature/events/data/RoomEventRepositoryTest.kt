package dev.derek.daysthatmatter.feature.events.data

import androidx.room.Room
import dev.derek.daysthatmatter.core.database.AppDatabase
import dev.derek.daysthatmatter.core.database.buildAppDatabase
import dev.derek.daysthatmatter.core.database.event.EventRowMeta
import dev.derek.daysthatmatter.core.database.event.toEntity
import dev.derek.daysthatmatter.core.model.event.UnitMode
import dev.derek.daysthatmatter.feature.events.FakeClock
import dev.derek.daysthatmatter.feature.events.NOW
import dev.derek.daysthatmatter.feature.events.event
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import kotlinx.datetime.LocalDate
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.time.Duration.Companion.hours
import kotlin.time.Duration.Companion.minutes

class RoomEventRepositoryTest {

    private val database = Room.inMemoryDatabaseBuilder<AppDatabase>().buildAppDatabase(Dispatchers.IO)
    private val clock = FakeClock()
    private val repository = RoomEventRepository(database.eventDao(), clock)

    @AfterTest
    fun close() {
        database.close()
    }

    @Test
    fun addedDaysShowOnHomeInDatabaseOrder() = runTest {
        assertTrue(repository.isEmpty())
        repository.add(
            listOf(
                event("b", title = "Mia's birthday", date = LocalDate(2026, 11, 6), category = "birthdays"),
                event("a", title = "Norway trip", date = LocalDate(2026, 11, 21), pinnedAt = NOW),
                event("x", title = "Old", archivedAt = NOW),
            ),
            createdAt = NOW - 1.hours,
        )

        assertFalse(repository.isEmpty())
        assertEquals(listOf("a", "b"), repository.observeHome().first().map { it.id })
        assertEquals(listOf("b"), repository.observeHome("mia", "birthdays").first().map { it.id })
        assertEquals(listOf("a"), repository.observeHome(" TRIP ").first().map { it.id })
        assertEquals(listOf("x"), repository.observeArchived().first().map { it.id })
        assertEquals(1, repository.observeArchivedCount().first())
        assertEquals(NOW - 1.hours, repository.get("b")?.createdAt)
    }

    @Test
    fun editWritesTheChangeAndTheTime() = runTest {
        repository.add(listOf(event("a")), createdAt = NOW)
        clock.now = NOW + 5.minutes

        assertTrue(repository.edit("a") { it.copy(unitMode = UnitMode.Weeks) })

        val row = database.eventDao().getById("a")!!
        assertEquals("weeks", row.unitMode)
        assertEquals((NOW + 5.minutes).toEpochMilliseconds(), row.updatedAtEpochMillis)
        assertNull(row.pendingPatch, "a day never synced is sent whole, so it keeps no patch")
        assertEquals(UnitMode.Weeks, repository.observeEvent("a").first()?.doc?.unitMode)
    }

    @Test
    fun editOfASyncedDayAddsToThePendingPatch() = runTest {
        database.eventDao().upsert(event("s").toEntity(EventRowMeta(createdAt = NOW, updatedAt = NOW, serverRev = 4)))

        repository.edit("s") { it.copy(archivedAt = NOW, pinnedAt = null) }
        repository.edit("s") { it.copy(unitMode = UnitMode.Days) }

        assertEquals(
            """{"archivedAt":"${NOW}","unitMode":"days"}""",
            database.eventDao().getById("s")?.pendingPatch,
        )
    }

    @Test
    fun anUnchangedEditWritesNothing() = runTest {
        repository.add(listOf(event("a")), createdAt = NOW)
        clock.now = NOW + 1.hours

        assertTrue(repository.edit("a") { it })
        assertEquals(NOW.toEpochMilliseconds(), database.eventDao().getById("a")?.updatedAtEpochMillis)
    }

    @Test
    fun deleteHidesTheDayAndRestoreBringsItBack() = runTest {
        repository.add(listOf(event("a")), createdAt = NOW)

        assertTrue(repository.delete("a"))
        assertNull(repository.get("a"))
        assertNull(repository.observeEvent("a").first())
        assertTrue(repository.observeHome().first().isEmpty())
        assertFalse(repository.delete("a"))
        assertFalse(repository.edit("a") { it.copy(title = "x") })
        assertTrue(repository.isEmpty())

        assertTrue(repository.restore("a"))
        assertEquals(listOf("a"), repository.observeHome().first().map { it.id })
        assertFalse(repository.restore("missing"))
        assertFalse(repository.edit("missing") { it })
    }
}

package dev.derek.daysthatmatter.core.database

import androidx.room.Room
import app.cash.turbine.test
import dev.derek.daysthatmatter.core.database.event.EventDao
import dev.derek.daysthatmatter.core.database.event.toEventDoc
import dev.derek.daysthatmatter.core.database.event.withLocalEdit
import dev.derek.daysthatmatter.core.model.event.Role
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import kotlinx.datetime.LocalDate
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.time.Instant

class EventDaoTest {

    private lateinit var database: AppDatabase
    private lateinit var dao: EventDao

    @BeforeTest
    fun openDatabase() {
        database = Room.inMemoryDatabaseBuilder<AppDatabase>().buildAppDatabase(Dispatchers.IO)
        dao = database.eventDao()
    }

    @AfterTest
    fun closeDatabase() {
        database.close()
    }

    private fun at(minute: Int) = Instant.parse("2026-10-01T10:00:00Z").plus(kotlin.time.Duration.parse("${minute}m"))

    private suspend fun homeIds(pattern: String = "%", category: String? = null) =
        dao.observeHome(pattern, category).first().map { it.id }

    @Test
    fun homeListsPinnedDaysFirstNewestPinFirst() = runTest {
        dao.upsertAll(
            listOf(
                doc("early", date = LocalDate(2026, 10, 20)).row(),
                doc("late", date = LocalDate(2027, 1, 1)).row(),
                doc("pinnedOld", date = LocalDate(2027, 5, 1), pinnedAt = at(1)).row(),
                doc("pinnedNew", date = LocalDate(2027, 6, 1), pinnedAt = at(5)).row(),
            ),
        )

        assertEquals(listOf("pinnedNew", "pinnedOld", "early", "late"), homeIds())
    }

    @Test
    fun homeLeavesOutArchivedAndDeletedDays() = runTest {
        dao.upsertAll(listOf(doc("a").row(), doc("archived", archivedAt = at(0)).row(), doc("deleted").row()))
        dao.markDeleted("deleted", now = 1)

        assertEquals(listOf("a"), homeIds())
        assertEquals(listOf("archived"), dao.observeArchived().first().map { it.id })
        assertEquals(1, dao.observeArchivedCount().first())
        assertEquals(2, dao.countVisible())
    }

    @Test
    fun homeFiltersByCategoryAndTitle() = runTest {
        dao.upsertAll(
            listOf(
                doc("mia", title = "Mia's birthday", categoryId = "birthdays").row(),
                doc("ben", title = "Ben's birthday", categoryId = "birthdays").row(),
                doc("norway", title = "Norway trip", categoryId = "travel").row(),
                doc("sale", title = "50% sale").row(),
            ),
        )

        assertEquals(setOf("mia", "ben"), homeIds(category = "birthdays").toSet())
        assertEquals(listOf("mia"), homeIds(EventDao.likePattern("MIA"), "birthdays"))
        assertEquals(listOf("norway"), homeIds(EventDao.likePattern("trip")))
        assertEquals(listOf("sale"), homeIds(EventDao.likePattern("50%")))
        assertEquals(emptyList(), homeIds(EventDao.likePattern("trip"), "birthdays"))
    }

    @Test
    fun observeByIdFollowsChangesAndHidesDeletedRows() = runTest {
        dao.upsert(doc("a", title = "First").row())

        dao.observeById("a").test {
            assertEquals("First", awaitItem()?.title)
            dao.upsert(doc("a", title = "Second").row())
            assertEquals("Second", awaitItem()?.title)
            dao.markDeleted("a", now = 2)
            assertNull(awaitItem())
            cancelAndIgnoreRemainingEvents()
        }
        assertNotNull(dao.getById("a"))
    }

    @Test
    fun restoreBringsBackADeletedDay() = runTest {
        dao.upsert(doc("a").row())
        dao.markDeleted("a", now = 2)
        dao.restore("a", now = 3)

        assertEquals(listOf("a"), homeIds())
        assertEquals(3, dao.getById("a")?.updatedAtEpochMillis)
    }

    @Test
    fun archivingThroughUpdateClearsThePinAndUnarchivingDoesNotPinAgain() = runTest {
        dao.upsert(doc("a", pinnedAt = at(1)).row())

        dao.update("a") { it.withLocalEdit(it.toEventDoc().copy(archivedAt = at(2), pinnedAt = null), 10) }
        val archived = dao.getById("a")!!
        assertNull(archived.pinnedAtEpochMillis)
        assertEquals(at(2).toEpochMilliseconds(), archived.archivedAtEpochMillis)

        dao.update("a") { it.withLocalEdit(it.toEventDoc().copy(archivedAt = null), 11) }
        val back = dao.getById("a")!!
        assertNull(back.archivedAtEpochMillis)
        assertNull(back.pinnedAtEpochMillis)
        assertEquals(listOf("a"), homeIds())
    }

    @Test
    fun updateWritesNothingWhenTheTransformDeclines() = runTest {
        dao.upsert(doc("g", role = Role.Viewer).row())

        val result = dao.update("g") { null }

        assertNull(result)
        assertNull(dao.update("missing") { it })
        assertEquals(T0.toEpochMilliseconds(), dao.getById("g")?.updatedAtEpochMillis)
    }

    @Test
    fun sharedWithMeDaysAreNeverPinnedInHomeOrder() = runTest {
        // A shared day arrives without pinnedAt (owner-only); it sorts with the unpinned days.
        dao.upsertAll(
            listOf(
                doc("mine", date = LocalDate(2027, 1, 1), pinnedAt = at(1)).row(),
                doc("shared", date = LocalDate(2026, 10, 20), role = Role.Editor).row(),
            ),
        )

        val rows = dao.observeHome().first()
        assertEquals(listOf("mine", "shared"), rows.map { it.id })
        assertNull(rows.single { it.id == "shared" }.pinnedAtEpochMillis)
    }

    @Test
    fun pendingRowsAreNewChangedOrDeleted() = runTest {
        dao.upsertAll(
            listOf(
                doc("new").row(serverRev = null),
                doc("clean").row(serverRev = 2),
                doc("changed").row(serverRev = 2),
                doc("gone").row(serverRev = 2),
            ),
        )
        dao.update("changed") { it.withLocalEdit(it.toEventDoc().copy(title = "Changed"), T0.toEpochMilliseconds() + 20) }
        dao.markDeleted("gone", now = T0.toEpochMilliseconds() + 30)

        val pending = dao.getPending().map { it.id }

        assertEquals(listOf("new", "changed", "gone"), pending)
        assertTrue("clean" !in pending)
    }
}

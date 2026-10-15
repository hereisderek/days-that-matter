package dev.derek.daysthatmatter.core.database

import androidx.room.Room
import dev.derek.daysthatmatter.core.database.memo.MemoDao
import dev.derek.daysthatmatter.core.database.memo.toEntity
import dev.derek.daysthatmatter.core.model.event.Memo
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.time.Instant

class MemoDaoTest {

    private lateinit var database: AppDatabase
    private lateinit var dao: MemoDao

    @BeforeTest
    fun openDatabase() {
        database = Room.inMemoryDatabaseBuilder<AppDatabase>().buildAppDatabase(Dispatchers.IO)
        dao = database.memoDao()
    }

    @AfterTest
    fun closeDatabase() {
        database.close()
    }

    private fun memo(id: String, eventId: String, day: Int) =
        Memo(id = id, eventId = eventId, content = id, createdAt = Instant.parse("2026-10-${day.toString().padStart(2, '0')}T10:00:00Z"))

    @Test
    fun memosOfOneDayOldestFirstWithoutDeletedOnes() = runTest {
        dao.upsert(memo("late", "together", 9).toEntity())
        dao.upsert(memo("early", "together", 1).toEntity())
        dao.upsert(memo("other", "mochi", 2).toEntity())
        dao.upsert(memo("gone", "together", 5).toEntity())
        dao.markDeleted("gone", now = 1)

        assertEquals(listOf("early", "late"), dao.observeByEvent("together").first().map { it.id })
        assertEquals(2, dao.observeCount("together").first())
        assertEquals(1, dao.observeCount("mochi").first())
    }

    @Test
    fun pendingMemosAreUnsyncedOrDeleted() = runTest {
        dao.upsert(memo("new", "e", 1).toEntity())
        dao.upsert(memo("synced", "e", 2).copy(seq = 3).toEntity())
        dao.upsert(memo("deleted", "e", 3).copy(seq = 4).toEntity())
        dao.markDeleted("deleted", now = Instant.parse("2026-10-20T00:00:00Z").toEpochMilliseconds())

        assertEquals(listOf("new", "deleted"), dao.getPending().map { it.id })
    }
}

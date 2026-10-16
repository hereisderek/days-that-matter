package dev.derek.daysthatmatter.core.database

import androidx.room.Room
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.test.runTest
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class AppMetaDaoTest {

    private lateinit var database: AppDatabase

    @BeforeTest
    fun openDatabase() {
        database = Room.inMemoryDatabaseBuilder<AppDatabase>().buildAppDatabase(Dispatchers.IO)
    }

    @AfterTest
    fun closeDatabase() {
        database.close()
    }

    @Test
    fun putThenGetReturnsTheValue() = runTest {
        database.appMetaDao().put(AppMetaEntity(key = "syncCursor", value = "42"))

        assertEquals("42", database.appMetaDao().get("syncCursor"))
    }

    @Test
    fun putReplacesAnExistingValue() = runTest {
        val dao = database.appMetaDao()
        dao.put(AppMetaEntity(key = "region", value = "global"))
        dao.put(AppMetaEntity(key = "region", value = "cn"))

        assertEquals("cn", dao.get("region"))
    }

    @Test
    fun deleteRemovesTheKey() = runTest {
        val dao = database.appMetaDao()
        dao.put(AppMetaEntity(key = "region", value = "global"))
        dao.delete("region")

        assertNull(dao.get("region"))
    }

    @Test
    fun observeEmitsUpdates() = runTest {
        val dao = database.appMetaDao()
        val values = mutableListOf<String?>()
        val job = kotlinx.coroutines.launch {
            dao.observe("name").collect { values.add(it) }
        }
        kotlinx.coroutines.test.runCurrent()
        assertEquals(listOf(null), values)

        dao.put(AppMetaEntity("name", "Sam"))
        kotlinx.coroutines.test.runCurrent()
        assertEquals(listOf(null, "Sam"), values)

        job.cancel()
    }

    @Test
    fun observeAllEmitsAllEntries() = runTest {
        val dao = database.appMetaDao()
        val lists = mutableListOf<List<AppMetaEntity>>()
        val job = kotlinx.coroutines.launch {
            dao.observeAll().collect { lists.add(it) }
        }
        kotlinx.coroutines.test.runCurrent()
        assertEquals(emptyList<AppMetaEntity>(), lists.last())

        dao.put(AppMetaEntity("k1", "v1"))
        kotlinx.coroutines.test.runCurrent()
        assertEquals(listOf(AppMetaEntity("k1", "v1")), lists.last())

        job.cancel()
    }
}

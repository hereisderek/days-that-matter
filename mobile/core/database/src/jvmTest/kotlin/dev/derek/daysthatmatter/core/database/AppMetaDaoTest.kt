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
}

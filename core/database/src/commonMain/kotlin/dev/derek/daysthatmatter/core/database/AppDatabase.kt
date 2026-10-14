package dev.derek.daysthatmatter.core.database

import androidx.room.ConstructedBy
import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.RoomDatabaseConstructor
import androidx.sqlite.driver.bundled.BundledSQLiteDriver
import kotlinx.coroutines.CoroutineDispatcher

/**
 * The app's local database. Version 1 only holds [AppMetaEntity]; the events, memos and sync tables
 * from docs/architecture/PERSISTENCE_AND_SYNC.md are added with the sync engine.
 */
@Database(entities = [AppMetaEntity::class], version = 1)
@ConstructedBy(AppDatabaseConstructor::class)
abstract class AppDatabase : RoomDatabase() {
    abstract fun appMetaDao(): AppMetaDao

    companion object {
        const val FILE_NAME = "days_that_matter.db"
    }
}

// Room's KSP processor generates the actual objects for each target.
@Suppress("KotlinNoActualForExpect")
expect object AppDatabaseConstructor : RoomDatabaseConstructor<AppDatabase> {
    override fun initialize(): AppDatabase
}

/** Finishes a platform builder with the settings every target shares. */
fun RoomDatabase.Builder<AppDatabase>.buildAppDatabase(queryDispatcher: CoroutineDispatcher): AppDatabase =
    setDriver(BundledSQLiteDriver())
        .setQueryCoroutineContext(queryDispatcher)
        .build()

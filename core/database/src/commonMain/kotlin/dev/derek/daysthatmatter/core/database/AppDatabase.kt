package dev.derek.daysthatmatter.core.database

import androidx.room.AutoMigration
import androidx.room.ConstructedBy
import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.RoomDatabaseConstructor
import androidx.sqlite.driver.bundled.BundledSQLiteDriver
import dev.derek.daysthatmatter.core.database.event.EventDao
import dev.derek.daysthatmatter.core.database.event.EventEntity
import dev.derek.daysthatmatter.core.database.memo.MemoDao
import dev.derek.daysthatmatter.core.database.memo.MemoEntity
import kotlinx.coroutines.CoroutineDispatcher

/**
 * The app's local database (docs/architecture/PERSISTENCE_AND_SYNC.md section 2).
 *
 * - Version 1 (Wave 0a): [AppMetaEntity] only.
 * - Version 2: adds `events` ([EventEntity], with `pinned_at`, `archived_at` and `reminders_json`) and
 *   `memos` ([MemoEntity]). Additive, so it is an automatic migration; `app_meta` stays for sync cursors.
 */
@Database(
    entities = [AppMetaEntity::class, EventEntity::class, MemoEntity::class],
    version = AppDatabase.VERSION,
    autoMigrations = [AutoMigration(from = 1, to = 2)],
)
@ConstructedBy(AppDatabaseConstructor::class)
abstract class AppDatabase : RoomDatabase() {
    abstract fun appMetaDao(): AppMetaDao

    abstract fun eventDao(): EventDao

    abstract fun memoDao(): MemoDao

    companion object {
        const val FILE_NAME = "days_that_matter.db"
        const val VERSION = 2
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

package dev.derek.daysthatmatter.core.database

import androidx.room.Room
import androidx.room.testing.MigrationTestHelper
import androidx.sqlite.driver.bundled.BundledSQLiteDriver
import androidx.sqlite.execSQL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import java.nio.file.Files
import java.nio.file.Path
import kotlin.io.path.deleteIfExists
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals

/** Migrations between the exported schemas in core/database/schemas (the Gradle test runs in the module directory). */
class MigrationTest {

    private val file: Path = Files.createTempFile("dtm-migration", ".db")
    private val helper = MigrationTestHelper(
        schemaDirectoryPath = Path.of("schemas"),
        databasePath = file,
        driver = BundledSQLiteDriver(),
        databaseClass = AppDatabase::class,
    )

    @AfterTest
    fun cleanUp() {
        file.deleteIfExists()
    }

    @Test
    fun version1To2KeepsAppMetaAndAddsEventsAndMemos() = runTest {
        helper.createDatabase(1).apply {
            execSQL("INSERT INTO app_meta (`key`, value) VALUES ('syncCursor', '42')")
            close()
        }

        // Validates the migrated schema against 2.json.
        helper.runMigrationsAndValidate(2, emptyList()).close()

        val database = Room.databaseBuilder<AppDatabase>(name = file.toString()).buildAppDatabase(Dispatchers.IO)
        try {
            assertEquals("42", database.appMetaDao().get("syncCursor"))
            database.eventDao().upsert(doc("a", pinnedAt = T0).row())
            assertEquals(listOf("a"), database.eventDao().observeHome().first().map { it.id })
        } finally {
            database.close()
        }
    }
}

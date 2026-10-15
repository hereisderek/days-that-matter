package dev.derek.daysthatmatter.feature.eventeditor.data

import androidx.room.Room
import dev.derek.daysthatmatter.core.database.AppDatabase
import dev.derek.daysthatmatter.core.database.buildAppDatabase
import dev.derek.daysthatmatter.core.database.event.EventRowMeta
import dev.derek.daysthatmatter.core.database.event.toEntity
import dev.derek.daysthatmatter.core.model.ModelJson
import dev.derek.daysthatmatter.core.model.event.CardSize
import dev.derek.daysthatmatter.core.model.event.EventFields
import dev.derek.daysthatmatter.feature.eventeditor.FakeClock
import dev.derek.daysthatmatter.feature.eventeditor.NOW
import dev.derek.daysthatmatter.feature.eventeditor.domain.EventDraft
import dev.derek.daysthatmatter.feature.eventeditor.domain.SaveResult
import dev.derek.daysthatmatter.feature.eventeditor.event
import dev.derek.daysthatmatter.feature.eventeditor.upsert
import dev.derek.daysthatmatter.feature.events.data.RoomEventRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.test.runTest
import kotlinx.datetime.LocalDate
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.time.Duration.Companion.days
import kotlin.time.Duration.Companion.minutes

/** The editor's saves on the real offline-first repository and Room (in memory). */
class RoomUpsertTest {

    private val database = Room.inMemoryDatabaseBuilder<AppDatabase>().buildAppDatabase(Dispatchers.IO)
    private val clock = FakeClock(NOW + 3.minutes)
    private val repository = RoomEventRepository(database.eventDao(), clock)

    @AfterTest
    fun close() {
        database.close()
    }

    @Test
    fun aNewDayIsStoredOwnedUnsyncedAndWithoutAPatch() = runTest {
        val draft = EventDraft.new(LocalDate(2026, 11, 13), "Europe/Oslo").copy(title = "Norway trip")

        val result = upsert(repository, clock)(draft)

        assertEquals(SaveResult.Saved("id-1", created = true), result)
        val row = database.eventDao().getById("id-1")!!
        assertEquals("owner", row.role)
        assertNull(row.serverRev)
        assertNull(row.pendingPatch)
        assertEquals((NOW + 3.minutes).toEpochMilliseconds(), row.createdAtEpochMillis)
        assertEquals((NOW + 3.minutes).toEpochMilliseconds(), row.updatedAtEpochMillis)
    }

    @Test
    fun anEditOfASyncedDayRecordsTheChangedFieldsInThePendingPatch() = runTest {
        val original = event("trip", rev = 12, title = "Trip", notes = "Boots", category = "travel")
        database.eventDao().upsert(
            original.toEntity(EventRowMeta(createdAt = NOW - 10.days, updatedAt = NOW - 1.days, serverRev = 12)),
        )
        val draft = EventDraft.of(original).copy(title = "Norway trip", notes = "", size = CardSize.Large)

        val result = upsert(repository, clock)(draft, repository.get("trip")!!.doc)

        assertEquals(SaveResult.Saved("trip", created = false), result)
        val row = database.eventDao().getById("trip")!!
        assertEquals(12, row.serverRev)
        assertEquals("owner", row.role)
        assertEquals((NOW + 3.minutes).toEpochMilliseconds(), row.updatedAtEpochMillis)
        val patch = ModelJson.parseToJsonElement(row.pendingPatch!!).jsonObject
        assertEquals(setOf(EventFields.TITLE, EventFields.NOTES, EventFields.THEME), patch.keys)
        assertEquals(JsonPrimitive("Norway trip"), patch[EventFields.TITLE])
        assertEquals(JsonNull, patch[EventFields.NOTES])
        assertEquals(JsonPrimitive("large"), patch.getValue(EventFields.THEME).jsonObject["size"])
    }

    @Test
    fun anUnsyncedDayKeepsNoPatchAfterAnEdit() = runTest {
        val original = event("local", title = "Local")
        database.eventDao().upsert(original.toEntity(EventRowMeta(createdAt = NOW, updatedAt = NOW)))

        upsert(repository, clock)(EventDraft.of(original).copy(title = "Still local"), original)

        val row = database.eventDao().getById("local")!!
        assertEquals("Still local", row.title)
        assertNull(row.pendingPatch, "the sync engine sends a never-synced day whole")
    }
}

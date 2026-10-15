package dev.derek.daysthatmatter.core.database

import dev.derek.daysthatmatter.core.database.event.EventDao
import dev.derek.daysthatmatter.core.database.event.EventPatches
import dev.derek.daysthatmatter.core.database.event.withLocalEdit
import dev.derek.daysthatmatter.core.model.event.UnitMode
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.time.Instant

class EventPatchesTest {

    @Test
    fun diffListsOnlyChangedWritableFields() {
        val old = doc("a", pinnedAt = Instant.parse("2026-10-01T00:00:00Z"))
        val new = old.copy(unitMode = UnitMode.Hours, pinnedAt = null, updatedAt = T0)

        val patch = EventPatches.diff(old, new)

        assertEquals(JsonObject(mapOf("pinnedAt" to JsonNull, "unitMode" to JsonPrimitive("hours"))), patch)
    }

    @Test
    fun changingBackToTheDefaultIsAChange() {
        val old = doc("a").copy(unitMode = UnitMode.Days)

        val patch = EventPatches.diff(old, old.copy(unitMode = UnitMode.Auto))

        assertEquals(JsonObject(mapOf("unitMode" to JsonPrimitive("auto"))), patch)
    }

    @Test
    fun mergeKeepsEarlierFieldsAndReplacesRepeatedOnes() {
        val first = EventPatches.merge(null, JsonObject(mapOf("title" to JsonPrimitive("A"), "unitMode" to JsonPrimitive("days"))))
        val second = EventPatches.merge(first, JsonObject(mapOf("unitMode" to JsonPrimitive("weeks"))))

        assertEquals("""{"title":"A","unitMode":"weeks"}""", second)
        assertNull(EventPatches.merge(null, JsonObject(emptyMap())))
    }

    @Test
    fun aSyncedRowCollectsThePatch() {
        val old = doc("a").row(serverRev = 3)
        val now = 5_000L

        val edited = old.withLocalEdit(doc("a").copy(unitMode = UnitMode.Weeks), now)

        assertEquals("""{"unitMode":"weeks"}""", edited.pendingPatch)
        assertEquals(now, edited.updatedAtEpochMillis)
        assertEquals(old.createdAtEpochMillis, edited.createdAtEpochMillis)
        assertEquals(3, edited.serverRev)
    }

    @Test
    fun aNeverSyncedRowKeepsNoPatch() {
        val edited = doc("a").row(serverRev = null).withLocalEdit(doc("a").copy(unitMode = UnitMode.Weeks), 1L)

        assertNull(edited.pendingPatch)
        assertEquals("weeks", edited.unitMode)
    }

    @Test
    fun likePatternEscapesWildcards() {
        assertEquals("%%", EventDao.likePattern("  "))
        assertEquals("%Mia%", EventDao.likePattern(" Mia "))
        assertEquals("%50\\%\\_off\\\\%", EventDao.likePattern("50%_off\\"))
    }
}

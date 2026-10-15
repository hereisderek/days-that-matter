package dev.derek.daysthatmatter.core.model.merge

import dev.derek.daysthatmatter.core.model.ModelJson
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** Field-level last-write-wins, inverse patches and overwritten-field detection (design D5). */
class PatchMergeTest {
    private fun obj(json: String): JsonObject = ModelJson.parseToJsonElement(json).jsonObject

    private val doc = obj(
        """
        {"title":"Our wedding","targetDate":"2027-06-12","targetTime":"16:30:00",
         "theme":{"paletteId":"violet","cardStyle":"glass","typography":"modern","gradient":["#8B5CF6","#3B82F6"]},
         "backdrop":{"kind":"still","stillId":"Pz8aaaaaaaaaaaaaaaaaaa","dim":0.3},
         "notes":"Book the photographer","pinnedAt":"2026-10-01T08:00:00Z"}
        """.trimIndent(),
    )

    @Test
    fun editsToDifferentFieldsAreAllKept() {
        // Owner changes the title offline while an editor changes the date (event-sync "Different fields").
        val editor = PatchMerge.apply(doc, obj("""{"targetDate":"2027-06-13"}"""))
        val owner = PatchMerge.apply(editor.doc, obj("""{"title":"Our wedding day"}"""))
        assertEquals("\"Our wedding day\"", owner.doc["title"].toString())
        assertEquals("\"2027-06-13\"", owner.doc["targetDate"].toString())
        val overwritten = PatchMerge.overwrittenFields(
            owner.changedFields,
            baseRev = 9,
            revisionsSinceBase = listOf(RevisionFields(10, "editor", editor.changedFields)),
            writerId = "owner",
        )
        assertEquals(emptyList(), overwritten)
    }

    @Test
    fun sameFieldLastWriteWinsAndIsReported() {
        // Editor sets 18:00, then the owner's older offline edit sets 17:00 (event-sync "Same field").
        val editor = PatchMerge.apply(doc, obj("""{"targetTime":"18:00:00"}"""))
        val owner = PatchMerge.apply(editor.doc, obj("""{"targetTime":"17:00:00"}"""))
        assertEquals("\"17:00:00\"", owner.doc["targetTime"].toString())
        assertEquals(obj("""{"targetTime":"18:00:00"}"""), owner.inverse)
        val overwritten = PatchMerge.overwrittenFields(
            owner.changedFields,
            baseRev = 9,
            revisionsSinceBase = listOf(RevisionFields(10, "editor", setOf("targetTime"))),
            writerId = "owner",
        )
        assertEquals(listOf("targetTime"), overwritten)
    }

    @Test
    fun overwrittenIgnoresOwnRevisionsOlderRevisionsAndUnchangedFields() {
        val revisions = listOf(
            RevisionFields(8, "editor", setOf("title")),
            RevisionFields(10, "owner", setOf("emoji")),
            RevisionFields(11, null, setOf("notes")),
            RevisionFields(12, "editor", setOf("audio", "theme")),
        )
        val overwritten = PatchMerge.overwrittenFields(setOf("title", "emoji", "notes", "theme"), 9, revisions, "owner")
        assertEquals(listOf("notes", "theme"), overwritten)
    }

    @Test
    fun nestedObjectsAreReplacedWhole() {
        val result = PatchMerge.apply(doc, obj("""{"theme":{"paletteId":"rose","cardStyle":"glass","typography":"modern"}}"""))
        assertEquals(obj("""{"paletteId":"rose","cardStyle":"glass","typography":"modern"}"""), result.doc["theme"])
        assertFalse("gradient" in result.doc["theme"]!!.jsonObject)
        assertEquals(doc["theme"], result.inverse["theme"])
        // Two writers changing different members of the theme: the later object wins whole.
        val a = PatchMerge.apply(doc, obj("""{"theme":{"paletteId":"rose","cardStyle":"glass","typography":"modern","gradient":["#8B5CF6","#3B82F6"]}}"""))
        val b = PatchMerge.apply(a.doc, obj("""{"theme":{"paletteId":"violet","cardStyle":"minimal","typography":"modern","gradient":["#8B5CF6","#3B82F6"]}}"""))
        assertEquals("\"violet\"", b.doc["theme"]!!.jsonObject["paletteId"].toString())
        assertEquals(listOf("theme"), PatchMerge.overwrittenFields(b.changedFields, 9, listOf(RevisionFields(10, "a", a.changedFields)), "b"))
    }

    @Test
    fun nullClearsAFieldAndTheInverseRestoresIt() {
        val result = PatchMerge.apply(doc, obj("""{"backdrop":null,"notes":null}"""))
        assertFalse("backdrop" in result.doc)
        assertFalse("notes" in result.doc)
        assertEquals(obj("""{"backdrop":null,"notes":null}"""), result.applied)
        assertEquals(doc["backdrop"], result.inverse["backdrop"])
        assertEquals(doc, PatchMerge.apply(result.doc, result.inverse).doc)
    }

    @Test
    fun settingAnAbsentFieldHasANullInverse() {
        val result = PatchMerge.apply(doc, obj("""{"emoji":"💍"}"""))
        assertEquals(JsonNull, result.inverse["emoji"])
        assertEquals(doc, PatchMerge.apply(result.doc, result.inverse).doc)
    }

    @Test
    fun clearingAnAbsentFieldOrRewritingTheSameValueChangesNothing() {
        val result = PatchMerge.apply(doc, obj("""{"emoji":null,"title":"Our wedding","theme":${doc["theme"]}}"""))
        assertEquals(doc, result.doc)
        assertTrue(result.applied.isEmpty())
        assertTrue(result.inverse.isEmpty())
    }

    @Test
    fun inverseUndoesAnyPatch() {
        val patches = listOf(
            """{"title":"x","emoji":"🎉","targetTime":null}""",
            """{"recurrence":{"type":"weekly"},"unitMode":"workdays","backdrop":null}""",
            """{"audio":{"kind":"library","trackId":"calm-lofi"},"notes":"new","pinnedAt":null}""",
        )
        var current = doc
        val history = mutableListOf<Pair<Long, JsonObject>>()
        for ((i, p) in patches.withIndex()) {
            val result = PatchMerge.apply(current, obj(p))
            assertEquals(current, PatchMerge.apply(result.doc, result.inverse).doc, p)
            history += (10L + i) to result.inverse
            current = result.doc
        }
        assertEquals(doc, PatchMerge.revertTo(current, 9, history))
        assertEquals(PatchMerge.apply(doc, obj(patches[0])).doc, PatchMerge.revertTo(current, 10, history.shuffled()))
        assertEquals(current, PatchMerge.revertTo(current, 12, history))
    }

    @Test
    fun archivingClearsThePinAndTheInverseRestoresIt() {
        val result = PatchMerge.applyToEvent(doc, obj("""{"archivedAt":"2026-10-12T15:04:05Z"}"""))
        assertFalse("pinnedAt" in result.doc)
        assertEquals(obj("""{"archivedAt":"2026-10-12T15:04:05Z","pinnedAt":null}"""), result.applied)
        assertEquals(doc["pinnedAt"], result.inverse["pinnedAt"])
        assertEquals(doc, PatchMerge.apply(result.doc, result.inverse).doc)
    }

    @Test
    fun archivingAndPinningInOneWriteLeavesTheDayUnpinned() {
        val result = PatchMerge.applyToEvent(doc, obj("""{"archivedAt":"2026-10-12T15:04:05Z","pinnedAt":"2026-10-12T15:04:05Z"}"""))
        assertFalse("pinnedAt" in result.doc)
    }

    @Test
    fun unarchivingDoesNotPinAgain() {
        val archived = PatchMerge.applyToEvent(doc, obj("""{"archivedAt":"2026-10-12T15:04:05Z"}""")).doc
        val result = PatchMerge.applyToEvent(archived, obj("""{"archivedAt":null}"""))
        assertFalse("archivedAt" in result.doc)
        assertFalse("pinnedAt" in result.doc)
        assertEquals(setOf("archivedAt"), result.changedFields)
    }

    @Test
    fun archivingAnUnpinnedDayDoesNotRecordAPinChange() {
        val unpinned = JsonObject(doc - "pinnedAt")
        val result = PatchMerge.applyToEvent(unpinned, obj("""{"archivedAt":"2026-10-12T15:04:05Z"}"""))
        assertEquals(setOf("archivedAt"), result.changedFields)
    }

    @Test
    fun memosUseTheSamePatchRule() {
        val memo = obj("""{"content":"Booked the venue.","milestoneTag":"Day 100","createdAt":"2026-10-01T08:00:00Z"}""")
        val result = PatchMerge.apply(memo, obj("""{"content":"Booked the venue and the band.","milestoneTag":null}"""))
        assertEquals(obj("""{"content":"Booked the venue and the band.","createdAt":"2026-10-01T08:00:00Z"}"""), result.doc)
        assertEquals(memo, PatchMerge.apply(result.doc, result.inverse).doc)
    }
}

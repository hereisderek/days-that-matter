package dev.derek.daysthatmatter.core.model.event

import dev.derek.daysthatmatter.core.model.ModelJson
import kotlinx.datetime.LocalDate
import kotlinx.datetime.LocalTime
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.time.Instant

class EventJsonTest {

    /** The owner's document from BACKEND.md section 7.2, word for word. */
    private val contractExample = """
        {
          "id": "0b8f3c1e-6d0a-4a51-9f61-2f1b3f6d9a10",
          "rev": 9,
          "role": "owner",
          "title": "Our wedding",
          "emoji": "💍",
          "targetDate": "2027-06-12",
          "targetTime": "16:30:00",
          "timeZone": "Europe/Paris",
          "unitMode": "auto",
          "recurrence": {"type": "yearly", "originalYear": 2027, "days": null},
          "theme": {"paletteId": "violet", "cardStyle": "glass", "typography": "modern", "gradient": ["#8B5CF6", "#3B82F6"], "size": "medium"},
          "backdrop": {
            "kind": "animated", "stillId": "Pz8xxxxxxxxxxxxxxxxxxx", "motionId": "Hq3xxxxxxxxxxxxxxxxxxx", "dim": 0.3, "blur": 0,
            "stillUrl": "https://media.example/m/Pz8.jpg", "motionUrl": "https://media.example/m/Hq3.mp4"
          },
          "audio": {"kind": "spotify", "url": "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M", "title": "Today's Top Hits", "artist": "Spotify"},
          "notes": "Book the photographer",
          "pinnedAt": "2026-10-01T08:00:00Z",
          "categoryId": "anniversaries",
          "archivedAt": null,
          "reminders": {"daysBefore": [0, 7], "time": "09:00"},
          "updatedAt": "2026-10-12T15:04:05Z"
        }
    """.trimIndent()

    private val full = EventDoc(
        id = "0b8f3c1e-6d0a-4a51-9f61-2f1b3f6d9a10",
        rev = 9,
        role = Role.Owner,
        title = "Our wedding",
        emoji = "💍",
        targetDate = LocalDate(2027, 6, 12),
        targetTime = LocalTime(16, 30),
        timeZone = "Europe/Paris",
        unitMode = UnitMode.Auto,
        recurrence = Recurrence.Yearly(2027),
        theme = Theme("violet", "glass", "modern", listOf("#8B5CF6", "#3B82F6"), CardSize.Medium),
        backdrop = Backdrop(
            kind = BackdropKind.Animated,
            stillId = "Pz8xxxxxxxxxxxxxxxxxxx",
            motionId = "Hq3xxxxxxxxxxxxxxxxxxx",
            dim = 0.3,
            blur = 0.0,
            stillUrl = "https://media.example/m/Pz8.jpg",
            motionUrl = "https://media.example/m/Hq3.mp4",
        ),
        audio = Audio.Spotify("https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M", "Today's Top Hits", "Spotify"),
        notes = "Book the photographer",
        pinnedAt = Instant.parse("2026-10-01T08:00:00Z"),
        categoryId = "anniversaries",
        archivedAt = null,
        reminders = Reminders(listOf(0, 7), LocalTime(9, 0)),
        updatedAt = Instant.parse("2026-10-12T15:04:05Z"),
    )

    @Test
    fun contractExampleDecodes() {
        assertEquals(full, ModelJson.decodeFromString<EventDoc>(contractExample))
    }

    @Test
    fun fullDocumentRoundTrips() {
        assertEquals(full, roundTrip(full))
    }

    @Test
    fun minimalDocumentUsesDefaults() {
        val doc = ModelJson.decodeFromString<EventDoc>(
            """{"id":"a","title":"t","targetDate":"2030-01-01","theme":{"paletteId":"a","cardStyle":"b","typography":"c"}}""",
        )
        assertEquals(UnitMode.Auto, doc.unitMode)
        assertEquals(Recurrence.None, doc.recurrence)
        assertEquals(CardSize.Medium, doc.theme.size)
        assertNull(doc.targetTime)
        assertNull(doc.pinnedAt)
        assertNull(doc.archivedAt)
        assertEquals(0, doc.rev)
    }

    @Test
    fun missingSizeReadsAsMedium() {
        val theme = ModelJson.decodeFromString<Theme>("""{"paletteId":"a","cardStyle":"b","typography":"c"}""")
        assertEquals(CardSize.Medium, theme.size)
    }

    @Test
    fun everyCardSizeRoundTrips() {
        for ((size, name) in listOf(CardSize.Small to "small", CardSize.Medium to "medium", CardSize.Large to "large")) {
            val theme = Theme("a", "b", "c", size = size)
            val json = ModelJson.encodeToString(Theme.serializer(), theme)
            if (size != CardSize.Medium) assertEquals(name, ModelJson.parseToJsonElement(json).jsonObject["size"]?.jsonPrimitive?.content)
            assertEquals(theme, ModelJson.decodeFromString<Theme>(json))
        }
    }

    @Test
    fun unknownFieldsAreIgnoredOnRead() {
        val withExtras = contractExample.replaceFirst(
            "\"rev\": 9,",
            "\"rev\": 9, \"addedLater\": {\"x\": [1, 2]}, \"anotherNewField\": true,",
        ).replace(
            "\"size\": \"medium\"}",
            "\"size\": \"medium\", \"presetId\": \"aurora\"}",
        )
        assertEquals(full, ModelJson.decodeFromString<EventDoc>(withExtras))
    }

    @Test
    fun unitModesUseTheirApiValues() {
        val names = UnitMode.entries.map { ModelJson.encodeToString(UnitMode.serializer(), it) }
        assertEquals(listOf("\"auto\"", "\"days\"", "\"weeks\"", "\"hours\"", "\"calendar\"", "\"workdays\""), names)
        for (mode in UnitMode.entries) {
            assertEquals(mode, ModelJson.decodeFromString(UnitMode.serializer(), ModelJson.encodeToString(UnitMode.serializer(), mode)))
        }
    }

    @Test
    fun targetTimeIsWrittenWithSeconds() {
        val json = ModelJson.encodeToJsonElement(EventDoc.serializer(), full).jsonObject
        assertEquals("16:30:00", json["targetTime"]?.jsonPrimitive?.content)
        assertEquals("09:00", json["reminders"]?.jsonObject?.get("time")?.jsonPrimitive?.content)
    }

    @Test
    fun timeFormatsRejectOtherShapes() {
        assertFailsWith<SerializationException> { ModelJson.decodeFromString(HmsTimeSerializer, "\"16:30\"") }
        assertFailsWith<SerializationException> { ModelJson.decodeFromString(HmTimeSerializer, "\"16:30:00\"") }
        assertEquals(LocalTime(23, 59, 59), ModelJson.decodeFromString(HmsTimeSerializer, "\"23:59:59\""))
    }

    @Test
    fun remindersTimeDefaultsToNine() {
        assertEquals(Reminders(listOf(1)), ModelJson.decodeFromString<Reminders>("""{"daysBefore":[1]}"""))
    }

    @Test
    fun recurrenceUsesTheFlatApiShape() {
        val cases = mapOf(
            Recurrence.None to """{"type":"none"}""",
            Recurrence.Yearly(1990) to """{"type":"yearly","originalYear":1990}""",
            Recurrence.Monthly to """{"type":"monthly"}""",
            Recurrence.Weekly to """{"type":"weekly"}""",
            Recurrence.CustomDays(10) to """{"type":"customDays","days":10}""",
        )
        for ((value, json) in cases) {
            assertEquals(json, ModelJson.encodeToString(Recurrence.serializer(), value))
            assertEquals(value, ModelJson.decodeFromString(Recurrence.serializer(), json))
        }
        assertEquals(Recurrence.Weekly, ModelJson.decodeFromString(Recurrence.serializer(), """{"type":"weekly","originalYear":null,"days":null}"""))
    }

    @Test
    fun recurrenceWithFieldsOfAnotherTypeFailsToDecode() {
        for (json in listOf("""{"type":"yearly"}""", """{"type":"weekly","originalYear":2020}""", """{"type":"customDays"}""", """{"type":"none","days":3}""")) {
            assertFailsWith<SerializationException>(json) { ModelJson.decodeFromString(Recurrence.serializer(), json) }
        }
    }

    @Test
    fun audioKindsRoundTrip() {
        val cases = mapOf<Audio, String>(
            Audio.Library("calm-lofi") to """{"kind":"library","trackId":"calm-lofi"}""",
            Audio.Custom("Qm7xxxxxxxxxxxxxxxxxxx", "First dance") to """{"kind":"custom","mediaId":"Qm7xxxxxxxxxxxxxxxxxxx","title":"First dance"}""",
            Audio.Spotify("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT") to """{"kind":"spotify","url":"https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT"}""",
        )
        for ((value, json) in cases) {
            assertEquals(json, ModelJson.encodeToString(Audio.serializer(), value))
            assertEquals(value, ModelJson.decodeFromString(Audio.serializer(), json))
        }
    }

    @Test
    fun stillBackdropDefaultsBlurToZero() {
        val b = ModelJson.decodeFromString<Backdrop>("""{"kind":"still","stillId":"Pz8xxxxxxxxxxxxxxxxxxx","dim":0.2}""")
        assertEquals(0.0, b.blur)
        assertNull(b.motionId)
    }

    @Test
    fun blurScalesWithCardWidth() {
        val b = Backdrop(BackdropKind.Still, "Pz8xxxxxxxxxxxxxxxxxxx", dim = 0.0, blur = 8.0)
        assertEquals(4.0, b.blurRadiusFor(195.0))
        assertEquals(8.0, b.blurRadiusFor(390.0))
    }

    @Test
    fun memoRoundTripsAndMatchesTheContract() {
        val json = """{"id":"5c1f","eventId":"0b8f","seq":41,"content":"Booked the venue today.","milestoneTag":"Day 100","createdAt":"2026-10-01T08:00:00Z","updatedAt":"2026-10-02T08:00:00Z"}"""
        val memo = ModelJson.decodeFromString<Memo>(json)
        assertEquals("Day 100", memo.milestoneTag)
        assertEquals(json, ModelJson.encodeToString(Memo.serializer(), memo))
    }

    @Test
    fun publicEventAndMembershipRoundTrip() {
        val public = PublicEvent(rev = 3, title = "t", targetDate = LocalDate(2027, 1, 1), theme = Theme("a", "b", "c"))
        assertEquals(public, roundTrip(public))
        val membership = Membership(Instant.parse("2026-10-12T00:00:00Z"), Reminders(listOf(0)))
        assertEquals(membership, ModelJson.decodeFromString<Membership>(ModelJson.encodeToString(Membership.serializer(), membership)))
    }

    @Test
    fun defaultsAndNullsAreNotWritten() {
        val minimal = EventDoc(id = "a", title = "t", targetDate = LocalDate(2030, 1, 1), theme = Theme("a", "b", "c"))
        val json = ModelJson.encodeToJsonElement(EventDoc.serializer(), minimal) as JsonObject
        assertEquals(setOf("id", "title", "targetDate", "theme"), json.keys)
        assertFalse("archivedAt" in json)
    }

    @Test
    fun roleHelpers() {
        assertEquals(listOf(true, true, false), Role.entries.map { it.canEditSharedFields })
        assertEquals(listOf(true, false, false), Role.entries.map { it.canSeeOwnerFields })
        assertEquals(Role.Editor, MemberRole.Editor.role)
        assertEquals(Role.Viewer, MemberRole.Viewer.role)
    }

    @Test
    fun fieldSetsAreDisjointAndComplete() {
        assertEquals(emptySet(), EventFields.SHARED intersect EventFields.OWNER_ONLY)
        assertEquals(15, EventFields.WRITABLE.size)
        assertEquals(setOf("notes", "pinnedAt", "categoryId", "archivedAt", "reminders"), EventFields.OWNER_ONLY)
        assertEquals(EventFields.WRITABLE, EventFields.WRITABLE + EventFields.NOT_NULL + EventFields.OBJECTS)
    }

    private fun roundTrip(doc: EventDoc): EventDoc = ModelJson.decodeFromString(ModelJson.encodeToString(EventDoc.serializer(), doc))

    private fun roundTrip(doc: PublicEvent): PublicEvent =
        ModelJson.decodeFromString(ModelJson.encodeToString(PublicEvent.serializer(), doc))
}

package dev.derek.daysthatmatter.core.model.validation

import dev.derek.daysthatmatter.core.model.ModelJson
import dev.derek.daysthatmatter.core.model.api.ApiErrorCode
import dev.derek.daysthatmatter.core.model.event.EventDoc
import dev.derek.daysthatmatter.core.model.loadTimeZoneDatabase
import dev.derek.daysthatmatter.core.model.utf16Unit
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Event validation. The valid, boundary and hostile cases of the old share service
 * (`services/share/test/api/validation.test.ts`) are ported first, then the new fields.
 */
class EventValidationTest {
    init {
        loadTimeZoneDatabase()
    }

    private fun cp(vararg n: Int): String = buildString { n.forEach { appendCodePoint(it) } }

    private fun StringBuilder.appendCodePoint(c: Int) {
        if (c < 0x10000) {
            append(c.toChar())
        } else {
            val v = c - 0x10000
            append((0xD800 + (v shr 10)).toChar())
            append((0xDC00 + (v and 0x3FF)).toChar())
        }
    }

    private fun obj(json: String): JsonObject = ModelJson.parseToJsonElement(json).jsonObject

    private val base: JsonObject = obj(
        """
        {"title":"Our wedding","emoji":"💍","targetDate":"2027-06-12","targetTime":"16:30:00","timeZone":"Europe/Paris",
         "unitMode":"auto","recurrence":{"type":"yearly","originalYear":2027,"days":null},
         "theme":{"paletteId":"violet","cardStyle":"glass","typography":"modern","gradient":["#8B5CF6","#3B82F6"]}}
        """.trimIndent(),
    )

    private fun with(vararg fields: Pair<String, JsonElement>): JsonObject = JsonObject(base + fields)

    private fun with(field: String, json: String): JsonObject = with(field to ModelJson.parseToJsonElement(json))

    private fun text(field: String, value: String): JsonObject = with(field to JsonPrimitive(value))

    private fun assertValid(fields: JsonObject): JsonObject {
        val result = EventValidation.validateNew(fields)
        assertIs<Validated.Valid<JsonObject>>(result, "expected valid: $result")
        return result.value
    }

    private fun assertInvalid(fields: JsonObject, field: String? = null): Validated.Invalid {
        val result = EventValidation.validateNew(fields)
        assertIs<Validated.Invalid>(result, "expected invalid: $fields")
        if (field != null) assertEquals(field, result.errors.first().field, result.errors.toString())
        return result
    }

    // Ported: valid and boundary.

    @Test
    fun acceptsTheContractExample() {
        val out = assertValid(base)
        assertEquals(base.keys, out.keys)
    }

    @Test
    fun acceptsTheMinimalEventAndItDecodes() {
        val minimal = obj("""{"title":"x","targetDate":"2030-01-01","theme":{"paletteId":"a","cardStyle":"b","typography":"c"}}""")
        val out = assertValid(minimal)
        val doc = ModelJson.decodeFromJsonElement(EventDoc.serializer(), JsonObject(out + ("id" to JsonPrimitive("e"))))
        assertEquals("x", doc.title)
    }

    @Test
    fun titleOf100CharactersIsAcceptedAnd101Rejected() {
        assertValid(text("title", "a".repeat(100)))
        assertInvalid(text("title", "a".repeat(101)), "title")
    }

    @Test
    fun titleLengthCountsCodePointsNotUtf16Units() {
        assertValid(text("title", cp(0x1F600).repeat(100)))
        assertInvalid(text("title", cp(0x1F600).repeat(101)), "title")
    }

    @Test
    fun emptyAndWhitespaceTitlesAreRejected() {
        assertInvalid(text("title", ""), "title")
        assertInvalid(text("title", "   "), "title")
    }

    @Test
    fun titleIsTrimmed() {
        val out = assertValid(text("title", "  Café  "))
        assertEquals("Café", out["title"]?.jsonPrimitive?.content)
    }

    @Test
    fun yearBoundaries() {
        for (d in listOf("1900-01-01", "2200-12-31")) assertValid(text("targetDate", d))
        for (d in listOf("1899-12-31", "2201-01-01")) assertInvalid(text("targetDate", d), "targetDate")
    }

    @Test
    fun leapDayIsAcceptedAndImpossibleDatesRejected() {
        assertValid(text("targetDate", "2028-02-29"))
        for (d in listOf("2027-02-29", "2027-13-01", "2027-04-31", "2027-6-1", "tomorrow", "2027-00-10")) {
            assertInvalid(text("targetDate", d), "targetDate")
        }
    }

    @Test
    fun targetTimeFormat() {
        assertValid(text("targetTime", "23:59:59"))
        assertValid(with("targetTime" to JsonNull))
        for (t in listOf("24:00:00", "12:60:00", "12:00", "1:00:00", "12:00:60")) assertInvalid(text("targetTime", t), "targetTime")
    }

    @Test
    fun aTwoPersonZwjEmojiOf11BytesIsAccepted() {
        assertValid(text("emoji", cp(0x1F468, 0x200D, 0x1F469)))
    }

    @Test
    fun keycapFlagAndSkinToneEmojiAreOneEmoji() {
        assertValid(text("emoji", cp(0x31, 0xFE0F, 0x20E3)))
        assertValid(text("emoji", cp(0x1F1EB, 0x1F1F7)))
        assertValid(text("emoji", cp(0x1F44D, 0x1F3FD)))
        assertValid(text("emoji", "a"))
    }

    // Ported: hostile input. Every case is rejected with invalid_payload.

    private val hostile: List<Pair<String, JsonObject>> by lazy {
        val theme = """{"paletteId":"a","cardStyle":"b","typography":"c""""
        listOf(
            "unknown field" to with("extra", "1"),
            "memos" to with("memos", "[]"),
            "ownerId" to with("ownerId", "\"u1\""),
            "id" to with("id", "\"e1\""),
            "rev" to with("rev", "3"),
            "role" to with("role", "\"owner\""),
            "url field" to with("wallpaper", "\"https://evil.test/x.png\""),
            "NUL in title" to text("title", "a" + cp(0) + "b"),
            "C1 control in title" to text("title", "a" + cp(0x85) + "b"),
            "LS in title" to text("title", "a" + cp(0x2028) + "b"),
            "PS in title" to text("title", "a" + cp(0x2029) + "b"),
            "RLO in title" to text("title", "a" + cp(0x202E) + "b"),
            "bidi isolate in title" to text("title", "a" + cp(0x2066) + "b"),
            "lone high surrogate" to text("title", "a" + utf16Unit(0xD800) + "b"),
            "lone low surrogate" to text("title", "a" + utf16Unit(0xDC00) + "b"),
            "newline in title" to text("title", "a\nb"),
            "bad IANA zone" to text("timeZone", "Mars/Phobos"),
            "empty zone" to text("timeZone", ""),
            "zone with spaces" to text("timeZone", "Europe/ Paris"),
            "zone offset" to text("timeZone", "+03:00"),
            "bad gradient hex" to with("theme", "$theme,\"gradient\":[\"#GGGGGG\",\"#000000\"]}"),
            "short gradient hex" to with("theme", "$theme,\"gradient\":[\"#FFF\",\"#000000\"]}"),
            "3 colors" to with("theme", "$theme,\"gradient\":[\"#000000\",\"#000000\",\"#000000\"]}"),
            "gradient not array" to with("theme", "$theme,\"gradient\":\"#000000\"}"),
            "bad palette id" to with("theme", """{"paletteId":"Has Space","cardStyle":"b","typography":"c"}"""),
            "long palette id" to with("theme", """{"paletteId":"${"a".repeat(33)}","cardStyle":"b","typography":"c"}"""),
            "missing typography" to with("theme", """{"paletteId":"a","cardStyle":"b"}"""),
            "unknown theme key" to with("theme", "$theme,\"image\":\"x\"}"),
            "bad card size" to with("theme", "$theme,\"size\":\"huge\"}"),
            "theme not object" to with("theme", "\"violet\""),
            "two emoji" to text("emoji", cp(0x1F600, 0x1F600)),
            "text as emoji" to text("emoji", "ab"),
            "empty emoji" to text("emoji", ""),
            "emoji over 16 bytes" to text("emoji", cp(0x1F468, 0x200D, 0x1F469, 0x200D, 0x1F467, 0x200D, 0x1F466, 0x200D, 0x1F466)),
            "letter joined by ZWJ" to text("emoji", "a" + cp(0x200D) + "b"),
            "bad unitMode" to text("unitMode", "business"),
            "unitMode not string" to with("unitMode", "1"),
            "yearly without year" to with("recurrence", """{"type":"yearly","originalYear":null,"days":null}"""),
            "originalYear on weekly" to with("recurrence", """{"type":"weekly","originalYear":2020,"days":null}"""),
            "customDays without days" to with("recurrence", """{"type":"customDays","originalYear":null,"days":null}"""),
            "customDays 3651" to with("recurrence", """{"type":"customDays","days":3651}"""),
            "customDays 0" to with("recurrence", """{"type":"customDays","days":0}"""),
            "customDays fraction" to with("recurrence", """{"type":"customDays","days":1.5}"""),
            "customDays as string" to with("recurrence", """{"type":"customDays","days":"7"}"""),
            "originalYear 1899" to with("recurrence", """{"type":"yearly","originalYear":1899}"""),
            "bad recurrence type" to with("recurrence", """{"type":"daily","originalYear":null,"days":null}"""),
            "recurrence without type" to with("recurrence", """{"days":3}"""),
            "unknown recurrence key" to with("recurrence", """{"type":"none","every":2}"""),
            "title not string" to with("title", "5"),
            "title null" to with("title" to JsonNull),
            "targetDate number" to with("targetDate", "20270612"),
        )
    }

    @Test
    fun hostileInputIsRejected() {
        for ((name, fields) in hostile) {
            val result = EventValidation.validateNew(fields)
            assertIs<Validated.Invalid>(result, name)
            assertEquals(ApiErrorCode.InvalidPayload, result.toApiError().code, name)
        }
    }

    @Test
    fun errorMessagesNeverEchoUserContent() {
        val result = assertInvalid(with("SECRET_KEY_NAME", "\"SECRET_VALUE\""))
        val body = ModelJson.encodeToString(dev.derek.daysthatmatter.core.model.api.ApiErrorBody.serializer(), result.toApiError())
        assertFalse("SECRET" in body, body)
        for ((name, fields) in hostile) {
            val errors = (EventValidation.validateNew(fields) as Validated.Invalid).errors
            for (e in errors) assertFalse("evil" in e.message || "Phobos" in e.message || "business" in e.message, "$name: ${e.message}")
        }
    }

    @Test
    fun errorNamesTheFieldPath() {
        val result = assertInvalid(with("recurrence", """{"type":"customDays","days":0}"""), "recurrence.days")
        val api = result.toApiError()
        assertEquals("recurrence.days", api.details?.get("field")?.jsonPrimitive?.content)
        assertTrue(api.message.startsWith("recurrence.days: "))
        assertEquals("(body): unknown field", assertInvalid(with("extra", "1"), "").errors.first().message)
    }

    @Test
    fun requiredFieldsMustBePresentOnCreate() {
        for (name in listOf("title", "targetDate", "theme")) {
            assertInvalid(JsonObject(base - name), name)
        }
    }

    // New fields: unit modes and card size (change design-v2-features).

    @Test
    fun allSixUnitModesAreAccepted() {
        for (mode in listOf("auto", "days", "weeks", "hours", "calendar", "workdays")) assertValid(text("unitMode", mode))
    }

    @Test
    fun cardSizesAreAcceptedAndNullSizeIsDropped() {
        val theme = """{"paletteId":"a","cardStyle":"b","typography":"c""""
        for (size in listOf("small", "medium", "large")) assertValid(with("theme", "$theme,\"size\":\"$size\"}"))
        val out = assertValid(with("theme", "$theme,\"size\":null,\"gradient\":null}"))
        assertEquals(setOf("paletteId", "cardStyle", "typography"), out["theme"]?.jsonObject?.keys)
    }

    @Test
    fun recurrenceIsNormalizedWithoutNulls() {
        val out = assertValid(base)
        assertEquals(obj("""{"type":"yearly","originalYear":2027}"""), out["recurrence"])
        for (type in listOf("none", "monthly", "weekly")) assertValid(with("recurrence", """{"type":"$type"}"""))
        assertValid(with("recurrence", """{"type":"customDays","days":3650}"""))
        assertValid(with("recurrence", """{"type":"customDays","days":1}"""))
    }

    // New fields: owner-only fields.

    @Test
    fun notesUpTo4000CharactersWithLineBreaks() {
        assertValid(text("notes", "a".repeat(4000)))
        assertValid(text("notes", "line 1\nline 2\twith tab"))
        assertValid(text("notes", ""))
        assertInvalid(text("notes", "a".repeat(4001)), "notes")
        assertInvalid(text("notes", "a" + cp(0x202E)), "notes")
        assertInvalid(text("notes", "a\u0000"), "notes")
        assertValid(with("notes" to JsonNull))
    }

    @Test
    fun timestampsAreNormalizedToUtc() {
        val out = assertValid(text("pinnedAt", "2026-10-01T10:00:00+02:00"))
        assertEquals("2026-10-01T08:00:00Z", out["pinnedAt"]?.jsonPrimitive?.content)
        assertValid(text("archivedAt", "2026-10-12T15:04:05Z"))
        assertInvalid(text("archivedAt", "yesterday"), "archivedAt")
        assertInvalid(with("pinnedAt", "true"), "pinnedAt")
    }

    @Test
    fun categoryIdUsesTheIdRule() {
        assertValid(text("categoryId", "anniversaries"))
        assertValid(text("categoryId", "a".repeat(32)))
        assertInvalid(text("categoryId", "a".repeat(33)), "categoryId")
        assertInvalid(text("categoryId", "Work"), "categoryId")
    }

    @Test
    fun remindersAreASubsetOf0_1_7WithADefaultTime() {
        val out = assertValid(with("reminders", """{"daysBefore":[7,0]}"""))
        assertEquals(obj("""{"daysBefore":[0,7],"time":"09:00"}"""), out["reminders"])
        assertValid(with("reminders", """{"daysBefore":[0,1,7],"time":"18:30"}"""))
        assertValid(with("reminders", """{"daysBefore":[]}"""))
        assertValid(with("reminders" to JsonNull))
        for (bad in listOf(
            """{"daysBefore":[2]}""",
            """{"daysBefore":[1,1]}""",
            """{"daysBefore":[8]}""",
            """{"daysBefore":"0"}""",
            """{"time":"09:00"}""",
            """{"daysBefore":[0],"time":"9:00"}""",
            """{"daysBefore":[0],"time":"09:00:00"}""",
            """{"daysBefore":[0],"extra":1}""",
        )) {
            assertInvalid(with("reminders", bad))
        }
    }

    // New fields: backdrop.

    private val still = "Pz8aaaaaaaaaaaaaaaaaaa"
    private val motion = "Hq3bbbbbbbbbbbbbbbbbbb"

    @Test
    fun backdropKindsAndServerUrlsAreDropped() {
        val out = assertValid(
            with("backdrop", """{"kind":"animated","stillId":"$still","motionId":"$motion","dim":0.3,"blur":0,"stillUrl":"https://x/a.jpg","motionUrl":"https://x/a.mp4"}"""),
        )
        assertEquals(obj("""{"kind":"animated","stillId":"$still","motionId":"$motion","dim":0.3,"blur":0}"""), out["backdrop"])
        assertValid(with("backdrop", """{"kind":"still","stillId":"$still","dim":0}"""))
        assertValid(with("backdrop" to JsonNull))
    }

    @Test
    fun backdropDimAndBlurLimits() {
        for (dim in listOf("0", "0.8", "0.25")) assertValid(with("backdrop", """{"kind":"still","stillId":"$still","dim":$dim}"""))
        for (dim in listOf("-0.01", "0.81", "1", "\"0.5\"")) assertInvalid(with("backdrop", """{"kind":"still","stillId":"$still","dim":$dim}"""), "backdrop.dim")
        for (blur in listOf("0", "16", "7.5")) assertValid(with("backdrop", """{"kind":"still","stillId":"$still","dim":0,"blur":$blur}"""))
        for (blur in listOf("-1", "16.01", "true")) assertInvalid(with("backdrop", """{"kind":"still","stillId":"$still","dim":0,"blur":$blur}"""), "backdrop.blur")
    }

    @Test
    fun backdropShapeRules() {
        assertInvalid(with("backdrop", """{"kind":"animated","stillId":"$still","dim":0}"""), "backdrop.motionId")
        assertInvalid(with("backdrop", """{"kind":"still","stillId":"$still","motionId":"$motion","dim":0}"""), "backdrop.motionId")
        assertInvalid(with("backdrop", """{"kind":"gif","stillId":"$still","dim":0}"""), "backdrop.kind")
        assertInvalid(with("backdrop", """{"kind":"still","stillId":"short","dim":0}"""), "backdrop.stillId")
        assertInvalid(with("backdrop", """{"kind":"still","dim":0}"""), "backdrop.stillId")
        assertInvalid(with("backdrop", """{"kind":"still","stillId":"$still"}"""), "backdrop.dim")
        assertInvalid(with("backdrop", """{"kind":"still","stillId":"$still","dim":0,"url":"https://evil.test"}"""), "backdrop")
    }

    // New fields: audio.

    @Test
    fun audioKinds() {
        assertValid(with("audio", """{"kind":"library","trackId":"calm-lofi"}"""))
        assertValid(with("audio", """{"kind":"custom","mediaId":"$still","title":"First dance"}"""))
        assertValid(with("audio", """{"kind":"spotify","url":"https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT"}"""))
        assertValid(with("audio" to JsonNull))
        assertInvalid(with("audio", """{"kind":"youtube","url":"x"}"""), "audio.kind")
        assertInvalid(with("audio", """{"trackId":"calm-lofi"}"""), "audio.kind")
        assertInvalid(with("audio", """{"kind":"library","trackId":"Calm Lofi"}"""), "audio.trackId")
        assertInvalid(with("audio", """{"kind":"library","trackId":"calm","url":"x"}"""), "audio")
        assertInvalid(with("audio", """{"kind":"custom","mediaId":"$still"}"""), "audio.title")
        assertInvalid(with("audio", """{"kind":"custom","mediaId":"bad","title":"t"}"""), "audio.mediaId")
        assertInvalid(with("audio", "[]"), "audio")
    }

    @Test
    fun audioTextsAreAtMost200Characters() {
        assertValid(with("audio", """{"kind":"custom","mediaId":"$still","title":"${"a".repeat(200)}"}"""))
        assertInvalid(with("audio", """{"kind":"custom","mediaId":"$still","title":"${"a".repeat(201)}"}"""), "audio.title")
        val url = "https://open.spotify.com/album/4cOdK2wGLETKBW3PvgPWqT"
        assertValid(with("audio", """{"kind":"spotify","url":"$url","title":"${"t".repeat(200)}","artist":"${"a".repeat(200)}"}"""))
        assertInvalid(with("audio", """{"kind":"spotify","url":"$url","title":"${"t".repeat(201)}"}"""), "audio.title")
        assertInvalid(with("audio", """{"kind":"spotify","url":"$url","artist":"${"a".repeat(201)}"}"""), "audio.artist")
    }

    @Test
    fun spotifyUrlIsNormalizedAndOtherLinksRejected() {
        val out = assertValid(
            with("audio", """{"kind":"spotify","url":"https://open.spotify.com/intl-de/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc123","title":"Hits"}"""),
        )
        assertEquals("https://open.spotify.com/intl-de/playlist/37i9dQZF1DXcBWIGoYBM5M", out["audio"]?.jsonObject?.get("url")?.jsonPrimitive?.content)
        for (bad in listOf(
            "http://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
            "https://evil.test/track/4cOdK2wGLETKBW3PvgPWqT",
            "https://open.spotify.com/artist/4cOdK2wGLETKBW3PvgPWqT",
            "https://open.spotify.com.evil.test/track/4cOdK2wGLETKBW3PvgPWqT",
            "javascript:alert(1)",
        )) {
            assertInvalid(with("audio", """{"kind":"spotify","url":"$bad"}"""), "audio.url")
        }
    }

    // Patches.

    @Test
    fun patchAcceptsAnySubsetAndClearsNullableFields() {
        val result = EventValidation.validatePatch(obj("""{"title":" New ","backdrop":null,"notes":null,"pinnedAt":null}"""))
        assertIs<Validated.Valid<JsonObject>>(result)
        assertEquals(obj("""{"title":"New","backdrop":null,"notes":null,"pinnedAt":null}"""), result.value)
        assertIs<Validated.Valid<JsonObject>>(EventValidation.validatePatch(JsonObject(emptyMap())))
    }

    @Test
    fun patchCannotClearRequiredOrDefaultedFields() {
        for (name in listOf("title", "targetDate", "theme", "unitMode", "recurrence")) {
            val result = EventValidation.validatePatch(JsonObject(mapOf(name to JsonNull)))
            assertIs<Validated.Invalid>(result, name)
            assertEquals(name, result.errors.first().field)
        }
    }

    @Test
    fun patchRejectsUnknownAndServerFields() {
        for (name in listOf("id", "rev", "role", "updatedAt", "members", "archived", "memos", "ownerId")) {
            assertIs<Validated.Invalid>(EventValidation.validatePatch(JsonObject(mapOf(name to JsonPrimitive(1)))), name)
        }
    }

    // Document size.

    @Test
    fun documentSizeLimitIs16384Bytes() {
        fun docOfBytes(n: Int): JsonObject {
            val skeleton = buildJsonObject { put("notes", JsonPrimitive("")) }
            val overhead = ModelJson.encodeToString(JsonObject.serializer(), skeleton).length
            return buildJsonObject { put("notes", JsonPrimitive("a".repeat(n - overhead))) }
        }
        assertNull(EventValidation.checkDocumentSize(docOfBytes(16_384)))
        assertNotNull(EventValidation.checkDocumentSize(docOfBytes(16_385)))
    }

    @Test
    fun largestEventWithPlainNotesStaysUnder16KbButFourByteNotesDoNot() {
        // Field limits count characters; the 16 KB document limit counts bytes. 4,000 four-byte
        // characters of notes alone are 16,000 bytes, so the document check is still needed.
        val four = cp(0x1F600)
        val biggest = with(
            "title" to JsonPrimitive(four.repeat(100)),
            "notes" to JsonPrimitive("n".repeat(4000)),
            "timeZone" to JsonPrimitive("America/Argentina/ComodRivadavia"),
            "audio" to ModelJson.parseToJsonElement("""{"kind":"spotify","url":"https://open.spotify.com/intl-de/playlist/37i9dQZF1DXcBWIGoYBM5M","title":"${four.repeat(200)}","artist":"${four.repeat(200)}"}"""),
            "backdrop" to ModelJson.parseToJsonElement("""{"kind":"animated","stillId":"$still","motionId":"$motion","dim":0.8,"blur":16}"""),
            "reminders" to ModelJson.parseToJsonElement("""{"daysBefore":[0,1,7],"time":"09:00"}"""),
            "categoryId" to JsonPrimitive("c".repeat(32)),
            "pinnedAt" to JsonPrimitive("2026-10-01T08:00:00Z"),
            "archivedAt" to JsonPrimitive("2026-10-01T08:00:00Z"),
        )
        val out = assertValid(biggest)
        assertNull(EventValidation.checkDocumentSize(out))
        val heavy = assertValid(JsonObject(biggest + ("notes" to JsonPrimitive(four.repeat(4000)))))
        assertNotNull(EventValidation.checkDocumentSize(heavy))
    }
}

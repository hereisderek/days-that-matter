package dev.derek.daysthatmatter.core.model.validation

import dev.derek.daysthatmatter.core.model.ModelJson
import dev.derek.daysthatmatter.core.model.utf16Unit
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.time.Duration.Companion.days
import kotlin.time.Duration.Companion.seconds
import kotlin.time.Instant

class TextRulesTest {
    @Test
    fun graphemeCountForEmojiSequences() {
        assertEquals(0, TextRules.graphemeCount(""))
        assertEquals(1, TextRules.graphemeCount("a"))
        assertEquals(2, TextRules.graphemeCount("ab"))
        assertEquals(1, TextRules.graphemeCount("é"))
        assertEquals(1, TextRules.graphemeCount("🇫🇷"))
        assertEquals(2, TextRules.graphemeCount("🇫🇷🇩"))
        assertEquals(2, TextRules.graphemeCount("🇫🇷🇩🇪"))
        assertEquals(1, TextRules.graphemeCount("👨‍👩‍👧"))
        assertEquals(1, TextRules.graphemeCount("❤️"))
        assertEquals(2, TextRules.graphemeCount("😀😀"))
    }

    @Test
    fun loneSurrogatesAreFound() {
        val high = utf16Unit(0xD800)
        val low = utf16Unit(0xDC00)
        assertTrue(TextRules.hasLoneSurrogate(high))
        assertTrue(TextRules.hasLoneSurrogate("a$low"))
        assertTrue(TextRules.hasLoneSurrogate(high + "a"))
        assertFalse(TextRules.hasLoneSurrogate("\uD83D\uDE00"))
        assertEquals(listOf(0xD800, 'a'.code), TextRules.codePoints(high + "a"))
    }

    @Test
    fun forbiddenCharacters() {
        for (c in listOf(0x00, 0x1F, 0x7F, 0x85, 0x9F, 0x2028, 0x2029, 0x202A, 0x202E, 0x2066, 0x2069)) {
            assertTrue(TextRules.isForbidden(c), c.toString(16))
        }
        for (c in listOf(0x20, 0x41, 0xA0, 0x200D, 0x2030, 0x206A, 0x1F600)) assertFalse(TextRules.isForbidden(c), c.toString(16))
        assertTrue(TextRules.isForbidden('\n'.code))
        assertFalse(TextRules.isForbidden('\n'.code, multiLine = true))
        assertFalse(TextRules.isForbidden('\t'.code, multiLine = true))
        assertTrue(TextRules.isForbidden('\r'.code, multiLine = true))
    }

    @Test
    fun utf8Length() {
        assertEquals(4, TextRules.utf8Length("😀"))
        assertEquals(2, TextRules.utf8Length("é"))
    }
}

class SpotifyLinksTest {
    @Test
    fun parsesTracksAlbumsAndPlaylists() {
        val track = SpotifyLinks.parse("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=xyz#t=10")
        assertEquals(SpotifyLinks.Link(SpotifyLinks.Kind.Track, "4cOdK2wGLETKBW3PvgPWqT", "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT"), track)
        assertEquals(SpotifyLinks.Kind.Album, SpotifyLinks.parse("https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3/")?.kind)
        assertEquals(
            "https://open.spotify.com/intl-ja/playlist/37i9dQZF1DXcBWIGoYBM5M",
            SpotifyLinks.parse("https://open.spotify.com/intl-ja/playlist/37i9dQZF1DXcBWIGoYBM5M")?.url,
        )
    }

    @Test
    fun rejectsEverythingElse() {
        for (url in listOf(
            "",
            "https://open.spotify.com/",
            "https://open.spotify.com/track/short",
            "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqTX",
            "https://open.spotify.com/episode/4cOdK2wGLETKBW3PvgPWqT",
            "https://open.spotify.com/user/4cOdK2wGLETKBW3PvgPWqT",
            "https://open.spotify.com/intl-deu/track/4cOdK2wGLETKBW3PvgPWqT",
            "https://open.spotify.com:8443/track/4cOdK2wGLETKBW3PvgPWqT",
            "https://user@open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
            "HTTPS://OPEN.SPOTIFY.COM/track/4cOdK2wGLETKBW3PvgPWqT",
            "spotify:track:4cOdK2wGLETKBW3PvgPWqT",
            "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT\n",
            " https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
        )) {
            assertNull(SpotifyLinks.parse(url), url)
        }
    }
}

class MemoValidationTest {
    private fun obj(json: String): JsonObject = ModelJson.parseToJsonElement(json).jsonObject

    @Test
    fun newMemoNeedsContentAndCreatedAt() {
        assertIs<Validated.Valid<JsonObject>>(MemoValidation.validateNew(obj("""{"content":"Booked the venue.","createdAt":"2026-10-12T15:04:05Z"}""")))
        assertIs<Validated.Valid<JsonObject>>(
            MemoValidation.validateNew(obj("""{"content":"a\nb","milestoneTag":"Day 100","createdAt":"2026-10-12T15:04:05Z"}""")),
        )
        assertEquals("content", (MemoValidation.validateNew(obj("""{"createdAt":"2026-10-12T15:04:05Z"}""")) as Validated.Invalid).errors.first().field)
        assertEquals("createdAt", (MemoValidation.validateNew(obj("""{"content":"x"}""")) as Validated.Invalid).errors.first().field)
    }

    @Test
    fun contentLimitIs10000Characters() {
        fun memo(content: String) = JsonObject(mapOf("content" to JsonPrimitive(content), "createdAt" to JsonPrimitive("2026-10-12T15:04:05Z")))
        assertIs<Validated.Valid<JsonObject>>(MemoValidation.validateNew(memo("a".repeat(10_000))))
        assertIs<Validated.Invalid>(MemoValidation.validateNew(memo("a".repeat(10_001))))
        assertIs<Validated.Invalid>(MemoValidation.validateNew(memo("  \n ")))
        assertIs<Validated.Invalid>(MemoValidation.validateNew(memo("a‮b")))
    }

    @Test
    fun milestoneTagUsesTheTitleRule() {
        fun tag(value: String) = MemoValidation.validatePatch(JsonObject(mapOf("milestoneTag" to JsonPrimitive(value))))
        assertIs<Validated.Valid<JsonObject>>(tag("a".repeat(100)))
        assertIs<Validated.Invalid>(tag("a".repeat(101)))
        assertIs<Validated.Invalid>(tag("a\nb"))
        assertIs<Validated.Invalid>(tag(" "))
        val trimmed = tag(" Day 100 ") as Validated.Valid
        assertEquals("Day 100", trimmed.value["milestoneTag"]?.jsonPrimitive?.content)
    }

    @Test
    fun patchClearsTagOnlyAndRejectsUnknownFields() {
        assertIs<Validated.Valid<JsonObject>>(MemoValidation.validatePatch(obj("""{"milestoneTag":null}""")))
        assertIs<Validated.Invalid>(MemoValidation.validatePatch(obj("""{"content":null}""")))
        assertIs<Validated.Invalid>(MemoValidation.validatePatch(obj("""{"createdAt":null}""")))
        assertIs<Validated.Invalid>(MemoValidation.validatePatch(obj("""{"authorId":"a"}""")))
        assertIs<Validated.Invalid>(MemoValidation.validatePatch(obj("""{"createdAt":"soon"}""")))
    }

    @Test
    fun memoCountLimitIs500() {
        assertTrue(MemoValidation.canAdd(499))
        assertFalse(MemoValidation.canAdd(500))
        assertFalse(MemoValidation.canAdd(501))
    }
}

class SharingValidationTest {
    private val now = Instant.parse("2026-10-12T15:04:05Z")

    private fun obj(json: String): JsonObject = ModelJson.parseToJsonElement(json).jsonObject

    @Test
    fun linkDefaultsToNeverAndAcceptsLabel() {
        val result = SharingValidation.validateNewLink(obj("""{"label":" Instagram "}"""), now) as Validated.Valid
        assertEquals(JsonPrimitive("Instagram"), result.value["label"])
        assertEquals(JsonNull, result.value["expiresAt"])
        val empty = SharingValidation.validateNewLink(JsonObject(emptyMap()), now) as Validated.Valid
        assertEquals(JsonNull, empty.value["expiresAt"])
    }

    @Test
    fun linkLabelUsesTheTitleRule() {
        assertIs<Validated.Valid<JsonObject>>(SharingValidation.validateNewLink(obj("""{"label":"${"a".repeat(100)}"}"""), now))
        assertIs<Validated.Invalid>(SharingValidation.validateNewLink(obj("""{"label":"${"a".repeat(101)}"}"""), now))
        assertIs<Validated.Invalid>(SharingValidation.validateNewLink(obj("""{"label":""}"""), now))
        assertIs<Validated.Valid<JsonObject>>(SharingValidation.validateLinkPatch(obj("""{"label":null}"""), now))
    }

    @Test
    fun expiryAtAndPastFiveYears() {
        val max = SharingValidation.maxExpiry(now)
        assertEquals(Instant.parse("2031-10-12T15:04:05Z"), max)
        fun link(at: Instant) = SharingValidation.validateNewLink(JsonObject(mapOf("expiresAt" to JsonPrimitive(at.toString()))), now)
        assertIs<Validated.Valid<JsonObject>>(link(max))
        assertIs<Validated.Invalid>(link(max + 1.seconds))
        assertIs<Validated.Valid<JsonObject>>(link(now + 1.seconds))
        assertIs<Validated.Invalid>(link(now))
        assertIs<Validated.Invalid>(link(now - 1.days))
        assertTrue(SharingValidation.isValidExpiry(null, now))
    }

    @Test
    fun expiryPresets() {
        assertEquals(now + 5.days, ExpiryPreset.FiveDays.expiresAt(now))
        assertEquals(now + 30.days, ExpiryPreset.ThirtyDays.expiresAt(now))
        assertNull(ExpiryPreset.Never.expiresAt(now))
        for (preset in ExpiryPreset.entries) assertTrue(SharingValidation.isValidExpiry(preset.expiresAt(now), now))
    }

    @Test
    fun inviteDefaultsToOneUseAnd30Days() {
        val result = SharingValidation.validateNewInvite(obj("""{"role":"editor"}"""), now) as Validated.Valid
        assertEquals(JsonPrimitive(1), result.value["maxUses"])
        assertEquals(JsonPrimitive((now + 30.days).toString()), result.value["expiresAt"])
        assertEquals(JsonPrimitive("editor"), result.value["role"])
    }

    @Test
    fun inviteUseCountsAtAndPastLimits() {
        fun invite(uses: String) = SharingValidation.validateNewInvite(obj("""{"role":"viewer","maxUses":$uses}"""), now)
        for (ok in listOf("1", "5", "10", "100", "null")) assertIs<Validated.Valid<JsonObject>>(invite(ok), ok)
        for (bad in listOf("0", "101", "-1", "1.5", "\"5\"")) assertIs<Validated.Invalid>(invite(bad), bad)
        assertEquals(listOf(1, 5, 10, null), UseCountPreset.entries.map { it.maxUses })
        assertTrue(UseCountPreset.entries.all { SharingValidation.isValidMaxUses(it.maxUses) })
        assertFalse(SharingValidation.isValidMaxUses(0))
        assertFalse(SharingValidation.isValidMaxUses(101))
    }

    @Test
    fun inviteRoleIsRequiredAndNeverOwner() {
        assertEquals("role", (SharingValidation.validateNewInvite(JsonObject(emptyMap()), now) as Validated.Invalid).errors.first().field)
        assertIs<Validated.Invalid>(SharingValidation.validateNewInvite(obj("""{"role":"owner"}"""), now))
        assertIs<Validated.Invalid>(SharingValidation.validateNewInvite(obj("""{"role":"viewer","token":"x"}"""), now))
    }

    @Test
    fun invitePatchChangesOnlyWhatIsSent() {
        val result = SharingValidation.validateInvitePatch(obj("""{"maxUses":null,"expiresAt":null}"""), now) as Validated.Valid
        assertEquals(setOf("maxUses", "expiresAt"), result.value.keys)
        assertEquals(JsonNull, result.value["maxUses"])
        assertIs<Validated.Invalid>(SharingValidation.validateInvitePatch(obj("""{"useCount":3}"""), now))
    }
}

class MembershipValidationTest {
    private fun obj(json: String): JsonObject = ModelJson.parseToJsonElement(json).jsonObject

    @Test
    fun archivedAndReminders() {
        val result = MembershipValidation.validatePatch(obj("""{"archived": true, "reminders": {"daysBefore": [1], "time": "09:00"}}""")) as Validated.Valid
        assertEquals(obj("""{"archived":true,"reminders":{"daysBefore":[1],"time":"09:00"}}"""), result.value)
        assertIs<Validated.Valid<JsonObject>>(MembershipValidation.validatePatch(obj("""{"reminders": null}""")))
        assertIs<Validated.Invalid>(MembershipValidation.validatePatch(obj("""{"archived": "yes"}""")))
        assertIs<Validated.Invalid>(MembershipValidation.validatePatch(obj("""{"archived": null}""")))
        assertIs<Validated.Invalid>(MembershipValidation.validatePatch(obj("""{"pinnedAt": "2026-10-12T15:04:05Z"}""")))
        assertIs<Validated.Invalid>(MembershipValidation.validatePatch(obj("""{"reminders": {"daysBefore": [3]}}""")))
    }
}

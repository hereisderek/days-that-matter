package dev.derek.daysthatmatter.core.model.access

import dev.derek.daysthatmatter.core.model.ModelJson
import dev.derek.daysthatmatter.core.model.api.ApiErrorCode
import dev.derek.daysthatmatter.core.model.event.Audio
import dev.derek.daysthatmatter.core.model.event.Backdrop
import dev.derek.daysthatmatter.core.model.event.BackdropKind
import dev.derek.daysthatmatter.core.model.event.EventDoc
import dev.derek.daysthatmatter.core.model.event.EventFields
import dev.derek.daysthatmatter.core.model.event.MemberName
import dev.derek.daysthatmatter.core.model.event.MemberRole
import dev.derek.daysthatmatter.core.model.event.Membership
import dev.derek.daysthatmatter.core.model.event.PublicEvent
import dev.derek.daysthatmatter.core.model.event.Recurrence
import dev.derek.daysthatmatter.core.model.event.Reminders
import dev.derek.daysthatmatter.core.model.event.Role
import dev.derek.daysthatmatter.core.model.event.Theme
import dev.derek.daysthatmatter.core.model.event.UnitMode
import kotlinx.datetime.LocalDate
import kotlinx.datetime.LocalTime
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.time.Instant

/** Role projections: no owner-only data or account identifiers outside the owner's projection. */
class ProjectionsTest {
    private val ownerAccountId = "acct-owner-7f3a"
    private val editorAccountId = "acct-editor-91bc"

    private val stored = EventDoc(
        id = "0b8f3c1e",
        rev = 9,
        title = "Our wedding",
        emoji = "💍",
        targetDate = LocalDate(2027, 6, 12),
        targetTime = LocalTime(16, 30),
        timeZone = "Europe/Paris",
        unitMode = UnitMode.Workdays,
        recurrence = Recurrence.Yearly(2027),
        theme = Theme("violet", "glass", "modern"),
        backdrop = Backdrop(BackdropKind.Still, "Pz8aaaaaaaaaaaaaaaaaaa", dim = 0.3, stillUrl = "https://media/m/Pz8.jpg"),
        audio = Audio.Custom("Qm7aaaaaaaaaaaaaaaaaaa", "First dance"),
        notes = "SECRET NOTE",
        pinnedAt = Instant.parse("2026-10-01T08:00:00Z"),
        categoryId = "anniversaries",
        archivedAt = Instant.parse("2026-10-02T08:00:00Z"),
        reminders = Reminders(listOf(0, 7)),
        updatedAt = Instant.parse("2026-10-12T15:04:05Z"),
    )

    private val members = listOf(MemberName("Derek", Role.Owner), MemberName("Mum", Role.Editor))
    private val memberSettings = Membership(archivedAt = null, reminders = Reminders(listOf(1)))

    private fun keys(element: JsonElement): Set<String> {
        val out = mutableSetOf<String>()
        fun walk(e: JsonElement) {
            when (e) {
                is JsonObject -> e.forEach { (k, v) ->
                    out += k
                    walk(v)
                }
                is kotlinx.serialization.json.JsonArray -> e.forEach(::walk)
                else -> Unit
            }
        }
        walk(element)
        return out
    }

    private fun json(doc: EventDoc): JsonObject = ModelJson.encodeToJsonElement(EventDoc.serializer(), doc).jsonObject

    private fun json(doc: PublicEvent): JsonObject = ModelJson.encodeToJsonElement(PublicEvent.serializer(), doc).jsonObject

    private val ownerOnlyKeys = setOf("notes", "pinnedAt", "categoryId", "archivedAt", "memos")
    private val accountKeys = setOf("ownerId", "accountId", "authorId", "uploaderId", "email")

    @Test
    fun ownerSeesEverything() {
        val owner = Projections.owner(stored)
        assertEquals(Role.Owner, owner.role)
        assertEquals("SECRET NOTE", owner.notes)
        assertEquals(stored.pinnedAt, owner.pinnedAt)
        assertEquals(stored.archivedAt, owner.archivedAt)
        assertEquals(stored.reminders, owner.reminders)
        assertTrue(EventFields.OWNER_ONLY.all { it in json(owner) })
    }

    @Test
    fun editorAndViewerGetSharedFieldsAndTheirOwnSettingsOnly() {
        for (role in MemberRole.entries) {
            val view = Projections.member(stored, role, members, memberSettings)
            val j = json(view)
            assertEquals(role.role, view.role)
            assertTrue((keys(j) intersect ownerOnlyKeys).isEmpty(), "$role: ${j.keys}")
            assertTrue((keys(j) intersect accountKeys).isEmpty(), "$role: ${j.keys}")
            assertFalse(ModelJson.encodeToString(EventDoc.serializer(), view).contains("SECRET NOTE"))
            assertFalse(ModelJson.encodeToString(EventDoc.serializer(), view).contains(ownerAccountId))
            assertEquals(memberSettings.reminders, view.reminders)
            assertEquals(false, view.archived)
            assertEquals(members, view.members)
            for (field in EventFields.SHARED - setOf("emoji")) assertTrue(field in j, "$role misses $field")
        }
    }

    @Test
    fun memberArchiveIsTheirOwnAndNeverTheOwners() {
        val notArchivedByMember = Projections.member(stored, MemberRole.Viewer, members, Membership())
        assertEquals(false, notArchivedByMember.archived)
        assertNull(notArchivedByMember.archivedAt)
        assertNull(notArchivedByMember.reminders)
        val archivedByMember = Projections.member(stored.copy(archivedAt = null), MemberRole.Editor, members, Membership(Instant.parse("2026-10-12T00:00:00Z")))
        assertEquals(true, archivedByMember.archived)
        assertNull(archivedByMember.archivedAt)
    }

    @Test
    fun membersKeepCustomAudio() {
        assertEquals(stored.audio, Projections.member(stored, MemberRole.Viewer, members, memberSettings).audio)
    }

    @Test
    fun publicLinkHasSharedFieldsOnlyAndNoCustomAudio() {
        val public = Projections.publicLink(stored)
        val j = json(public)
        assertNull(public.audio)
        assertTrue((keys(j) intersect (ownerOnlyKeys + accountKeys + setOf("id", "role", "members", "reminders", "archived", "updatedAt"))).isEmpty(), j.keys.toString())
        assertEquals(9, public.rev)
        assertEquals(stored.backdrop, public.backdrop)
        assertEquals(UnitMode.Workdays, public.unitMode)
        val text = ModelJson.encodeToString(PublicEvent.serializer(), public)
        assertFalse("Derek" in text || "Mum" in text || ownerAccountId in text || editorAccountId in text || "SECRET" in text)
    }

    @Test
    fun publicLinkKeepsBuiltInAndSpotifyAudio() {
        val library = Audio.Library("calm-lofi")
        val spotify = Audio.Spotify("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT", "Song", "Artist")
        assertEquals(library, Projections.publicLink(stored.copy(audio = library)).audio)
        assertEquals(spotify, Projections.publicLink(stored.copy(audio = spotify)).audio)
    }

    @Test
    fun viewersWriteNothing() {
        assertEquals(ApiErrorCode.Forbidden, WriteAccess.checkEventWrite(Role.Viewer, setOf("unitMode")))
        assertEquals(ApiErrorCode.Forbidden, WriteAccess.checkEventWrite(Role.Viewer, setOf("backdrop")))
        assertEquals(ApiErrorCode.Forbidden, WriteAccess.checkEventWrite(Role.Viewer, emptySet()))
    }

    @Test
    fun editorsWriteSharedFieldsOnly() {
        assertNull(WriteAccess.checkEventWrite(Role.Editor, EventFields.SHARED))
        for (field in EventFields.OWNER_ONLY) {
            assertEquals(ApiErrorCode.FieldNotAllowed, WriteAccess.checkEventWrite(Role.Editor, setOf("title", field)), field)
        }
    }

    @Test
    fun ownersWriteEverything() {
        assertNull(WriteAccess.checkEventWrite(Role.Owner, EventFields.WRITABLE))
    }

    @Test
    fun ownerOnlyActions() {
        assertEquals(listOf(true, false, false), Role.entries.map(WriteAccess::canManageSharing))
        assertEquals(listOf(true, false, false), Role.entries.map(WriteAccess::canWriteMemos))
        assertEquals(listOf(true, false, false), Role.entries.map(WriteAccess::canDeleteEvent))
        assertEquals(listOf(true, false, false), Role.entries.map(WriteAccess::canPin))
        assertEquals(listOf(true, true, false), Role.entries.map(WriteAccess::canSeeHistory))
    }
}

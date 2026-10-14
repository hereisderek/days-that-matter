package dev.derek.daysthatmatter.core.database

import dev.derek.daysthatmatter.core.database.event.EventRowMeta
import dev.derek.daysthatmatter.core.database.event.rowMeta
import dev.derek.daysthatmatter.core.database.event.toEntity
import dev.derek.daysthatmatter.core.database.event.toEventDoc
import dev.derek.daysthatmatter.core.database.memo.toEntity
import dev.derek.daysthatmatter.core.database.memo.toMemo
import dev.derek.daysthatmatter.core.model.event.Audio
import dev.derek.daysthatmatter.core.model.event.Backdrop
import dev.derek.daysthatmatter.core.model.event.BackdropKind
import dev.derek.daysthatmatter.core.model.event.CardSize
import dev.derek.daysthatmatter.core.model.event.EventDoc
import dev.derek.daysthatmatter.core.model.event.Memo
import dev.derek.daysthatmatter.core.model.event.Recurrence
import dev.derek.daysthatmatter.core.model.event.Reminders
import dev.derek.daysthatmatter.core.model.event.Role
import dev.derek.daysthatmatter.core.model.event.Theme
import dev.derek.daysthatmatter.core.model.event.UnitMode
import kotlinx.datetime.LocalDate
import kotlinx.datetime.LocalTime
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.time.Instant

class EventMappersTest {

    private val full = EventDoc(
        id = "norway",
        rev = 7,
        role = Role.Owner,
        title = "Norway trip",
        emoji = "🏔️",
        targetDate = LocalDate(2026, 11, 21),
        targetTime = LocalTime(9, 30, 15),
        timeZone = "Europe/Oslo",
        unitMode = UnitMode.Workdays,
        recurrence = Recurrence.Yearly(2020),
        theme = Theme("lagoon", "poster", "serif", gradient = listOf("#112233", "#445566"), size = CardSize.Large),
        backdrop = Backdrop(BackdropKind.Animated, stillId = "s1", motionId = "m1", dim = 0.3, blur = 4.0),
        audio = Audio.Spotify("https://open.spotify.com/track/x", title = "Song", artist = "Band"),
        notes = "Rain jackets",
        pinnedAt = Instant.parse("2026-10-01T10:00:00Z"),
        categoryId = "travel",
        archivedAt = null,
        reminders = Reminders(listOf(0, 7), LocalTime(8, 15)),
        updatedAt = Instant.parse("2026-10-14T09:00:00Z"),
    )

    @Test
    fun everyFieldSurvivesTheRoundTrip() {
        val meta = EventRowMeta(createdAt = T0, updatedAt = Instant.parse("2026-10-14T09:00:00Z"), serverRev = 7, childSeq = 3, pendingPatch = "{\"title\":\"x\"}")

        val entity = full.toEntity(meta)

        assertEquals(full, entity.toEventDoc())
        assertEquals(meta, entity.rowMeta())
    }

    @Test
    fun columnsHoldTheApiValues() {
        val entity = full.toEntity(EventRowMeta(createdAt = T0, updatedAt = T0))

        assertEquals("workdays", entity.unitMode)
        assertEquals("owner", entity.role)
        assertEquals(9 * 3600 + 30 * 60 + 15, entity.targetTimeSeconds)
        assertEquals(LocalDate(2026, 11, 21).toEpochDays().toInt(), entity.targetDateEpochDays)
        assertEquals("""{"type":"yearly","originalYear":2020}""", entity.recurrenceJson)
        assertEquals("""{"daysBefore":[0,7],"time":"08:15"}""", entity.remindersJson)
        assertEquals("""{"kind":"spotify","url":"https://open.spotify.com/track/x","title":"Song","artist":"Band"}""", entity.audioJson)
    }

    @Test
    fun aMinimalDocumentKeepsItsDefaults() {
        val minimal = doc("a", role = null)

        val back = minimal.toEntity(EventRowMeta(createdAt = T0, updatedAt = T0)).toEventDoc()

        assertEquals(Role.Owner, back.role)
        assertEquals(UnitMode.Auto, back.unitMode)
        assertEquals(Recurrence.None, back.recurrence)
        assertEquals(CardSize.Medium, back.theme.size)
        assertNull(back.targetTime)
        assertNull(back.backdrop)
        assertNull(back.audio)
        assertNull(back.reminders)
        assertEquals(0, back.rev)
    }

    @Test
    fun aSharedDayKeepsItsRole() {
        val shared = doc("g", role = Role.Editor)

        assertEquals(Role.Editor, shared.row().toEventDoc().role)
        assertEquals("editor", shared.row().role)
    }

    @Test
    fun memoRoundTrip() {
        val memo = Memo(
            id = "m1",
            eventId = "together",
            seq = 4,
            content = "Day 1,000",
            milestoneTag = "Day 1,000",
            createdAt = Instant.parse("2024-02-13T10:00:00Z"),
            updatedAt = Instant.parse("2024-02-14T10:00:00Z"),
        )

        assertEquals(memo, memo.toEntity().toMemo())
    }

    @Test
    fun anUnsyncedMemoHasNoSeq() {
        val memo = Memo(id = "m2", eventId = "e", content = "x", createdAt = T0)

        val entity = memo.toEntity()

        assertNull(entity.seq)
        assertEquals(T0.toEpochMilliseconds(), entity.updatedAtEpochMillis)
        assertEquals(memo.copy(updatedAt = T0), entity.toMemo())
    }
}

package dev.derek.daysthatmatter.feature.eventeditor.domain

import dev.derek.daysthatmatter.core.model.event.Audio
import dev.derek.daysthatmatter.core.model.event.CardSize
import dev.derek.daysthatmatter.core.model.event.Recurrence
import dev.derek.daysthatmatter.core.model.event.Reminders
import dev.derek.daysthatmatter.core.model.event.Role
import dev.derek.daysthatmatter.core.model.event.UnitMode
import dev.derek.daysthatmatter.feature.eventeditor.NOW
import dev.derek.daysthatmatter.feature.eventeditor.event
import kotlinx.datetime.LocalDate
import kotlinx.datetime.LocalTime
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.time.Duration.Companion.days

class EventDraftTest {

    @Test
    fun storedDaysRoundTripThroughTheDraft() {
        val docs = listOf(
            event("one-time"),
            event("timed", time = LocalTime(9, 30), zone = "Europe/Oslo", category = "travel", notes = "Pack boots"),
            event("yearly", recurrence = Recurrence.Yearly(2019), date = LocalDate(2019, 5, 20), size = CardSize.Large),
            event("anchored", recurrence = Recurrence.Yearly(1990), date = LocalDate(2026, 3, 1)),
            event("monthly", recurrence = Recurrence.Monthly, unitMode = UnitMode.Workdays),
            event("weekly", recurrence = Recurrence.Weekly, emoji = null),
            event("custom", recurrence = Recurrence.CustomDays(10), size = CardSize.Small),
            event("pinned", pinnedAt = NOW - 3.days, archivedAt = null),
            event("archived", archivedAt = NOW - 1.days),
            event("gradient", gradient = listOf("#112233", "#445566")),
            event("synced", rev = 7, role = Role.Owner).copy(
                audio = Audio.Library("gymnopedie"),
                reminders = Reminders(listOf(0, 7)),
                updatedAt = NOW - 2.days,
            ),
        )
        for (doc in docs) {
            assertEquals(doc, EventDraft.of(doc).toEventDoc(doc.id, base = doc, now = NOW), doc.id)
        }
    }

    @Test
    fun aNewDraftIsOwnedUnsyncedAndUsesTheV2Defaults() {
        val draft = EventDraft.new(LocalDate(2026, 11, 13), "Europe/Oslo").copy(title = "  Norway trip ")
        val doc = draft.toEventDoc("new", base = null, now = NOW)

        assertEquals(Role.Owner, doc.role)
        assertEquals(0, doc.rev)
        assertEquals("Norway trip", doc.title)
        assertEquals("✨", doc.emoji)
        assertEquals("Europe/Oslo", doc.timeZone)
        assertEquals("life", doc.categoryId)
        assertEquals("lagoon", doc.theme.paletteId)
        assertEquals("glass", doc.theme.cardStyle)
        assertEquals("sans", doc.theme.typography)
        assertEquals(CardSize.Medium, doc.theme.size)
        assertEquals(Recurrence.None, doc.recurrence)
        assertNull(doc.notes)
        assertNull(doc.pinnedAt)
    }

    @Test
    fun aPinSwitchedOnGetsTheTimeAndAnOldPinKeepsItsTime() {
        val pinnedBefore = NOW - 5.days
        val stored = event("a", pinnedAt = pinnedBefore)
        assertEquals(pinnedBefore, EventDraft.of(stored).toEventDoc("a", stored, NOW).pinnedAt)

        val unpinned = event("b")
        assertEquals(NOW, EventDraft.of(unpinned).copy(pinned = true).toEventDoc("b", unpinned, NOW).pinnedAt)
        assertNull(EventDraft.of(stored).copy(pinned = false).toEventDoc("a", stored, NOW).pinnedAt)
    }

    @Test
    fun repeatChoicesMapToRecurrences() {
        val draft = EventDraft.new(LocalDate(2027, 2, 14), "UTC")
        assertEquals(Recurrence.Yearly(2027), draft.copy(repeat = RepeatKind.Yearly).recurrence)
        assertEquals(Recurrence.Yearly(2001), draft.copy(repeat = RepeatKind.Yearly, originalYear = 2001).recurrence)
        assertEquals(Recurrence.Monthly, draft.copy(repeat = RepeatKind.Monthly).recurrence)
        assertEquals(Recurrence.Weekly, draft.copy(repeat = RepeatKind.Weekly).recurrence)
        assertEquals(Recurrence.CustomDays(21), draft.copy(repeat = RepeatKind.EveryNDays, everyDays = " 21 ").recurrence)
        assertEquals(Recurrence.CustomDays(0), draft.copy(repeat = RepeatKind.EveryNDays, everyDays = "ten").recurrence)
    }

    @Test
    fun blankNotesClearTheField() {
        val stored = event("a", notes = "Old note")
        assertNull(EventDraft.of(stored).copy(notes = "   ").toEventDoc("a", stored, NOW).notes)
    }
}

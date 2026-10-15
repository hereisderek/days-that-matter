package dev.derek.daysthatmatter.feature.eventeditor.domain

import dev.derek.daysthatmatter.core.model.event.CardSize
import dev.derek.daysthatmatter.core.model.event.EventFields
import dev.derek.daysthatmatter.core.model.event.Recurrence
import dev.derek.daysthatmatter.core.model.validation.FieldError
import dev.derek.daysthatmatter.core.model.validation.Limits
import dev.derek.daysthatmatter.feature.eventeditor.NOW
import dev.derek.daysthatmatter.feature.eventeditor.event
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class EventWriteChecksTest {

    private fun fieldsWithErrors(title: String = "Trip", notes: String? = null, recurrence: Recurrence = Recurrence.None) =
        EventWriteChecks.errorsOf(event("a", title = title, notes = notes, recurrence = recurrence)).map { DraftField.of(it.field) }

    @Test
    fun aValidDayHasNoErrors() {
        assertEquals(emptyList(), fieldsWithErrors())
        assertEquals(emptyList(), fieldsWithErrors(title = "x".repeat(Limits.TITLE_MAX_CHARS)))
        assertEquals(emptyList(), fieldsWithErrors(recurrence = Recurrence.CustomDays(Limits.CUSTOM_DAYS_MAX)))
    }

    @Test
    fun theLimitsOfEventValidationApply() {
        assertEquals(listOf(DraftField.Title), fieldsWithErrors(title = ""))
        assertEquals(listOf(DraftField.Title), fieldsWithErrors(title = "x".repeat(Limits.TITLE_MAX_CHARS + 1)))
        assertEquals(listOf(DraftField.Title), fieldsWithErrors(title = "bad‮text"))
        assertEquals(listOf(DraftField.Notes), fieldsWithErrors(notes = "n".repeat(Limits.NOTES_MAX_CHARS + 1)))
        assertEquals(listOf(DraftField.EveryDays), fieldsWithErrors(recurrence = Recurrence.CustomDays(0)))
        assertEquals(listOf(DraftField.EveryDays), fieldsWithErrors(recurrence = Recurrence.CustomDays(Limits.CUSTOM_DAYS_MAX + 1)))
        assertEquals(
            listOf(DraftField.TimeZone),
            EventWriteChecks.errorsOf(event("a", zone = "Mars/Olympus")).map { DraftField.of(it.field) },
        )
    }

    @Test
    fun theDocumentSizeIsChecked() {
        // 4,000 four-byte characters fit the notes rule but not the 16 KB document.
        val errors = EventWriteChecks.errorsOf(event("a", title = "😀".repeat(100), notes = "😀".repeat(Limits.NOTES_MAX_CHARS)))
        assertEquals(listOf(DraftField.Other), errors.map { DraftField.of(it.field) })
    }

    @Test
    fun messagesNameTheFieldAndKeepTheReason() {
        assertEquals("Title must be 1 to 100 characters", EventWriteChecks.message(FieldError("title", "must be 1 to 100 characters")))
        assertEquals("Every N days must be 1 to 3650", EventWriteChecks.message(FieldError("recurrence.days", "must be 1 to 3650")))
        assertEquals("Time zone: invalid time zone", EventWriteChecks.message(FieldError("timeZone", "invalid time zone")))
        assertEquals("This day: event document exceeds 16384 bytes", EventWriteChecks.message(FieldError("", "event document exceeds 16384 bytes")))
    }

    @Test
    fun validationPathsMapToEditorFields() {
        assertEquals(DraftField.Repeat, DraftField.of("recurrence.originalYear"))
        assertEquals(DraftField.Look, DraftField.of("theme.size"))
        assertEquals(DraftField.Category, DraftField.of(EventFields.CATEGORY_ID))
        assertEquals(DraftField.Unit, DraftField.of(EventFields.UNIT_MODE))
        assertEquals(DraftField.Date, DraftField.of(EventFields.TARGET_DATE))
        assertEquals(DraftField.Other, DraftField.of(EventFields.REMINDERS))
    }

    @Test
    fun thePatchHoldsOnlyChangedWritableFields() {
        val old = event("a", rev = 4, notes = "Keep", size = CardSize.Medium)
        val new = old.copy(title = "New title", notes = null, theme = old.theme.copy(size = CardSize.Large), updatedAt = NOW)

        val patch = EventWriteChecks.patch(old, new)

        assertEquals(setOf(EventFields.NOTES, EventFields.THEME, EventFields.TITLE), patch.keys)
        assertEquals(JsonPrimitive("New title"), patch[EventFields.TITLE])
        assertEquals(JsonNull, patch[EventFields.NOTES])
        assertEquals(JsonPrimitive("large"), patch.getValue(EventFields.THEME).jsonObject["size"])
        assertEquals(emptyList(), EventWriteChecks.errorsOfPatch(patch))
        assertEquals(JsonObject(emptyMap()), EventWriteChecks.patch(old, old.copy(updatedAt = NOW)))
    }

    @Test
    fun applyingAPatchKeepsOtherFieldsStoredMeanwhile() {
        val original = event("a", rev = 4, title = "Old", category = "travel")
        val edited = original.copy(title = "New")
        // Meanwhile the stored day was archived and moved to another category.
        val current = original.copy(archivedAt = NOW, categoryId = "work", rev = 5)

        val merged = EventWriteChecks.apply(current, EventWriteChecks.patch(original, edited))

        assertEquals(current.copy(title = "New"), merged)
    }

    @Test
    fun anInvalidPatchIsReported() {
        val old = event("a")
        val patch = EventWriteChecks.patch(old, old.copy(title = ""))
        assertTrue(EventWriteChecks.errorsOfPatch(patch).any { it.field == EventFields.TITLE })
    }
}

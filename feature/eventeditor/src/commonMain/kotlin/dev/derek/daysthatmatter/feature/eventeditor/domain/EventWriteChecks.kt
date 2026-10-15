package dev.derek.daysthatmatter.feature.eventeditor.domain

import dev.derek.daysthatmatter.core.model.ModelJson
import dev.derek.daysthatmatter.core.model.event.EventDoc
import dev.derek.daysthatmatter.core.model.event.EventFields
import dev.derek.daysthatmatter.core.model.merge.PatchMerge
import dev.derek.daysthatmatter.core.model.validation.EventValidation
import dev.derek.daysthatmatter.core.model.validation.FieldError
import dev.derek.daysthatmatter.core.model.validation.Validated
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject

/** The fields of the editor that a validation error can point at. */
enum class DraftField(val label: String) {
    Title("Title"),
    Emoji("Emoji"),
    Date("Date"),
    Time("Time"),
    TimeZone("Time zone"),
    Repeat("Repeat"),
    EveryDays("Every N days"),
    Category("Category"),
    Notes("Notes"),
    Unit("Count in"),
    Look("Look"),

    /** The document as a whole (its size) or a field the editor does not show. */
    Other("This day"),
    ;

    companion object {
        /** The editor field of a validation path (`title`, `recurrence.days`, `theme.gradient`). */
        fun of(path: String): DraftField = when (path.substringBefore('.')) {
            EventFields.TITLE -> Title
            EventFields.EMOJI -> Emoji
            EventFields.TARGET_DATE -> Date
            EventFields.TARGET_TIME -> Time
            EventFields.TIME_ZONE -> TimeZone
            EventFields.RECURRENCE -> if (path == "${EventFields.RECURRENCE}.days") EveryDays else Repeat
            EventFields.CATEGORY_ID -> Category
            EventFields.NOTES -> Notes
            EventFields.UNIT_MODE -> Unit
            EventFields.THEME -> Look
            else -> Other
        }
    }
}

/**
 * Checks and patches of event writes, built on `:core:model` (`EventValidation`, `PatchMerge`) so the editor
 * enforces exactly the limits the backend enforces. Nothing here repeats a limit.
 */
object EventWriteChecks {
    /** Writes every field, defaults and nulls included, so a change to a default value or a cleared field shows up. */
    private val fullJson: Json = Json(ModelJson) {
        encodeDefaults = true
        explicitNulls = true
    }

    /** The writable fields of [doc] in API form, without empty values (the body of `PUT /events/{id}`). */
    fun writableFields(doc: EventDoc): JsonObject =
        JsonObject(ModelJson.encodeToJsonElement(EventDoc.serializer(), doc).jsonObject.filterKeys { it in EventFields.WRITABLE })

    /** The validation errors of [doc] as a new document: field rules and the document size. */
    fun errorsOf(doc: EventDoc): List<FieldError> {
        val fields = writableFields(doc)
        val result = EventValidation.validateNew(fields)
        if (result is Validated.Invalid) return result.errors
        return listOfNotNull(EventValidation.checkDocumentSize(fields))
    }

    /** The validation errors of [patch], the changed fields of an edit. */
    fun errorsOfPatch(patch: JsonObject): List<FieldError> =
        (EventValidation.validatePatch(patch) as? Validated.Invalid)?.errors.orEmpty()

    /**
     * The patch from [old] to [new]: the writable fields ([EventFields.WRITABLE]) whose value differs, `null` for a
     * cleared one. The same form as `PATCH /events/{id}` and the row's `pending_patch`.
     */
    fun patch(old: EventDoc, new: EventDoc): JsonObject {
        val before = fullJson.encodeToJsonElement(EventDoc.serializer(), old).jsonObject
        val after = fullJson.encodeToJsonElement(EventDoc.serializer(), new).jsonObject
        val changed = LinkedHashMap<String, JsonElement>()
        for (field in EventFields.WRITABLE.sorted()) {
            val value = after[field] ?: JsonNull
            if ((before[field] ?: JsonNull) != value) changed[field] = value
        }
        return JsonObject(changed)
    }

    /**
     * [doc] with [patch] applied by the field-level rule of design D5 (`PatchMerge.applyToEvent`): only the patched
     * fields change, so a change stored meanwhile to another field is kept.
     */
    fun apply(doc: EventDoc, patch: JsonObject): EventDoc {
        val json = ModelJson.encodeToJsonElement(EventDoc.serializer(), doc).jsonObject
        val merged = PatchMerge.applyToEvent(json, patch).doc
        return ModelJson.decodeFromJsonElement(EventDoc.serializer(), merged)
    }

    /** The document [doc] would become after [patch]; for the size check of an edit. */
    fun sizeError(doc: EventDoc): FieldError? = EventValidation.checkDocumentSize(writableFields(doc))

    /** "Title must be 1 to 100 characters": the field's label and the fixed reason of `EventValidation`. */
    fun message(error: FieldError): String {
        val label = DraftField.of(error.field).label
        val reason = error.reason
        val sentence = reason.startsWith("must") || reason.startsWith("contains") || reason.startsWith("cannot")
        return if (sentence) "$label $reason" else "$label: $reason"
    }
}

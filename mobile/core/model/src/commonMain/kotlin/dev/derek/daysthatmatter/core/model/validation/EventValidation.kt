package dev.derek.daysthatmatter.core.model.validation

import dev.derek.daysthatmatter.core.model.ModelJson
import dev.derek.daysthatmatter.core.model.event.EventFields
import dev.derek.daysthatmatter.core.model.validation.Limits.AUDIO_TEXT_MAX_CHARS
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/**
 * Validation of event writes, shared by the app (before sending) and the backend (on every write).
 * Ported from `services/share/src/lib/validate.ts` and extended to owner-only fields, backdrop and
 * audio (BACKEND.md sections 7.2 and 11.2).
 *
 * Writes are checked strictly: unknown fields fail. Values come back normalized: titles trimmed,
 * timestamps in UTC, recurrence and theme without null members, reminders with their default time,
 * Spotify URLs without query, and server-set `backdrop.*Url` fields removed.
 *
 * Known gap: titles are not NFC-normalized here (see [TextRules]).
 */
object EventValidation {
    private val UNIT_MODES = setOf("auto", "days", "weeks", "hours", "calendar", "workdays")
    private val RECURRENCE_TYPES = setOf("none", "yearly", "monthly", "weekly", "customDays")
    private val CARD_SIZES = setOf("small", "medium", "large")
    private val BACKDROP_KINDS = setOf("still", "animated")
    private val AUDIO_KINDS = setOf("library", "custom", "spotify")

    /** Validates the fields of a new event (`PUT /events/{id}`): required fields present, nothing unknown. */
    fun validateNew(fields: JsonObject): Validated<JsonObject> {
        val checks = JsonChecks()
        val out = checkFields(checks, fields)
        for (name in EventFields.REQUIRED) {
            if (fields[name] == null) checks.fail(name, "required")
        }
        return checks.result(out)
    }

    /** Validates a patch: writable fields only; `null` clears a field, except fields that cannot be cleared. */
    fun validatePatch(patch: JsonObject): Validated<JsonObject> {
        val checks = JsonChecks()
        return checks.result(checkFields(checks, patch))
    }

    /** Checks the size of a stored document (after a merge): at most 16 KB of JSON. */
    fun checkDocumentSize(doc: JsonObject): FieldError? {
        val bytes = TextRules.utf8Length(ModelJson.encodeToString(JsonObject.serializer(), doc))
        return if (bytes > Limits.EVENT_DOC_MAX_BYTES) FieldError("", "event document exceeds 16384 bytes") else null
    }

    private fun checkFields(checks: JsonChecks, fields: JsonObject): JsonObject {
        if (!EventFields.WRITABLE.containsAll(fields.keys)) checks.fail("", "unknown field")
        val out = LinkedHashMap<String, JsonElement>()
        for ((name, value) in fields) {
            if (name !in EventFields.WRITABLE) continue
            if (value is JsonNull) {
                if (name in EventFields.NOT_NULL) checks.fail(name, "cannot be cleared") else out[name] = JsonNull
                continue
            }
            val checked: JsonElement? = when (name) {
                EventFields.TITLE -> checks.line(name, value, 1, Limits.TITLE_MAX_CHARS)
                EventFields.EMOJI -> checks.emoji(name, value)
                EventFields.TARGET_DATE -> checks.date(name, value)
                EventFields.TARGET_TIME -> checks.time(name, value)
                EventFields.TIME_ZONE -> checks.zone(name, value)
                EventFields.UNIT_MODE -> checks.choice(name, value, UNIT_MODES)
                EventFields.RECURRENCE -> recurrence(checks, value)
                EventFields.THEME -> theme(checks, value)
                EventFields.BACKDROP -> backdrop(checks, value)
                EventFields.AUDIO -> audio(checks, value)
                EventFields.NOTES -> checks.text(name, value, Limits.NOTES_MAX_CHARS, requireContent = false)
                EventFields.PINNED_AT, EventFields.ARCHIVED_AT -> checks.instant(name, value)?.let { JsonPrimitive(it.toString()) }
                EventFields.CATEGORY_ID -> checks.id(name, value)
                EventFields.REMINDERS -> checks.reminders(name, value)
                else -> null
            }
            if (checked != null) out[name] = checked
        }
        return JsonObject(out)
    }

    private fun recurrence(checks: JsonChecks, value: JsonElement): JsonObject? {
        val path = EventFields.RECURRENCE
        val o = checks.obj(path, value, setOf("type", "originalYear", "days")) ?: return null
        val type = checks.required(o, path, "type") { p, v -> checks.choice(p, v, RECURRENCE_TYPES) }?.content
            ?: return null
        val year = o["originalYear"]?.takeIf { it !is JsonNull }
            ?.let { checks.int("$path.originalYear", it, Limits.MIN_YEAR, Limits.MAX_YEAR) ?: return null }
        val days = o["days"]?.takeIf { it !is JsonNull }
            ?.let { checks.int("$path.days", it, 1, Limits.CUSTOM_DAYS_MAX) ?: return null }
        if ((type == "yearly") != (year != null)) return checks.fail("$path.originalYear", "required only for yearly")
        if ((type == "customDays") != (days != null)) return checks.fail("$path.days", "required only for customDays")
        return JsonObject(
            buildMap {
                put("type", JsonPrimitive(type))
                if (year != null) put("originalYear", JsonPrimitive(year))
                if (days != null) put("days", JsonPrimitive(days))
            },
        )
    }

    private fun theme(checks: JsonChecks, value: JsonElement): JsonObject? {
        val path = EventFields.THEME
        val o = checks.obj(path, value, setOf("paletteId", "cardStyle", "typography", "gradient", "size")) ?: return null
        val out = LinkedHashMap<String, JsonElement>()
        for (key in listOf("paletteId", "cardStyle", "typography")) {
            out[key] = checks.required(o, path, key, checks::id) ?: return null
        }
        o["gradient"]?.takeIf { it !is JsonNull }?.let { g ->
            if (g !is JsonArray || g.size != 2) return checks.fail("$path.gradient", "must be two colours")
            out["gradient"] = JsonArray(g.map { checks.hexColor("$path.gradient", it) ?: return null })
        }
        o["size"]?.takeIf { it !is JsonNull }?.let { s ->
            out["size"] = checks.choice("$path.size", s, CARD_SIZES) ?: return null
        }
        return JsonObject(out)
    }

    private fun backdrop(checks: JsonChecks, value: JsonElement): JsonObject? {
        val path = EventFields.BACKDROP
        val allowed = setOf("kind", "stillId", "motionId", "dim", "blur", "stillUrl", "motionUrl")
        val o = checks.obj(path, value, allowed) ?: return null
        val kind = checks.required(o, path, "kind") { p, v -> checks.choice(p, v, BACKDROP_KINDS) }?.content
            ?: return null
        val still = checks.required(o, path, "stillId", checks::mediaId) ?: return null
        val motion = o["motionId"]?.takeIf { it !is JsonNull }?.let { checks.mediaId("$path.motionId", it) ?: return null }
        if ((kind == "animated") != (motion != null)) return checks.fail("$path.motionId", "required only for animated")
        checks.required(o, path, "dim") { p, v -> checks.number(p, v, 0.0, Limits.DIM_MAX) } ?: return null
        val blur = o["blur"]?.takeIf { it !is JsonNull }?.let { checks.number("$path.blur", it, 0.0, Limits.BLUR_MAX) ?: return null }
        return JsonObject(
            buildMap {
                put("kind", JsonPrimitive(kind))
                put("stillId", still)
                if (motion != null) put("motionId", motion)
                put("dim", o.getValue("dim"))
                if (blur != null) put("blur", o.getValue("blur"))
            },
        )
    }

    private fun audio(checks: JsonChecks, value: JsonElement): JsonObject? {
        val path = EventFields.AUDIO
        if (value !is JsonObject) return checks.fail(path, "must be an object")
        val kind = checks.required(value, path, "kind") { p, v -> checks.choice(p, v, AUDIO_KINDS) }?.content
            ?: return null
        return when (kind) {
            "library" -> {
                val o = checks.obj(path, value, setOf("kind", "trackId")) ?: return null
                val track = checks.required(o, path, "trackId", checks::id) ?: return null
                JsonObject(mapOf("kind" to JsonPrimitive(kind), "trackId" to track))
            }
            "custom" -> {
                val o = checks.obj(path, value, setOf("kind", "mediaId", "title")) ?: return null
                val media = checks.required(o, path, "mediaId", checks::mediaId) ?: return null
                val title = checks.required(o, path, "title") { p, v -> checks.line(p, v, 1, AUDIO_TEXT_MAX_CHARS) }
                    ?: return null
                JsonObject(mapOf("kind" to JsonPrimitive(kind), "mediaId" to media, "title" to title))
            }
            else -> {
                val o = checks.obj(path, value, setOf("kind", "url", "title", "artist")) ?: return null
                val raw = checks.required(o, path, "url", checks::string) ?: return null
                val link = SpotifyLinks.parse(raw) ?: return checks.fail("$path.url", "not a Spotify track, album or playlist link")
                val out = linkedMapOf<String, JsonElement>("kind" to JsonPrimitive(kind), "url" to JsonPrimitive(link.url))
                for (key in listOf("title", "artist")) {
                    o[key]?.takeIf { it !is JsonNull }?.let {
                        out[key] = checks.line("$path.$key", it, 1, AUDIO_TEXT_MAX_CHARS) ?: return null
                    }
                }
                JsonObject(out)
            }
        }
    }
}

package dev.derek.daysthatmatter.core.model.validation

import dev.derek.daysthatmatter.core.model.event.HmTimeSerializer
import dev.derek.daysthatmatter.core.model.event.HmsTimeSerializer
import dev.derek.daysthatmatter.core.model.event.Reminders
import kotlinx.datetime.IllegalTimeZoneException
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlin.time.Instant

/**
 * Collects errors while checking one JSON body. Each check returns the normalized value, or null
 * after recording an error. Reasons are fixed texts.
 */
internal class JsonChecks {
    val errors: MutableList<FieldError> = mutableListOf()

    fun fail(path: String, reason: String): Nothing? {
        errors += FieldError(path, reason)
        return null
    }

    fun <T> result(value: T): Validated<T> = if (errors.isEmpty()) Validated.Valid(value) else Validated.Invalid(errors)

    /** The object at [path] with only [allowed] keys; unknown keys fail without naming them. */
    fun obj(path: String, value: JsonElement, allowed: Set<String>): JsonObject? {
        if (value !is JsonObject) return fail(path, "must be an object")
        if (!allowed.containsAll(value.keys)) return fail(path, "unknown field")
        return value
    }

    /** Checks the required member [key] of [o] with [check]; a missing or null member fails as required. */
    fun <T : Any> required(o: JsonObject, path: String, key: String, check: (String, JsonElement) -> T?): T? {
        val value = o[key]
        if (value == null || value is JsonNull) return fail("$path.$key", "required")
        return check("$path.$key", value)
    }

    fun string(path: String, value: JsonElement): String? {
        if (value !is JsonPrimitive || !value.isString) return fail(path, "must be a string")
        if (TextRules.hasLoneSurrogate(value.content)) return fail(path, "invalid unicode")
        return value.content
    }

    /** Single-line text: trimmed, [min] to [max] code points, no forbidden characters. */
    fun line(path: String, value: JsonElement, min: Int, max: Int): JsonPrimitive? {
        val text = string(path, value)?.trim() ?: return null
        val length = TextRules.codePointCount(text)
        if (length < min || length > max) return fail(path, "must be $min to $max characters")
        if (TextRules.hasForbiddenChars(text)) return fail(path, "contains forbidden characters")
        return JsonPrimitive(text)
    }

    /** Multi-line text, kept as written: at most [max] code points; line feed and tab allowed. */
    fun text(path: String, value: JsonElement, max: Int, requireContent: Boolean): JsonPrimitive? {
        val text = string(path, value) ?: return null
        if (requireContent && text.isBlank()) return fail(path, "must not be empty")
        if (TextRules.codePointCount(text) > max) return fail(path, "must be at most $max characters")
        if (TextRules.hasForbiddenChars(text, multiLine = true)) return fail(path, "contains forbidden characters")
        return value as JsonPrimitive
    }

    fun emoji(path: String, value: JsonElement): JsonPrimitive? {
        val text = string(path, value) ?: return null
        val ok = !TextRules.hasForbiddenChars(text) &&
            TextRules.utf8Length(text) <= Limits.EMOJI_MAX_UTF8_BYTES &&
            TextRules.graphemeCount(text) == 1
        return if (ok) JsonPrimitive(text) else fail(path, "must be a single emoji of at most 16 bytes")
    }

    fun id(path: String, value: JsonElement): JsonPrimitive? {
        val text = string(path, value) ?: return null
        return if (ID.matches(text)) JsonPrimitive(text) else fail(path, "invalid id")
    }

    fun mediaId(path: String, value: JsonElement): JsonPrimitive? {
        val text = string(path, value) ?: return null
        return if (MEDIA_ID.matches(text)) JsonPrimitive(text) else fail(path, "invalid media id")
    }

    fun hexColor(path: String, value: JsonElement): JsonPrimitive? {
        val text = string(path, value) ?: return null
        return if (HEX_COLOR.matches(text)) JsonPrimitive(text) else fail(path, "must be #RRGGBB")
    }

    fun date(path: String, value: JsonElement): JsonPrimitive? {
        val text = string(path, value) ?: return null
        return if (parseDate(text) != null) JsonPrimitive(text) else fail(path, "invalid date")
    }

    fun time(path: String, value: JsonElement): JsonPrimitive? {
        val text = string(path, value) ?: return null
        return if (HmsTimeSerializer.parse(text) != null) JsonPrimitive(text) else fail(path, "must be HH:MM:SS")
    }

    fun zone(path: String, value: JsonElement): JsonPrimitive? {
        val text = string(path, value) ?: return null
        return if (isTimeZone(text)) JsonPrimitive(text) else fail(path, "invalid time zone")
    }

    /** An ISO-8601 instant, normalized to UTC (`2026-10-12T15:04:05Z`). */
    fun instant(path: String, value: JsonElement): Instant? {
        val text = string(path, value) ?: return null
        return try {
            Instant.parse(text)
        } catch (_: IllegalArgumentException) {
            fail(path, "invalid timestamp")
        }
    }

    fun int(path: String, value: JsonElement, min: Int, max: Int): Int? {
        val n = (value as? JsonPrimitive)?.takeIf { it !is JsonNull && !it.isString }?.content?.toIntOrNull()
            ?: return fail(path, "must be a whole number")
        return if (n in min..max) n else fail(path, "must be $min to $max")
    }

    fun number(path: String, value: JsonElement, min: Double, max: Double): Double? {
        val n = (value as? JsonPrimitive)?.takeIf { it !is JsonNull && !it.isString }?.content?.toDoubleOrNull()
            ?: return fail(path, "must be a number")
        return if (n.isFinite() && n >= min && n <= max) n else fail(path, "must be $min to $max")
    }

    fun boolean(path: String, value: JsonElement): Boolean? {
        val p = value as? JsonPrimitive
        if (p == null || p is JsonNull || p.isString) return fail(path, "must be true or false")
        return when (p.content) {
            "true" -> true
            "false" -> false
            else -> fail(path, "must be true or false")
        }
    }

    /** One of [values], given by their API names. */
    fun choice(path: String, value: JsonElement, values: Set<String>): JsonPrimitive? {
        val text = string(path, value) ?: return null
        return if (text in values) JsonPrimitive(text) else fail(path, "unsupported value")
    }

    /** `null` or `{"daysBefore": [...], "time": "HH:MM"}`; the time defaults to 09:00. */
    fun reminders(path: String, value: JsonElement): JsonElement? {
        if (value is JsonNull) return JsonNull
        val o = obj(path, value, setOf("daysBefore", "time")) ?: return null
        val days = o["daysBefore"] ?: return fail("$path.daysBefore", "required")
        if (days !is JsonArray) return fail("$path.daysBefore", "must be an array")
        val picked = days.map { int("$path.daysBefore", it, 0, 7) ?: return null }
        if (!Reminders.ALLOWED_DAYS_BEFORE.containsAll(picked) || picked.toSet().size != picked.size) {
            return fail("$path.daysBefore", "must be distinct values of 0, 1 and 7")
        }
        val time = o["time"]?.takeIf { it !is JsonNull }?.let { t ->
            val text = string("$path.time", t) ?: return null
            if (HmTimeSerializer.parse(text) == null) return fail("$path.time", "must be HH:MM")
            text
        } ?: HmTimeSerializer.format(Reminders.DEFAULT_TIME)
        return JsonObject(mapOf("daysBefore" to JsonArray(picked.sorted().map(::JsonPrimitive)), "time" to JsonPrimitive(time)))
    }

    companion object {
        val ID: Regex = Regex("^[a-z0-9_-]{1,32}$")
        val MEDIA_ID: Regex = Regex("^[A-Za-z0-9_-]{22}$")
        val HEX_COLOR: Regex = Regex("^#[0-9A-Fa-f]{6}$")
        private val DATE: Regex = Regex("^(\\d{4})-(\\d{2})-(\\d{2})$")
        private val ZONE: Regex = Regex("^[A-Za-z][A-Za-z0-9_+\\-/]{0,63}$")

        /** A `YYYY-MM-DD` calendar date with a year from 1900 to 2200, or null. */
        fun parseDate(text: String): LocalDate? {
            val m = DATE.matchEntire(text) ?: return null
            val year = m.groupValues[1].toInt()
            if (year < Limits.MIN_YEAR || year > Limits.MAX_YEAR) return null
            return try {
                LocalDate(year, m.groupValues[2].toInt(), m.groupValues[3].toInt())
            } catch (_: IllegalArgumentException) {
                null
            }
        }

        /** True for an IANA zone id the time zone database knows. */
        fun isTimeZone(text: String): Boolean {
            if (!ZONE.matches(text)) return false
            return try {
                TimeZone.of(text)
                true
            } catch (_: IllegalTimeZoneException) {
                false
            }
        }
    }
}

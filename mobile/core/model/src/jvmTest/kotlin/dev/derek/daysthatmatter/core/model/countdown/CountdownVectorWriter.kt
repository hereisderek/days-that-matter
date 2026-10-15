package dev.derek.daysthatmatter.core.model.countdown

import dev.derek.daysthatmatter.core.model.event.Recurrence
import dev.derek.daysthatmatter.core.model.event.RecurrenceSerializer
import dev.derek.daysthatmatter.core.model.event.UnitMode
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonObjectBuilder
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonObject
import java.io.File

@OptIn(ExperimentalSerializationApi::class)
private val vectorJson = Json {
    prettyPrint = true
    prettyPrintIndent = "  "
}

/** API value of each unit mode, in the order the day page cycles through them. */
private val unitKeys = listOf(
    UnitMode.Auto to "auto",
    UnitMode.Days to "days",
    UnitMode.Weeks to "weeks",
    UnitMode.Hours to "hours",
    UnitMode.Calendar to "calendar",
    UnitMode.Workdays to "workdays",
)

/**
 * Writes the countdown parity vectors ([CountdownVectors], then [SubSecondCountdownVectors]) to the path in `args[0]`. Run by the Gradle task
 * `:core:model:generateCountdownVectors`. Inputs come from [CountdownVectors]; every output is
 * computed by [CountdownEngine], so the file changes only when cases or the engine change.
 */
fun main(args: Array<String>) {
    require(args.size == 1) { "usage: CountdownVectorWriter <output file>" }
    val file = File(args[0])
    file.parentFile?.mkdirs()
    file.writeText(vectorJson.encodeToString(JsonElement.serializer(), vectorFile()) + "\n")
}

/** The whole vector file. */
fun vectorFile(): JsonObject = buildJsonObject {
    put("generatedBy", "./gradlew :core:model:generateCountdownVectors (do not edit by hand)")
    put(
        "rules",
        "Totals are real elapsed time, floored. The breakdown uses wall-clock fields in the event zone " +
            "with end-of-month clamping. A time in a DST gap moves forward by the gap; an ambiguous time takes " +
            "the earlier instant. A date-only event counts to 00:00:00. timeZone null means viewerZone (UTC when " +
            "viewerZone is null). Workdays count Monday to Friday by date. Auto shows hours and minutes below 48 hours.",
    )
    put("vectors", buildJsonArray { (CountdownVectors.cases + SubSecondCountdownVectors.cases).forEach { add(vector(it)) } })
}

private fun vector(case: CountdownCase): JsonObject {
    val c = case.compute()
    return buildJsonObject {
        put("name", case.name)
        put("timeZone", case.timeZone)
        put("targetDate", case.targetDate)
        put("targetTime", case.targetTime)
        put("recurrence", recurrenceJson(case.recurrence))
        put("viewerZone", case.viewerZone)
        put("nowInstant", case.now)
        putJsonObject("expected") {
            put("targetInstant", c.target.toString())
            put("occurrenceDate", c.occurrenceDate.toString())
            put("direction", c.direction.name.lowercase())
            put("upcoming", c.upcoming)
            put("totalDays", c.totalDays)
            put("totalHours", c.totalHours)
            put("totalMinutes", c.totalMinutes)
            put("totalSeconds", c.totalSeconds)
            put("years", c.years)
            put("months", c.months)
            put("days", c.days)
            put("hours", c.hours)
            put("minutes", c.minutes)
            put("seconds", c.seconds)
            put("anniversary", c.anniversary)
            put("workdays", c.workdays)
            putJsonObject("units") {
                for ((mode, key) in unitKeys) put(key, valueJson(c.value(mode)))
            }
        }
    }
}

/** The API form of a recurrence, with explicit nulls as in the old vector file. */
private fun recurrenceJson(recurrence: Recurrence): JsonObject {
    val flat = Json.encodeToJsonElement(RecurrenceSerializer, recurrence) as JsonObject
    return buildJsonObject {
        put("type", flat.getValue("type"))
        put("originalYear", flat["originalYear"] ?: JsonNull)
        put("days", flat["days"] ?: JsonNull)
    }
}

private fun valueJson(value: CountdownValue): JsonObject = buildJsonObject {
    when (value) {
        is CountdownValue.Days -> kind("days").also { put("days", value.days) }
        is CountdownValue.HoursMinutes -> kind("hoursMinutes").also {
            put("hours", value.hours)
            put("minutes", value.minutes)
        }
        is CountdownValue.WeeksDays -> kind("weeksDays").also {
            put("weeks", value.weeks)
            put("days", value.days)
        }
        is CountdownValue.Hours -> kind("hours").also { put("hours", value.hours) }
        is CountdownValue.Calendar -> kind("calendar").also {
            put("years", value.years)
            put("months", value.months)
            put("days", value.days)
        }
        is CountdownValue.Workdays -> kind("workdays").also { put("workdays", value.workdays) }
    }
}

private fun JsonObjectBuilder.kind(name: String) {
    put("kind", JsonPrimitive(name))
}

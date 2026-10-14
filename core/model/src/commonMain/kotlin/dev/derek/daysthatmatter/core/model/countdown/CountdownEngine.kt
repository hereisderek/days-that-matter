package dev.derek.daysthatmatter.core.model.countdown

import dev.derek.daysthatmatter.core.model.event.EventDoc
import dev.derek.daysthatmatter.core.model.event.PublicEvent
import dev.derek.daysthatmatter.core.model.event.Recurrence
import dev.derek.daysthatmatter.core.model.event.UnitMode
import kotlinx.datetime.DateTimeUnit
import kotlinx.datetime.DayOfWeek
import kotlinx.datetime.LocalDate
import kotlinx.datetime.LocalDateTime
import kotlinx.datetime.LocalTime
import kotlinx.datetime.TimeZone
import kotlinx.datetime.number
import kotlinx.datetime.plus
import kotlinx.datetime.toInstant
import kotlinx.datetime.toLocalDateTime
import kotlin.time.Instant

/** What a countdown is computed for: the date fields of an event. */
data class CountdownTarget(
    val targetDate: LocalDate,
    val targetTime: LocalTime? = null,
    val timeZone: String? = null,
    val recurrence: Recurrence = Recurrence.None,
) {
    companion object {
        fun of(event: EventDoc): CountdownTarget =
            CountdownTarget(event.targetDate, event.targetTime, event.timeZone, event.recurrence)

        fun of(event: PublicEvent): CountdownTarget =
            CountdownTarget(event.targetDate, event.targetTime, event.timeZone, event.recurrence)
    }
}

/** Whether the occurrence is ahead, behind, or on today's date in the event's zone. */
enum class Direction { Until, Since, Today }

/** The number a day shows in one unit mode. */
sealed interface CountdownValue {
    data class Days(val days: Long) : CountdownValue

    /** Auto in the last 48 hours. */
    data class HoursMinutes(val hours: Long, val minutes: Int) : CountdownValue

    data class WeeksDays(val weeks: Long, val days: Int) : CountdownValue

    data class Hours(val hours: Long) : CountdownValue

    data class Calendar(val years: Int, val months: Int, val days: Int) : CountdownValue

    data class Workdays(val workdays: Long) : CountdownValue
}

/**
 * A computed countdown or count-up.
 *
 * Totals ([totalDays] to [totalSeconds]) are real elapsed time between [now] and [target], floored.
 * The calendar breakdown ([years] to [seconds]) uses wall-clock fields in [zone], with end-of-month
 * clamping, and is floored the same way, so a fraction of a second never shows as a whole one. [workdays] counts Monday to Friday by date (see [CountdownEngine.workdays]).
 */
data class Countdown(
    val zone: TimeZone,
    val now: Instant,
    val today: LocalDate,
    val occurrenceDate: LocalDate,
    val target: Instant,
    val direction: Direction,
    val totalDays: Long,
    val totalHours: Long,
    val totalMinutes: Long,
    val totalSeconds: Long,
    val years: Int,
    val months: Int,
    val days: Int,
    val hours: Int,
    val minutes: Int,
    val seconds: Int,
    val anniversary: Int?,
    val workdays: Long,
) {
    val isToday: Boolean get() = direction == Direction.Today
    val isPast: Boolean get() = direction == Direction.Since

    /** True while the target instant has not passed (also on the day itself before its time). */
    val upcoming: Boolean get() = target >= now

    /** The number shown for [mode] (`countdown-units` spec). */
    fun value(mode: UnitMode): CountdownValue = when (mode) {
        UnitMode.Auto ->
            if (totalHours < CountdownEngine.AUTO_HOURS_LIMIT) {
                CountdownValue.HoursMinutes(totalHours, (totalMinutes % 60).toInt())
            } else {
                CountdownValue.Days(totalDays)
            }
        UnitMode.Days -> CountdownValue.Days(totalDays)
        UnitMode.Weeks -> CountdownValue.WeeksDays(totalDays / 7, (totalDays % 7).toInt())
        UnitMode.Hours -> CountdownValue.Hours(totalHours)
        UnitMode.Calendar -> CountdownValue.Calendar(years, months, days)
        UnitMode.Workdays -> CountdownValue.Workdays(workdays)
    }
}

/**
 * The countdown engine shared by the app and the backend (docs/features/events/SPEC.md section 2).
 * The share page's `countdown.js` is checked against vectors generated from it.
 *
 * Rules:
 * - The event's zone is its `timeZone`, or the viewer's zone when it is null (floating).
 * - A date-only event counts to 00:00:00 in its zone.
 * - A local time in a DST gap moves forward by the gap length; an ambiguous time (DST overlap)
 *   takes the earlier instant.
 * - A repeating event counts to its first occurrence on or after today's date in its zone; the
 *   occurrence stays "today" for the whole day, then moves on.
 */
object CountdownEngine {
    /** Auto shows hours and minutes below this many hours. */
    const val AUTO_HOURS_LIMIT: Long = 48

    fun compute(target: CountdownTarget, now: Instant, viewerZone: TimeZone): Countdown {
        val zone = target.timeZone?.let { TimeZone.of(it) } ?: viewerZone
        val nowLocal = now.toLocalDateTime(zone)
        val today = nowLocal.date
        val occurrence = nextOccurrence(target.targetDate, target.recurrence, today)
        val targetLocal = LocalDateTime(occurrence, target.targetTime ?: LocalTime(0, 0))
        val targetInstant = targetLocal.toInstant(zone)
        val direction = when {
            occurrence == today -> Direction.Today
            targetInstant < now -> Direction.Since
            else -> Direction.Until
        }
        val diff = if (targetInstant >= now) targetInstant - now else now - targetInstant
        val parts = if (targetInstant >= now) breakdown(nowLocal, targetLocal) else breakdown(targetLocal, nowLocal)
        return Countdown(
            zone = zone,
            now = now,
            today = today,
            occurrenceDate = occurrence,
            target = targetInstant,
            direction = direction,
            totalDays = diff.inWholeDays,
            totalHours = diff.inWholeHours,
            totalMinutes = diff.inWholeMinutes,
            totalSeconds = diff.inWholeSeconds,
            years = parts.years,
            months = parts.months,
            days = parts.days,
            hours = parts.hours,
            minutes = parts.minutes,
            seconds = parts.seconds,
            anniversary = (target.recurrence as? Recurrence.Yearly)?.let { occurrence.year - it.originalYear },
            workdays = workdays(today, occurrence),
        )
    }

    /** The first occurrence of [targetDate] under [recurrence] on or after [today]; [targetDate] itself if none repeats. */
    fun nextOccurrence(targetDate: LocalDate, recurrence: Recurrence, today: LocalDate): LocalDate = when (recurrence) {
        Recurrence.None -> targetDate
        is Recurrence.Yearly -> {
            var year = maxOf(targetDate.year, recurrence.originalYear, today.year)
            var occurrence = clampedDate(year, targetDate.month.number, targetDate.day)
            while (occurrence < today) {
                year++
                occurrence = clampedDate(year, targetDate.month.number, targetDate.day)
            }
            occurrence
        }
        Recurrence.Monthly -> {
            var index = maxOf(monthIndex(targetDate), monthIndex(today))
            var occurrence = clampedDate(index / 12, index % 12 + 1, targetDate.day)
            while (occurrence < today) {
                index++
                occurrence = clampedDate(index / 12, index % 12 + 1, targetDate.day)
            }
            occurrence
        }
        Recurrence.Weekly -> everyDays(targetDate, 7, today)
        is Recurrence.CustomDays -> everyDays(targetDate, recurrence.days, today)
    }

    /**
     * Workdays between today and the occurrence, Monday to Friday, public holidays not skipped.
     * A countdown counts the days after [today] up to and including [occurrence]; a count-up counts
     * from the day after [occurrence] up to and including [today]; on the day itself it is 0.
     */
    fun workdays(today: LocalDate, occurrence: LocalDate): Long = when {
        occurrence > today -> weekdaysAfter(today, occurrence)
        occurrence < today -> weekdaysAfter(occurrence, today)
        else -> 0
    }

    /** Calendar breakdown between two wall-clock values [from] <= [to], with end-of-month clamping. */
    fun breakdown(from: LocalDateTime, to: LocalDateTime): Breakdown {
        val end = to.toInstant(TimeZone.UTC)
        var months = maxOf(0, (monthIndex(to.date) - monthIndex(from.date)))
        while (months > 0 && addMonths(from, months) > end) months--
        val rest = maxOf(0L, (end - addMonths(from, months)).inWholeSeconds)
        return Breakdown(
            years = months / 12,
            months = months % 12,
            days = (rest / 86_400).toInt(),
            hours = (rest % 86_400 / 3_600).toInt(),
            minutes = (rest % 3_600 / 60).toInt(),
            seconds = (rest % 60).toInt(),
        )
    }

    data class Breakdown(val years: Int, val months: Int, val days: Int, val hours: Int, val minutes: Int, val seconds: Int)

    /** Wall-clock [from] plus [months] months (clamped to the month's last day), read as UTC. */
    private fun addMonths(from: LocalDateTime, months: Int): Instant =
        LocalDateTime(from.date.plus(months, DateTimeUnit.MONTH), from.time).toInstant(TimeZone.UTC)

    private fun everyDays(start: LocalDate, step: Int, today: LocalDate): LocalDate {
        val first = start.toEpochDays()
        val now = today.toEpochDays()
        if (first >= now) return start
        val steps = (now - first + step - 1) / step
        return LocalDate.fromEpochDays(first + steps * step)
    }

    /** Monday to Friday dates in ([after], [upTo]]. */
    private fun weekdaysAfter(after: LocalDate, upTo: LocalDate): Long {
        val span = upTo.toEpochDays() - after.toEpochDays()
        var count = span / 7 * 5
        var day = after.plus((span / 7 * 7).toInt(), DateTimeUnit.DAY)
        repeat((span % 7).toInt()) {
            day = day.plus(1, DateTimeUnit.DAY)
            if (day.dayOfWeek != DayOfWeek.SATURDAY && day.dayOfWeek != DayOfWeek.SUNDAY) count++
        }
        return count
    }

    private fun monthIndex(date: LocalDate): Int = date.year * 12 + (date.month.number - 1)

    private fun clampedDate(year: Int, month: Int, day: Int): LocalDate =
        LocalDate(year, month, minOf(day, daysInMonth(year, month)))

    private fun daysInMonth(year: Int, month: Int): Int = when (month) {
        2 -> if (year % 4 == 0 && (year % 100 != 0 || year % 400 == 0)) 29 else 28
        4, 6, 9, 11 -> 30
        else -> 31
    }
}

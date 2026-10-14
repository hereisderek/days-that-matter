package dev.derek.daysthatmatter.feature.events.presentation.common

import dev.derek.daysthatmatter.core.model.countdown.Countdown
import dev.derek.daysthatmatter.core.model.countdown.CountdownValue
import dev.derek.daysthatmatter.core.model.countdown.Direction
import dev.derek.daysthatmatter.core.model.event.EventDoc
import dev.derek.daysthatmatter.core.model.event.Recurrence
import dev.derek.daysthatmatter.core.model.event.UnitMode
import dev.derek.daysthatmatter.feature.events.domain.Categories
import kotlinx.datetime.DayOfWeek
import kotlinx.datetime.LocalDate
import kotlinx.datetime.LocalTime
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import kotlin.time.Instant

/** The big number and the label under it. [long] numbers (weeks, Y·M·D, h/m) use a smaller size on the day page. */
data class NumberText(val number: String, val unit: String, val long: Boolean = false)

/**
 * Text for countdowns, dates and times, following `valueFor`, `meta`, `metaLong` and `tickText` of
 * design/v2/app.js. English only for now; localized strings come with the app's resources.
 */
object CountdownText {
    private val monthsShort = listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
    private val monthsLong = listOf(
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    )

    /** Labels of the six unit modes, in the order a tap cycles through them. */
    fun unitLabel(mode: UnitMode): String = when (mode) {
        UnitMode.Auto -> "Auto"
        UnitMode.Days -> "Days"
        UnitMode.Weeks -> "Weeks"
        UnitMode.Hours -> "Hours"
        UnitMode.Calendar -> "Y·M·D"
        UnitMode.Workdays -> "Workdays"
    }

    /** The number a day shows in [mode]. A day happening today reads "Today". */
    fun value(doc: EventDoc, countdown: Countdown, mode: UnitMode = doc.unitMode): NumberText {
        if (countdown.direction == Direction.Today) return NumberText("Today", occurrence(doc, countdown) ?: "it’s the day")
        val future = countdown.direction == Direction.Until
        val dir = if (future) "left" else "since"
        val toGo = if (future) "to go" else "since"
        return when (val v = countdown.value(mode)) {
            is CountdownValue.Days -> NumberText(group(v.days), "${if (v.days == 1L) "day" else "days"} $dir")
            is CountdownValue.HoursMinutes -> NumberText("${v.hours}h ${two(v.minutes)}m", toGo, long = true)
            is CountdownValue.WeeksDays -> NumberText("${group(v.weeks)}w ${v.days}d", toGo, long = true)
            is CountdownValue.Hours -> NumberText(group(v.hours), "${if (v.hours == 1L) "hour" else "hours"} $dir")
            is CountdownValue.Calendar -> {
                val parts = buildList {
                    if (v.years > 0) add("${v.years}y")
                    if (v.months > 0 || v.years > 0) add("${v.months}m")
                    add("${v.days}d")
                }
                NumberText(parts.joinToString(" "), toGo, long = true)
            }
            is CountdownValue.Workdays -> NumberText(group(v.workdays), "${if (v.workdays == 1L) "workday" else "workdays"} $dir")
        }
    }

    /** "turns 8", "5th anniversary", "Monthly", "Weekly", "Every 10 days"; null for a one-time day. */
    fun occurrence(doc: EventDoc, countdown: Countdown): String? = when (val r = doc.recurrence) {
        is Recurrence.Yearly -> countdown.anniversary?.takeIf { it > 0 }?.let { n ->
            if (doc.categoryId == Categories.Birthdays.id) "turns $n" else "${ordinal(n)} anniversary"
        }
        Recurrence.Monthly -> "Monthly"
        Recurrence.Weekly -> "Weekly"
        is Recurrence.CustomDays -> "Every ${r.days} days"
        Recurrence.None -> null
    }

    /** The date line of a card: "Since May 20, 2021", "Today", or "Sat, Nov 21 · turns 8". */
    fun meta(doc: EventDoc, countdown: Countdown): String = when (countdown.direction) {
        Direction.Since -> "Since ${dateYear(countdown.occurrenceDate)}"
        Direction.Today -> listOfNotNull("Today", occurrence(doc, countdown)).joinToString(" · ")
        Direction.Until -> listOfNotNull(dateShort(countdown.occurrenceDate, countdown.today), occurrence(doc, countdown)).joinToString(" · ")
    }

    /**
     * The day page's date line: "Saturday, November 21, 2026 · 9:30 AM Oslo time (8:30 AM here)". The zone part
     * appears when the day has a fixed zone other than [deviceZone].
     */
    fun metaLong(doc: EventDoc, countdown: Countdown, deviceZone: TimeZone): String = buildString {
        if (countdown.isPast) append("Since ")
        append(dateLong(countdown.occurrenceDate))
        doc.targetTime?.let { append(" · ").append(time(it)) }
        val zone = doc.timeZone
        if (zone != null && zone != deviceZone.id) {
            append(" ").append(city(zone)).append(" time")
            if (doc.targetTime != null) append(" (").append(time(countdown.target.toLocalDateTime(deviceZone).time)).append(" here)")
        }
    }

    /** The live ticker: "37d 04h 12m 08s" to or since the exact instant, or "Happening today" once it has passed today. */
    fun tick(countdown: Countdown): String {
        if (countdown.direction == Direction.Today && countdown.target <= countdown.now) return "Happening today"
        val total = countdown.totalSeconds
        return "${group(total / 86_400)}d ${two((total % 86_400 / 3_600).toInt())}h ${two((total % 3_600 / 60).toInt())}m ${two((total % 60).toInt())}s"
    }

    /** The kicker date on Home: "Wednesday, October 14". */
    fun todayKicker(now: Instant, zone: TimeZone): String {
        val date = now.toLocalDateTime(zone).date
        return "${weekday(date.dayOfWeek)}, ${monthsLong[date.month.ordinal]} ${date.day}"
    }

    /** "Nov 21" this year, "Nov 21, 2027" in another; with the weekday this year ("Sat, Nov 21"). */
    fun dateShort(date: LocalDate, today: LocalDate): String =
        if (date.year == today.year) "${weekday(date.dayOfWeek).take(3)}, ${monthsShort[date.month.ordinal]} ${date.day}" else dateYear(date)

    /** "May 20, 2021". */
    fun dateYear(date: LocalDate): String = "${monthsShort[date.month.ordinal]} ${date.day}, ${date.year}"

    /** "Saturday, November 21, 2026". */
    fun dateLong(date: LocalDate): String =
        "${weekday(date.dayOfWeek)}, ${monthsLong[date.month.ordinal]} ${date.day}, ${date.year}"

    /** "9:30 AM". */
    fun time(time: LocalTime): String {
        val hour = if (time.hour % 12 == 0) 12 else time.hour % 12
        return "$hour:${two(time.minute)} ${if (time.hour < 12) "AM" else "PM"}"
    }

    /** "Europe/Oslo" -> "Oslo"; "America/New_York" -> "New York". */
    fun city(zoneId: String): String = zoneId.substringAfterLast('/').replace('_', ' ')

    /** 1248 -> "1,248". */
    fun group(n: Long): String {
        val digits = kotlin.math.abs(n).toString()
        val grouped = digits.reversed().chunked(3).joinToString(",").reversed()
        return if (n < 0) "-$grouped" else grouped
    }

    fun ordinal(n: Int): String {
        val suffix = when {
            n % 100 in 11..13 -> "th"
            n % 10 == 1 -> "st"
            n % 10 == 2 -> "nd"
            n % 10 == 3 -> "rd"
            else -> "th"
        }
        return "$n$suffix"
    }

    private fun weekday(day: DayOfWeek): String = day.name.lowercase().replaceFirstChar { it.uppercase() }

    private fun two(n: Int): String = n.toString().padStart(2, '0')
}

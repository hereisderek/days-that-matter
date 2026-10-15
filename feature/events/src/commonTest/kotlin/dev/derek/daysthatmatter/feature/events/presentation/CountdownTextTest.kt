package dev.derek.daysthatmatter.feature.events.presentation

import dev.derek.daysthatmatter.core.model.countdown.Countdown
import dev.derek.daysthatmatter.core.model.countdown.CountdownEngine
import dev.derek.daysthatmatter.core.model.countdown.CountdownTarget
import dev.derek.daysthatmatter.core.model.event.EventDoc
import dev.derek.daysthatmatter.core.model.event.Recurrence
import dev.derek.daysthatmatter.core.model.event.UnitMode
import dev.derek.daysthatmatter.feature.events.NOW
import dev.derek.daysthatmatter.feature.events.event
import dev.derek.daysthatmatter.feature.events.presentation.common.CountdownText
import dev.derek.daysthatmatter.feature.events.presentation.common.NumberText
import kotlinx.datetime.LocalDate
import kotlinx.datetime.LocalTime
import kotlinx.datetime.TimeZone
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.time.Duration.Companion.days
import kotlin.time.Duration.Companion.hours
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Duration.Companion.seconds
import kotlin.time.Instant

class CountdownTextTest {

    private fun countdown(doc: EventDoc, now: Instant = NOW): Countdown =
        CountdownEngine.compute(CountdownTarget.of(doc), now, TimeZone.UTC)

    private fun value(doc: EventDoc, mode: UnitMode, now: Instant = NOW) = CountdownText.value(doc, countdown(doc, now), mode)

    @Test
    fun daysAndAuto() {
        val trip = event("t", date = LocalDate(2026, 10, 20))

        assertEquals(NumberText("5", "days left"), value(trip, UnitMode.Days))
        assertEquals(NumberText("5", "days left"), value(trip, UnitMode.Auto))
        assertEquals(NumberText("1", "day left"), value(event("t", date = LocalDate(2026, 10, 15), time = LocalTime(12, 0)), UnitMode.Days))
    }

    @Test
    fun autoShowsHoursAndMinutesInTheLast48Hours() {
        val soon = event("s", date = LocalDate(2026, 10, 15), time = LocalTime(15, 15))

        assertEquals(NumberText("30h 15m", "to go", long = true), value(soon, UnitMode.Auto))
    }

    @Test
    fun weeksShowWeeksAndDays() {
        val marathon = event("m", date = LocalDate(2027, 3, 21), time = LocalTime(9, 0))

        assertEquals(NumberText("22w 4d", "to go", long = true), value(marathon, UnitMode.Weeks))
    }

    @Test
    fun hoursCountToTheExactTime() {
        val day = event("h", date = LocalDate(2026, 10, 14))

        assertEquals(NumberText("38", "hours left"), value(day, UnitMode.Hours, now = Instant.parse("2026-10-12T09:30:00Z")))
    }

    @Test
    fun calendarShowsYearsMonthsAndDays() {
        val day = event("c", date = LocalDate(2029, 2, 20))

        assertEquals(NumberText("2y 4m 8d", "to go", long = true), value(day, UnitMode.Calendar, now = Instant.parse("2026-10-12T00:00:00Z")))
        assertEquals(NumberText("6d", "to go", long = true), value(event("c", date = LocalDate(2026, 10, 18)), UnitMode.Calendar, now = Instant.parse("2026-10-12T00:00:00Z")))
    }

    @Test
    fun workdaysSkipWeekends() {
        val deadline = event("w", date = LocalDate(2026, 10, 23))

        assertEquals(NumberText("9", "workdays left"), value(deadline, UnitMode.Workdays, now = Instant.parse("2026-10-12T08:00:00Z")))
        val since = event("w", date = LocalDate(2026, 10, 9))
        assertEquals(NumberText("1", "workday since"), value(since, UnitMode.Workdays, now = Instant.parse("2026-10-12T08:00:00Z")))
    }

    @Test
    fun todayAndCountUps() {
        assertEquals(NumberText("Today", "it’s the day"), value(event("t", date = LocalDate(2026, 10, 14)), UnitMode.Days))
        val birthday = event("b", date = LocalDate(2019, 10, 14), recurrence = Recurrence.Yearly(2019), category = "birthdays")
        assertEquals(NumberText("Today", "turns 7"), value(birthday, UnitMode.Auto))

        val together = event("g", date = LocalDate(2021, 5, 20))
        val text = value(together, UnitMode.Days)
        assertEquals("days since", text.unit)
        assertEquals("1,973", text.number)
        assertEquals("Since May 20, 2021", CountdownText.meta(together, countdown(together)))
    }

    @Test
    fun metaLines() {
        val trip = event("t", date = LocalDate(2026, 11, 21))
        assertEquals("Sat, Nov 21", CountdownText.meta(trip, countdown(trip)))

        val nextYear = event("n", date = LocalDate(2027, 1, 1))
        assertEquals("Jan 1, 2027", CountdownText.meta(nextYear, countdown(nextYear)))

        val anniversary = event("a", date = LocalDate(2020, 11, 1), recurrence = Recurrence.Yearly(2020), category = "anniversaries")
        assertEquals("Sun, Nov 1 · 6th anniversary", CountdownText.meta(anniversary, countdown(anniversary)))

        val today = event("d", date = LocalDate(2026, 9, 14), recurrence = Recurrence.Monthly)
        assertEquals("Today · Monthly", CountdownText.meta(today, countdown(today)))
    }

    @Test
    fun occurrences() {
        val c = countdown(event("x"))
        assertEquals("Weekly", CountdownText.occurrence(event("x", recurrence = Recurrence.Weekly), c))
        assertEquals("Every 10 days", CountdownText.occurrence(event("x", recurrence = Recurrence.CustomDays(10)), c))
        assertNull(CountdownText.occurrence(event("x"), c))
    }

    @Test
    fun longDateLineWithAFixedZone() {
        val norway = event("n", date = LocalDate(2026, 11, 21), time = LocalTime(9, 30), zone = "Europe/Oslo")

        assertEquals(
            "Saturday, November 21, 2026 · 9:30 AM Oslo time (8:30 AM here)",
            CountdownText.metaLong(norway, countdown(norway), TimeZone.UTC),
        )
        assertEquals(
            "Saturday, November 21, 2026 · 9:30 AM",
            CountdownText.metaLong(norway, countdown(norway), TimeZone.of("Europe/Oslo")),
        )
        val past = event("p", date = LocalDate(2024, 3, 9))
        assertEquals("Since Saturday, March 9, 2024", CountdownText.metaLong(past, countdown(past), TimeZone.UTC))
    }

    @Test
    fun ticker() {
        val target = NOW + 37.days + 4.hours + 12.minutes + 8.seconds
        val doc = event("t", date = LocalDate(2026, 11, 20), time = LocalTime(13, 12, 8))
        assertEquals(target, countdown(doc).target)
        assertEquals("37d 04h 12m 08s", CountdownText.tick(countdown(doc)))

        val earlierToday = event("e", date = LocalDate(2026, 10, 14), time = LocalTime(8, 0))
        assertEquals("Happening today", CountdownText.tick(countdown(earlierToday)))
        val laterToday = event("l", date = LocalDate(2026, 10, 14), time = LocalTime(18, 0))
        assertEquals("0d 09h 00m 00s", CountdownText.tick(countdown(laterToday)))
    }

    @Test
    fun smallFormats() {
        assertEquals("Wednesday, October 14", CountdownText.todayKicker(NOW, TimeZone.UTC))
        assertEquals("0", CountdownText.group(0))
        assertEquals("1,234,567", CountdownText.group(1_234_567))
        assertEquals("-1,234", CountdownText.group(-1_234))
        assertEquals(
            listOf("1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "101st", "111th"),
            listOf(1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111).map(CountdownText::ordinal),
        )
        assertEquals("New York", CountdownText.city("America/New_York"))
        assertEquals("12:05 AM", CountdownText.time(LocalTime(0, 5)))
        assertEquals("12:00 PM", CountdownText.time(LocalTime(12, 0)))
        assertEquals("1:30 PM", CountdownText.time(LocalTime(13, 30)))
        assertEquals(
            listOf("Auto", "Days", "Weeks", "Hours", "Y·M·D", "Workdays"),
            UnitMode.entries.map(CountdownText::unitLabel),
        )
    }
}

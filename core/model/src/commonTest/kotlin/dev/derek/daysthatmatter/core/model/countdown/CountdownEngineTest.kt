package dev.derek.daysthatmatter.core.model.countdown

import dev.derek.daysthatmatter.core.model.event.EventDoc
import dev.derek.daysthatmatter.core.model.event.PublicEvent
import dev.derek.daysthatmatter.core.model.event.Recurrence
import dev.derek.daysthatmatter.core.model.event.Theme
import dev.derek.daysthatmatter.core.model.event.UnitMode
import dev.derek.daysthatmatter.core.model.loadTimeZoneDatabase
import dev.derek.daysthatmatter.core.model.zone
import kotlinx.datetime.DateTimeUnit
import kotlinx.datetime.DayOfWeek
import kotlinx.datetime.LocalDate
import kotlinx.datetime.LocalDateTime
import kotlinx.datetime.LocalTime
import kotlinx.datetime.TimeZone
import kotlinx.datetime.plus
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import kotlin.time.Duration.Companion.days
import kotlin.time.Instant

class CountdownEngineTest {
    init {
        loadTimeZoneDatabase()
    }

    private val utc = TimeZone.UTC

    @Test
    fun everyVectorMatchesItsExpectations() {
        for (case in CountdownVectors.cases) {
            val c = case.compute()
            val e = case.expected
            val n = case.name
            e.target?.let { assertEquals(it, c.target.toString(), "$n target") }
            e.occurrence?.let { assertEquals(it, c.occurrenceDate.toString(), "$n occurrence") }
            e.direction?.let { assertEquals(it, c.direction, "$n direction") }
            e.totalDays?.let { assertEquals(it, c.totalDays, "$n totalDays") }
            e.totalHours?.let { assertEquals(it, c.totalHours, "$n totalHours") }
            e.totalMinutes?.let { assertEquals(it, c.totalMinutes, "$n totalMinutes") }
            e.totalSeconds?.let { assertEquals(it, c.totalSeconds, "$n totalSeconds") }
            e.years?.let { assertEquals(it, c.years, "$n years") }
            e.months?.let { assertEquals(it, c.months, "$n months") }
            e.days?.let { assertEquals(it, c.days, "$n days") }
            e.hours?.let { assertEquals(it, c.hours, "$n hours") }
            e.minutes?.let { assertEquals(it, c.minutes, "$n minutes") }
            e.seconds?.let { assertEquals(it, c.seconds, "$n seconds") }
            if (e.anniversary != UNCHECKED) assertEquals(e.anniversary, c.anniversary, "$n anniversary")
            e.workdays?.let { assertEquals(it, c.workdays, "$n workdays") }
            for ((mode, value) in e.units) assertEquals(value, c.value(mode), "$n $mode")
        }
    }

    @Test
    fun vectorNamesAreUnique() {
        val names = CountdownVectors.cases.map { it.name }
        assertEquals(names.size, names.toSet().size)
    }

    @Test
    fun everyUnitModeHasAValue() {
        val c = compute(LocalDate(2027, 3, 19), now = "2026-10-12T00:00:00Z")
        assertEquals(CountdownValue.Days(158), c.value(UnitMode.Auto))
        assertEquals(CountdownValue.Days(158), c.value(UnitMode.Days))
        assertEquals(CountdownValue.WeeksDays(22, 4), c.value(UnitMode.Weeks))
        assertEquals(CountdownValue.Hours(158 * 24), c.value(UnitMode.Hours))
        assertEquals(CountdownValue.Calendar(0, 5, 7), c.value(UnitMode.Calendar))
        assertEquals(CountdownValue.Workdays(114), c.value(UnitMode.Workdays))
    }

    @Test
    fun hittingZeroCountsDownToExactlyZeroAndThenUp() {
        val target = LocalDate(2026, 10, 12)
        val time = LocalTime(12, 0)
        val before = compute(target, time, "2026-10-12T11:59:59Z")
        val at = compute(target, time, "2026-10-12T12:00:00Z")
        val after = compute(target, time, "2026-10-12T12:00:01Z")
        assertEquals(1, before.totalSeconds)
        assertTrue(before.upcoming)
        assertEquals(0, at.totalSeconds)
        assertTrue(at.upcoming)
        assertTrue(at.isToday)
        assertEquals(1, after.totalSeconds)
        assertFalse(after.upcoming)
        assertTrue(after.isToday)
        assertFalse(after.isPast)
        val nextDay = compute(target, time, "2026-10-13T00:00:00Z")
        assertEquals(Direction.Since, nextDay.direction)
        assertTrue(nextDay.isPast)
    }

    @Test
    fun subSecondNowIsFlooredInTotals() {
        val c = compute(LocalDate(2026, 10, 13), now = "2026-10-12T23:59:58.500Z")
        assertEquals(1, c.totalSeconds)
        assertEquals(1, c.seconds)
    }

    @Test
    fun totalsAndBreakdownAgreeOverManyDays() {
        // Multi-unit conversion: total days against the years, months and days breakdown.
        val start = Instant.parse("2026-01-01T00:00:00Z")
        val target = LocalDate(2030, 1, 1)
        for (step in 0 until 400) {
            val now = start + (step * 3).days
            val c = CountdownEngine.compute(CountdownTarget(target), now, utc)
            val viaCalendar = now.toLocalDate().plusPeriod(c.years, c.months, c.days)
            assertEquals(target, viaCalendar, "breakdown of ${c.totalDays} days from $now")
            assertEquals(c.totalDays, (target.toEpochDays() - now.toLocalDate().toEpochDays()))
            assertEquals(c.totalDays / 7, (c.value(UnitMode.Weeks) as CountdownValue.WeeksDays).weeks)
        }
    }

    @Test
    fun workdaysMatchACountDayByDay() {
        val base = LocalDate(2026, 10, 1)
        for (a in 0 until 21) {
            for (b in 0 until 40) {
                val today = base.plus(a, DateTimeUnit.DAY)
                val occurrence = base.plus(b, DateTimeUnit.DAY)
                assertEquals(slowWorkdays(today, occurrence), CountdownEngine.workdays(today, occurrence), "$today $occurrence")
            }
        }
    }

    @Test
    fun workdaysOverYears() {
        val today = LocalDate(2026, 10, 12)
        val target = LocalDate(2031, 3, 4)
        assertEquals(slowWorkdays(today, target), CountdownEngine.workdays(today, target))
    }

    @Test
    fun yearlyStartsAtTheLaterOfTargetAndOriginalYear() {
        val occurrence = CountdownEngine.nextOccurrence(LocalDate(2020, 6, 1), Recurrence.Yearly(2028), LocalDate(2026, 1, 1))
        assertEquals(LocalDate(2028, 6, 1), occurrence)
    }

    @Test
    fun yearlyMovesToNextYearOnceTheDayPassed() {
        val occurrence = CountdownEngine.nextOccurrence(LocalDate(1990, 5, 17), Recurrence.Yearly(1990), LocalDate(2026, 5, 18))
        assertEquals(LocalDate(2027, 5, 17), occurrence)
    }

    @Test
    fun yearlyFeb29FallsOnFeb28OutsideLeapYearsAndBackOnLeapYears() {
        val base = LocalDate(2024, 2, 29)
        val r = Recurrence.Yearly(2024)
        assertEquals(LocalDate(2025, 2, 28), CountdownEngine.nextOccurrence(base, r, LocalDate(2024, 3, 1)))
        assertEquals(LocalDate(2028, 2, 29), CountdownEngine.nextOccurrence(base, r, LocalDate(2027, 3, 1)))
        assertEquals(LocalDate(2100, 2, 28), CountdownEngine.nextOccurrence(base, r, LocalDate(2100, 1, 1)))
        assertEquals(LocalDate(2400, 2, 29), CountdownEngine.nextOccurrence(base, r, LocalDate(2400, 1, 1)))
    }

    @Test
    fun monthlyKeepsTheAnchorDayAfterClamping() {
        val base = LocalDate(2026, 1, 31)
        assertEquals(LocalDate(2026, 2, 28), CountdownEngine.nextOccurrence(base, Recurrence.Monthly, LocalDate(2026, 2, 1)))
        assertEquals(LocalDate(2026, 3, 31), CountdownEngine.nextOccurrence(base, Recurrence.Monthly, LocalDate(2026, 3, 1)))
        assertEquals(LocalDate(2028, 2, 29), CountdownEngine.nextOccurrence(base, Recurrence.Monthly, LocalDate(2028, 2, 2)))
        assertEquals(LocalDate(2026, 4, 30), CountdownEngine.nextOccurrence(base, Recurrence.Monthly, LocalDate(2026, 4, 30)))
        assertEquals(LocalDate(2026, 5, 31), CountdownEngine.nextOccurrence(base, Recurrence.Monthly, LocalDate(2026, 5, 1)))
        assertEquals(LocalDate(2027, 1, 31), CountdownEngine.nextOccurrence(base, Recurrence.Monthly, LocalDate(2026, 12, 31).plus(1, DateTimeUnit.DAY)))
    }

    @Test
    fun monthlyBeforeTheFirstOccurrenceWaitsForIt() {
        val base = LocalDate(2027, 5, 10)
        assertEquals(base, CountdownEngine.nextOccurrence(base, Recurrence.Monthly, LocalDate(2026, 1, 1)))
    }

    @Test
    fun weeklyAndCustomDaysStepFromTheTargetDate() {
        val base = LocalDate(2026, 10, 5)
        assertEquals(base, CountdownEngine.nextOccurrence(base, Recurrence.Weekly, LocalDate(2026, 10, 1)))
        assertEquals(LocalDate(2026, 10, 12), CountdownEngine.nextOccurrence(base, Recurrence.Weekly, LocalDate(2026, 10, 6)))
        assertEquals(LocalDate(2026, 10, 12), CountdownEngine.nextOccurrence(base, Recurrence.Weekly, LocalDate(2026, 10, 12)))
        assertEquals(LocalDate(2026, 10, 8), CountdownEngine.nextOccurrence(base, Recurrence.CustomDays(3), LocalDate(2026, 10, 7)))
        assertEquals(LocalDate(2026, 10, 6), CountdownEngine.nextOccurrence(base, Recurrence.CustomDays(1), LocalDate(2026, 10, 6)))
    }

    @Test
    fun nonRepeatingDayKeepsItsDate() {
        val base = LocalDate(2020, 1, 1)
        assertEquals(base, CountdownEngine.nextOccurrence(base, Recurrence.None, LocalDate(2026, 1, 1)))
    }

    @Test
    fun anniversaryIsOnlyForYearly() {
        assertEquals(null, compute(LocalDate(2027, 1, 1), now = "2026-10-12T00:00:00Z").anniversary)
        val yearly = CountdownEngine.compute(
            CountdownTarget(LocalDate(2000, 10, 20), recurrence = Recurrence.Yearly(2000)),
            Instant.parse("2026-10-12T00:00:00Z"),
            utc,
        )
        assertEquals(26, yearly.anniversary)
    }

    @Test
    fun fixedZoneIgnoresTheViewerZoneAndFloatingUsesIt() {
        val now = Instant.parse("2026-12-31T10:00:00Z")
        val fixed = CountdownTarget(LocalDate(2027, 1, 1), timeZone = "Europe/Paris")
        val floating = CountdownTarget(LocalDate(2027, 1, 1))
        val fromTokyo = CountdownEngine.compute(fixed, now, zone("Asia/Tokyo"))
        val fromNewYork = CountdownEngine.compute(fixed, now, zone("America/New_York"))
        assertEquals(fromTokyo.target, fromNewYork.target)
        assertEquals(Instant.parse("2026-12-31T23:00:00Z"), fromTokyo.target)
        val floatTokyo = CountdownEngine.compute(floating, now, zone("Asia/Tokyo"))
        val floatNewYork = CountdownEngine.compute(floating, now, zone("America/New_York"))
        assertEquals(Instant.parse("2026-12-31T15:00:00Z"), floatTokyo.target)
        assertEquals(Instant.parse("2027-01-01T05:00:00Z"), floatNewYork.target)
    }

    @Test
    fun dstChangeKeepsWallClockDaysButNotElapsedHours() {
        // Across the New York spring-forward night, 2 calendar days are 47 elapsed hours.
        val c = CountdownEngine.compute(
            CountdownTarget(LocalDate(2026, 3, 9), LocalTime(12, 0), "America/New_York"),
            Instant.parse("2026-03-07T17:00:00Z"),
            utc,
        )
        assertEquals(2, c.days)
        assertEquals(47, c.totalHours)
        assertEquals(CountdownValue.HoursMinutes(47, 0), c.value(UnitMode.Auto))
        assertEquals(CountdownValue.Calendar(0, 0, 2), c.value(UnitMode.Calendar))
    }

    @Test
    fun targetOfEventAndPublicEventAreTheSame() {
        val theme = Theme("violet", "glass", "modern")
        val doc = EventDoc(
            id = "e",
            title = "t",
            targetDate = LocalDate(2027, 6, 12),
            targetTime = LocalTime(16, 30),
            timeZone = "Europe/Paris",
            recurrence = Recurrence.Yearly(2027),
            theme = theme,
        )
        val public = PublicEvent(
            rev = 1,
            title = "t",
            targetDate = doc.targetDate,
            targetTime = doc.targetTime,
            timeZone = doc.timeZone,
            recurrence = doc.recurrence,
            theme = theme,
        )
        assertEquals(CountdownTarget.of(doc), CountdownTarget.of(public))
    }

    @Test
    fun breakdownOfEqualTimesIsZero() {
        val t = LocalDateTime(2026, 10, 12, 8, 0)
        assertEquals(CountdownEngine.Breakdown(0, 0, 0, 0, 0, 0), CountdownEngine.breakdown(t, t))
    }

    private fun compute(date: LocalDate, time: LocalTime? = null, now: String): Countdown =
        CountdownEngine.compute(CountdownTarget(date, time, "UTC"), Instant.parse(now), utc)

    private fun Instant.toLocalDate(): LocalDate = LocalDate.fromEpochDays(epochSeconds.floorDiv(86_400L))

    private fun LocalDate.plusPeriod(years: Int, months: Int, days: Int): LocalDate =
        plus(years * 12 + months, DateTimeUnit.MONTH).plus(days, DateTimeUnit.DAY)

    /** Workdays counted one day at a time, as an independent check. */
    private fun slowWorkdays(today: LocalDate, occurrence: LocalDate): Long {
        val (from, to) = if (occurrence >= today) today to occurrence else occurrence to today
        var count = 0L
        var day = from
        while (day < to) {
            day = day.plus(1, DateTimeUnit.DAY)
            if (day.dayOfWeek != DayOfWeek.SATURDAY && day.dayOfWeek != DayOfWeek.SUNDAY) count++
        }
        return count
    }
}

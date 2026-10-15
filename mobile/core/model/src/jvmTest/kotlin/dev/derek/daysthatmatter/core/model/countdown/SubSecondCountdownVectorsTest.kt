package dev.derek.daysthatmatter.core.model.countdown

import dev.derek.daysthatmatter.core.model.event.UnitMode
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class SubSecondCountdownVectorsTest {
    private fun compute(name: String): Countdown = SubSecondCountdownVectors.cases.single { it.name == name }.compute()

    @Test
    fun untilFloorsTheRemainingFraction() {
        val c = compute("subsecond-until-floors")
        assertEquals(9, c.totalSeconds)
        assertEquals(9, c.seconds)
        assertTrue(c.upcoming)
    }

    @Test
    fun sinceFloorsTheElapsedFraction() {
        val c = compute("subsecond-since-floors")
        assertEquals(10, c.totalSeconds)
        assertEquals(10, c.seconds)
        assertFalse(c.upcoming)
    }

    @Test
    fun aFractionAroundZeroShowsZero() {
        val before = compute("subsecond-just-before-zero")
        assertEquals(0, before.totalSeconds)
        assertEquals(0, before.seconds)
        assertTrue(before.upcoming)
        val after = compute("subsecond-just-after-zero")
        assertEquals(0, after.totalSeconds)
        assertFalse(after.upcoming)
    }

    @Test
    fun dayBoundaryAndAuto() {
        val day = compute("subsecond-day-boundary")
        assertEquals(1, day.totalDays)
        assertEquals(24, day.totalHours)
        assertEquals(0, day.seconds)
        assertEquals(CountdownValue.HoursMinutes(47, 59), compute("subsecond-auto-below-48h").value(UnitMode.Auto))
    }

    @Test
    fun monthBreakdownWithAFraction() {
        val c = compute("subsecond-month-end-new-york")
        assertEquals(1, c.months)
        assertEquals(0, c.days)
        assertEquals(0, c.seconds)
    }

    @Test
    fun instantsBefore1970() {
        val c = compute("subsecond-before-1970")
        assertEquals(Direction.Today, c.direction)
        assertEquals(0, c.totalSeconds)
        assertTrue(c.upcoming)
    }

    @Test
    fun yearlySinceOnTheDay() {
        val c = compute("subsecond-yearly-since")
        assertEquals(Direction.Today, c.direction)
        assertEquals(6, c.anniversary)
        assertEquals(1_799, c.totalSeconds)
        assertEquals(59, c.seconds)
    }
}

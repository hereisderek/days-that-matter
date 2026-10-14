package dev.derek.daysthatmatter.feature.events.domain

import dev.derek.daysthatmatter.feature.events.NOW
import kotlinx.coroutines.flow.take
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.time.Clock
import kotlin.time.Duration.Companion.milliseconds
import kotlin.time.Duration.Companion.seconds
import kotlin.time.Instant

class TickerTest {

    /** A clock that follows the test's virtual time, starting 250 ms after a whole second. */
    private class VirtualClock(private val scope: TestScope, private val start: Instant) : Clock {
        override fun now(): Instant = start + scope.testScheduler.currentTime.milliseconds
    }

    @Test
    fun emitsAtOnceThenOnWholeSeconds() = runTest {
        val start = NOW + 250.milliseconds
        val ticks = ClockTicker(VirtualClock(this, start)).every(1.seconds).take(3).toList()

        assertEquals(listOf(start, NOW + 1.seconds, NOW + 2.seconds), ticks)
    }
}

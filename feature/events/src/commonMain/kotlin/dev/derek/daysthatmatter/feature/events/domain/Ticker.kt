package dev.derek.daysthatmatter.feature.events.domain

import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlin.time.Clock
import kotlin.time.Duration
import kotlin.time.Instant

/** The current time, now and then on each whole period, for live countdowns. */
fun interface Ticker {
    fun every(period: Duration): Flow<Instant>
}

/** [Ticker] on [clock]: emits at once, then at each whole [Ticker.every] period of the clock (12:00:01, 12:00:02, ...). */
class ClockTicker(private val clock: Clock) : Ticker {
    override fun every(period: Duration): Flow<Instant> = flow {
        val step = period.inWholeMilliseconds
        while (true) {
            val now = clock.now()
            emit(now)
            delay(step - now.toEpochMilliseconds().mod(step))
        }
    }
}

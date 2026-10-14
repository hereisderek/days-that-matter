package dev.derek.daysthatmatter.feature.events.domain

import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlin.time.Clock
import kotlin.time.Duration
import kotlin.time.Duration.Companion.seconds

/** Emits the current time now and then on each whole [period] of [clock], for live countdowns. */
class Ticker(private val clock: Clock) {
    fun every(period: Duration = 1.seconds): Flow<kotlin.time.Instant> = flow {
        val step = period.inWholeMilliseconds
        while (true) {
            val now = clock.now()
            emit(now)
            delay(step - now.toEpochMilliseconds().mod(step))
        }
    }
}

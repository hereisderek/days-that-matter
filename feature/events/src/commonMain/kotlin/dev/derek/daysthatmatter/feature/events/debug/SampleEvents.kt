package dev.derek.daysthatmatter.feature.events.debug

import dev.derek.daysthatmatter.core.model.event.CardSize
import dev.derek.daysthatmatter.core.model.event.EventDoc
import dev.derek.daysthatmatter.core.model.event.Recurrence
import dev.derek.daysthatmatter.core.model.event.Role
import dev.derek.daysthatmatter.core.model.event.Theme
import dev.derek.daysthatmatter.core.model.event.UnitMode
import dev.derek.daysthatmatter.feature.events.domain.Categories
import dev.derek.daysthatmatter.feature.events.domain.EventRepository
import kotlinx.datetime.DatePeriod
import kotlinx.datetime.DateTimeUnit
import kotlinx.datetime.LocalDate
import kotlinx.datetime.LocalTime
import kotlinx.datetime.TimeZone
import kotlinx.datetime.minus
import kotlinx.datetime.plus
import kotlinx.datetime.todayIn
import kotlin.time.Clock
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Instant

/**
 * DEBUG ONLY. The sample days of the design gallery (`DesignGallery` in :core:designsystem) and of design/v2's
 * seed, as documents relative to [today]. Never call this from a release build: the app shell runs
 * [SeedSampleEventsUseCase] only when the build is debuggable.
 */
object SampleEvents {
    fun create(today: LocalDate, now: Instant, deviceZone: TimeZone): List<EventDoc> {
        fun rel(days: Int) = today.plus(days, DateTimeUnit.DAY)
        fun theme(palette: String, style: String = "glass", type: String = "sans", size: CardSize = CardSize.Medium) =
            Theme(paletteId = palette, cardStyle = style, typography = type, size = size)
        val miaDate = rel(23).minus(DatePeriod(years = 7))
        return listOf(
            EventDoc(
                id = "sample-norway", role = Role.Owner, title = "Norway trip", emoji = "🏔️",
                targetDate = rel(38), targetTime = LocalTime(9, 30), timeZone = "Europe/Oslo",
                theme = theme("dusk"), categoryId = Categories.Travel.id, pinnedAt = now - 1.minutes,
                notes = "Rain jackets. Train seats 41 and 42.",
            ),
            EventDoc(
                id = "sample-mia", role = Role.Owner, title = "Mia's birthday", emoji = "🎂",
                targetDate = miaDate, recurrence = Recurrence.Yearly(miaDate.year),
                theme = theme("peach", style = "clean", type = "rounded"), categoryId = Categories.Birthdays.id,
                pinnedAt = now - 3.minutes,
            ),
            EventDoc(
                id = "sample-together", role = Role.Owner, title = "Together", emoji = "💞",
                targetDate = LocalDate(2021, 5, 20), unitMode = UnitMode.Days,
                theme = theme("lagoon", type = "serif", size = CardSize.Large), categoryId = Categories.Anniversaries.id,
                pinnedAt = now - 2.minutes,
            ),
            EventDoc(
                id = "sample-payday", role = Role.Owner, title = "Payday", emoji = "💸",
                targetDate = LocalDate(2025, 1, minOf(today.day, 28)), recurrence = Recurrence.Monthly,
                theme = theme("butter", style = "clean", size = CardSize.Small), categoryId = Categories.Work.id,
            ),
            EventDoc(
                id = "sample-launch", role = Role.Owner, title = "App launch", emoji = "🚀",
                targetDate = rel(49), targetTime = LocalTime(10, 0), timeZone = deviceZone.id, unitMode = UnitMode.Workdays,
                theme = theme("ocean", style = "outline", type = "mono"), categoryId = Categories.Work.id,
            ),
            EventDoc(
                id = "sample-marathon", role = Role.Owner, title = "Spring marathon", emoji = "🏃",
                targetDate = rel(158), unitMode = UnitMode.Weeks,
                theme = theme("citrus", style = "poster", type = "condensed"), categoryId = Categories.Life.id,
            ),
            EventDoc(
                id = "sample-mochi", role = Role.Owner, title = "Mochi came home", emoji = "🐶",
                targetDate = LocalDate(2024, 3, 9), theme = theme("butter", type = "serif"), categoryId = Categories.Life.id,
            ),
            EventDoc(
                id = "sample-night-shift", role = Role.Owner, title = "Night shift", emoji = "🌙",
                targetDate = rel(12), theme = theme("deep-sea"),
            ),
            EventDoc(
                id = "sample-grandma", role = Role.Editor, title = "Grandma's 90th", emoji = "🎉",
                targetDate = rel(64), targetTime = LocalTime(12, 0), theme = theme("berry", type = "serif"),
            ),
            EventDoc(
                id = "sample-driving-test", role = Role.Owner, title = "Driving test", emoji = "🚗",
                targetDate = rel(-120), theme = theme("sky", size = CardSize.Small), categoryId = Categories.Life.id,
                archivedAt = now - 10.minutes,
            ),
        )
    }
}

/** DEBUG ONLY. Fills an empty database with [SampleEvents] so the screens have something to show on a device. */
class SeedSampleEventsUseCase(
    private val repository: EventRepository,
    private val clock: Clock,
    private val zone: () -> TimeZone,
) {
    /** Returns true when it seeded; does nothing when any day is stored. */
    suspend operator fun invoke(): Boolean {
        if (!repository.isEmpty()) return false
        val now = clock.now()
        val zone = zone()
        repository.add(SampleEvents.create(clock.todayIn(zone), now, zone), now)
        return true
    }
}

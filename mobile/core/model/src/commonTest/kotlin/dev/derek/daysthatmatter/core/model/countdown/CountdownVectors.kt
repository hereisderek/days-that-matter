package dev.derek.daysthatmatter.core.model.countdown

import dev.derek.daysthatmatter.core.model.event.HmsTimeSerializer
import dev.derek.daysthatmatter.core.model.event.Recurrence
import dev.derek.daysthatmatter.core.model.event.UnitMode
import dev.derek.daysthatmatter.core.model.zone
import kotlinx.datetime.LocalDate
import kotlin.time.Instant

/** Marks an expectation that is not checked. */
const val UNCHECKED: Int = Int.MIN_VALUE

/**
 * Expected outputs of one case. Null (or [UNCHECKED] for [anniversary]) means "not checked";
 * the vector file records every output regardless.
 */
data class Expected(
    val target: String? = null,
    val occurrence: String? = null,
    val direction: Direction? = null,
    val totalDays: Long? = null,
    val totalHours: Long? = null,
    val totalMinutes: Long? = null,
    val totalSeconds: Long? = null,
    val years: Int? = null,
    val months: Int? = null,
    val days: Int? = null,
    val hours: Int? = null,
    val minutes: Int? = null,
    val seconds: Int? = null,
    val anniversary: Int? = UNCHECKED,
    val workdays: Long? = null,
    val units: Map<UnitMode, CountdownValue> = emptyMap(),
)

/** One countdown parity case: inputs as the API carries them, and what the engine must produce. */
data class CountdownCase(
    val name: String,
    val timeZone: String?,
    val targetDate: String,
    val targetTime: String?,
    val recurrence: Recurrence,
    val viewerZone: String?,
    val now: String,
    val expected: Expected,
) {
    val target: CountdownTarget
        get() = CountdownTarget(
            targetDate = LocalDate.parse(targetDate),
            targetTime = targetTime?.let { HmsTimeSerializer.parse(it) },
            timeZone = timeZone,
            recurrence = recurrence,
        )

    fun compute(): Countdown = CountdownEngine.compute(target, Instant.parse(now), zone(viewerZone ?: "UTC"))
}

/**
 * Countdown parity cases. The first 18 are the vectors of the old share service
 * (`services/share/test/fixtures/countdown-vectors.json`) with the same expectations; the rest cover
 * the six unit modes, workdays, leap days, DST in both hemispheres and hitting zero.
 */
object CountdownVectors {
    private fun yearly(year: Int) = Recurrence.Yearly(year)

    val cases: List<CountdownCase> = listOf(
        CountdownCase(
            "future-utc-date-only", "UTC", "2027-01-01", null, Recurrence.None, null, "2026-10-10T15:00:00Z",
            Expected("2027-01-01T00:00:00Z", direction = Direction.Until, totalDays = 82, years = 0, months = 2, days = 21, hours = 9, minutes = 0, seconds = 0, anniversary = null),
        ),
        CountdownCase(
            "past-leap-origin", "UTC", "2020-02-29", "12:00:00", Recurrence.None, null, "2026-10-10T15:00:00Z",
            Expected("2020-02-29T12:00:00Z", direction = Direction.Since, totalDays = 2415, years = 6, months = 7, days = 11, hours = 3, minutes = 0, seconds = 0, anniversary = null),
        ),
        CountdownCase(
            "yearly-feb29-clamped", "UTC", "2024-02-29", null, yearly(2024), null, "2026-10-10T15:00:00Z",
            Expected("2027-02-28T00:00:00Z", direction = Direction.Until, totalDays = 140, years = 0, months = 4, days = 17, hours = 9, minutes = 0, seconds = 0, anniversary = 3),
        ),
        CountdownCase(
            "yearly-feb29-leap-year", "UTC", "2024-02-29", null, yearly(2024), null, "2027-12-01T00:00:00Z",
            Expected("2028-02-29T00:00:00Z", direction = Direction.Until, totalDays = 90, years = 0, months = 2, days = 28, hours = 0, minutes = 0, seconds = 0, anniversary = 4),
        ),
        CountdownCase(
            "yearly-day-of-event-london", "Europe/London", "1990-05-17", null, yearly(1990), null, "2026-05-17T10:00:00Z",
            Expected("2026-05-16T23:00:00Z", direction = Direction.Today, totalDays = 0, years = 0, months = 0, days = 0, hours = 11, minutes = 0, seconds = 0, anniversary = 36),
        ),
        CountdownCase(
            "monthly-clamp-feb", "UTC", "2026-01-31", "09:00:00", Recurrence.Monthly, null, "2026-02-15T00:00:00Z",
            Expected("2026-02-28T09:00:00Z", direction = Direction.Until, totalDays = 13, years = 0, months = 0, days = 13, hours = 9, minutes = 0, seconds = 0, anniversary = null),
        ),
        CountdownCase(
            "monthly-back-to-31", "UTC", "2026-01-31", "09:00:00", Recurrence.Monthly, null, "2026-03-01T00:00:00Z",
            Expected("2026-03-31T09:00:00Z", direction = Direction.Until, totalDays = 30, years = 0, months = 0, days = 30, hours = 9, minutes = 0, seconds = 0, anniversary = null),
        ),
        CountdownCase(
            "weekly-new-york", "America/New_York", "2026-10-05", "18:00:00", Recurrence.Weekly, null, "2026-10-10T15:00:00Z",
            Expected("2026-10-12T22:00:00Z", direction = Direction.Until, totalDays = 2, totalHours = 55, years = 0, months = 0, days = 2, hours = 7, minutes = 0, seconds = 0, anniversary = null),
        ),
        CountdownCase(
            "custom-days-10", "UTC", "2026-10-01", null, Recurrence.CustomDays(10), null, "2026-10-10T15:00:00Z",
            Expected("2026-10-11T00:00:00Z", direction = Direction.Until, totalDays = 0, years = 0, months = 0, days = 0, hours = 9, minutes = 0, seconds = 0, anniversary = null),
        ),
        CountdownCase(
            "dst-gap-spring-forward", "America/New_York", "2026-03-08", "02:30:00", Recurrence.None, null, "2026-03-07T12:00:00Z",
            Expected("2026-03-08T07:30:00Z", direction = Direction.Until, totalDays = 0, totalHours = 19, totalMinutes = 1170, years = 0, months = 0, days = 0, hours = 19, minutes = 30, seconds = 0, anniversary = null),
        ),
        CountdownCase(
            "dst-overlap-fall-back", "America/New_York", "2026-11-01", "01:30:00", Recurrence.None, null, "2026-10-31T12:00:00Z",
            Expected("2026-11-01T05:30:00Z", direction = Direction.Until, totalDays = 0, totalHours = 17, totalMinutes = 1050, years = 0, months = 0, days = 0, hours = 17, minutes = 30, seconds = 0, anniversary = null),
        ),
        CountdownCase(
            "dst-spanning-interval", "America/New_York", "2026-03-09", "12:00:00", Recurrence.None, null, "2026-03-07T17:00:00Z",
            Expected("2026-03-09T16:00:00Z", direction = Direction.Until, totalDays = 1, totalHours = 47, years = 0, months = 0, days = 2, hours = 0, minutes = 0, seconds = 0, anniversary = null),
        ),
        CountdownCase(
            "floating-auckland", null, "2027-01-01", null, Recurrence.None, "Pacific/Auckland", "2026-12-31T10:00:00Z",
            Expected("2026-12-31T11:00:00Z", direction = Direction.Until, totalDays = 0, totalMinutes = 60, years = 0, months = 0, days = 0, hours = 1, minutes = 0, seconds = 0, anniversary = null),
        ),
        CountdownCase(
            "floating-honolulu", null, "2027-01-01", null, Recurrence.None, "Pacific/Honolulu", "2026-12-31T10:00:00Z",
            Expected("2027-01-01T10:00:00Z", direction = Direction.Until, totalDays = 1, totalHours = 24, years = 0, months = 0, days = 1, hours = 0, minutes = 0, seconds = 0, anniversary = null),
        ),
        CountdownCase(
            "since-one-second", "UTC", "2025-12-31", "23:59:59", Recurrence.None, null, "2026-01-01T00:00:00Z",
            Expected("2025-12-31T23:59:59Z", direction = Direction.Since, totalDays = 0, totalSeconds = 1, years = 0, months = 0, days = 0, hours = 0, minutes = 0, seconds = 1, anniversary = null),
        ),
        CountdownCase(
            "yearly-future-start", "UTC", "2030-06-01", null, yearly(2030), null, "2026-10-10T15:00:00Z",
            Expected("2030-06-01T00:00:00Z", direction = Direction.Until, totalDays = 1329, years = 3, months = 7, days = 21, hours = 9, minutes = 0, seconds = 0, anniversary = 0),
        ),
        CountdownCase(
            "same-day-later-today", "UTC", "2026-10-10", "20:00:00", Recurrence.None, null, "2026-10-10T15:00:00Z",
            Expected("2026-10-10T20:00:00Z", direction = Direction.Today, totalDays = 0, years = 0, months = 0, days = 0, hours = 5, minutes = 0, seconds = 0, anniversary = null),
        ),
        CountdownCase(
            "past-month-end-clamp", "UTC", "2026-01-31", null, Recurrence.None, null, "2026-03-01T00:00:00Z",
            Expected("2026-01-31T00:00:00Z", direction = Direction.Since, totalDays = 29, years = 0, months = 1, days = 1, hours = 0, minutes = 0, seconds = 0, anniversary = null),
        ),
        // Unit modes (`countdown-units` spec scenarios).
        CountdownCase(
            "units-weeks-158-days", "UTC", "2027-03-19", null, Recurrence.None, null, "2026-10-12T00:00:00Z",
            Expected(
                "2027-03-19T00:00:00Z", direction = Direction.Until, totalDays = 158,
                units = mapOf(UnitMode.Weeks to CountdownValue.WeeksDays(22, 4), UnitMode.Days to CountdownValue.Days(158)),
            ),
        ),
        CountdownCase(
            "units-hours-38", "UTC", "2026-10-14", null, Recurrence.None, null, "2026-10-12T09:30:00Z",
            Expected(
                "2026-10-14T00:00:00Z", direction = Direction.Until, totalHours = 38,
                units = mapOf(
                    UnitMode.Hours to CountdownValue.Hours(38),
                    UnitMode.Auto to CountdownValue.HoursMinutes(38, 30),
                    UnitMode.Days to CountdownValue.Days(1),
                ),
            ),
        ),
        CountdownCase(
            "units-auto-30h15m", "UTC", "2026-10-13", "06:15:00", Recurrence.None, null, "2026-10-12T00:00:00Z",
            Expected(units = mapOf(UnitMode.Auto to CountdownValue.HoursMinutes(30, 15))),
        ),
        CountdownCase(
            "units-auto-at-48h", "UTC", "2026-10-14", null, Recurrence.None, null, "2026-10-12T00:00:00Z",
            Expected(totalHours = 48, units = mapOf(UnitMode.Auto to CountdownValue.Days(2))),
        ),
        CountdownCase(
            "units-auto-below-48h", "UTC", "2026-10-13", "23:59:59", Recurrence.None, null, "2026-10-12T00:00:00Z",
            Expected(totalHours = 47, units = mapOf(UnitMode.Auto to CountdownValue.HoursMinutes(47, 59))),
        ),
        CountdownCase(
            "units-calendar", "UTC", "2029-02-20", null, Recurrence.None, null, "2026-10-12T00:00:00Z",
            Expected(years = 2, months = 4, days = 8, units = mapOf(UnitMode.Calendar to CountdownValue.Calendar(2, 4, 8))),
        ),
        CountdownCase(
            "units-auto-count-up", "UTC", "2026-10-11", "12:00:00", Recurrence.None, null, "2026-10-12T00:00:01Z",
            Expected(
                "2026-10-11T12:00:00Z", direction = Direction.Since, totalSeconds = 43_201, workdays = 1,
                units = mapOf(UnitMode.Auto to CountdownValue.HoursMinutes(12, 0), UnitMode.Workdays to CountdownValue.Workdays(1)),
            ),
        ),
        // Workdays (`countdown-units` spec scenarios). 12 October 2026 is a Monday.
        CountdownCase(
            "workdays-deadline", "UTC", "2026-10-23", null, Recurrence.None, null, "2026-10-12T08:00:00Z",
            Expected(direction = Direction.Until, workdays = 9, units = mapOf(UnitMode.Workdays to CountdownValue.Workdays(9))),
        ),
        CountdownCase(
            "workdays-saturday-target", "UTC", "2026-10-17", null, Recurrence.None, null, "2026-10-12T08:00:00Z",
            Expected(direction = Direction.Until, workdays = 4),
        ),
        CountdownCase(
            "workdays-count-up-from-friday", "UTC", "2026-10-09", null, Recurrence.None, null, "2026-10-12T08:00:00Z",
            Expected(direction = Direction.Since, workdays = 1),
        ),
        CountdownCase(
            "workdays-target-day", "UTC", "2026-10-12", "17:00:00", Recurrence.None, null, "2026-10-12T08:00:00Z",
            Expected(direction = Direction.Today, workdays = 0),
        ),
        CountdownCase(
            "workdays-holiday-counted", "UTC", "2026-12-28", null, Recurrence.None, null, "2026-12-21T08:00:00Z",
            Expected(direction = Direction.Until, workdays = 5),
        ),
        CountdownCase(
            "workdays-floating-zone-date", null, "2026-10-17", null, Recurrence.None, "Pacific/Auckland", "2026-10-11T20:00:00Z",
            Expected(occurrence = "2026-10-17", direction = Direction.Until, workdays = 4),
        ),
        // Hitting zero and the day of the event.
        CountdownCase(
            "zero-exact", "UTC", "2026-10-12", "12:00:00", Recurrence.None, null, "2026-10-12T12:00:00Z",
            Expected("2026-10-12T12:00:00Z", direction = Direction.Today, totalSeconds = 0, hours = 0, minutes = 0, seconds = 0),
        ),
        CountdownCase(
            "zero-one-second-before", "UTC", "2026-10-12", "12:00:00", Recurrence.None, null, "2026-10-12T11:59:59Z",
            Expected(direction = Direction.Today, totalSeconds = 1, seconds = 1),
        ),
        CountdownCase(
            "zero-one-second-after", "UTC", "2026-10-12", "12:00:00", Recurrence.None, null, "2026-10-12T12:00:01Z",
            Expected(direction = Direction.Today, totalSeconds = 1, seconds = 1),
        ),
        CountdownCase(
            "day-before-midnight", "UTC", "2026-10-13", null, Recurrence.None, null, "2026-10-12T23:59:59Z",
            Expected(direction = Direction.Until, totalSeconds = 1, totalDays = 0, workdays = 1),
        ),
        // Leap years.
        CountdownCase(
            "leap-day-countdown", "UTC", "2028-02-29", null, Recurrence.None, null, "2028-02-28T00:00:00Z",
            Expected("2028-02-29T00:00:00Z", totalDays = 1, days = 1),
        ),
        CountdownCase(
            "yearly-feb29-century-2100", "UTC", "2096-02-29", null, yearly(2096), null, "2100-01-01T00:00:00Z",
            Expected("2100-02-28T00:00:00Z", occurrence = "2100-02-28", anniversary = 4),
        ),
        CountdownCase(
            "yearly-feb29-today-clamped", "UTC", "2024-02-29", null, yearly(2024), null, "2027-02-28T10:00:00Z",
            Expected(occurrence = "2027-02-28", direction = Direction.Today, anniversary = 3),
        ),
        CountdownCase(
            "calendar-across-leap-day", "UTC", "2028-03-01", null, Recurrence.None, null, "2028-01-31T00:00:00Z",
            Expected(totalDays = 30, years = 0, months = 1, days = 1),
        ),
        // DST in Europe and the southern hemisphere, and offsets that are not whole hours.
        CountdownCase(
            "dst-overlap-paris", "Europe/Paris", "2026-10-25", "02:30:00", Recurrence.None, null, "2026-10-24T22:00:00Z",
            Expected("2026-10-25T00:30:00Z", direction = Direction.Today, totalMinutes = 150, hours = 2, minutes = 30),
        ),
        CountdownCase(
            "dst-gap-paris", "Europe/Paris", "2026-03-29", "02:30:00", Recurrence.None, null, "2026-03-28T23:00:00Z",
            Expected("2026-03-29T01:30:00Z", direction = Direction.Today, totalMinutes = 150, hours = 2, minutes = 30),
        ),
        CountdownCase(
            "dst-overlap-sydney", "Australia/Sydney", "2026-04-05", "02:30:00", Recurrence.None, null, "2026-04-04T00:00:00Z",
            Expected("2026-04-04T15:30:00Z", direction = Direction.Until),
        ),
        CountdownCase(
            "half-hour-kolkata", "Asia/Kolkata", "2026-10-12", null, Recurrence.None, null, "2026-10-11T18:00:00Z",
            Expected("2026-10-11T18:30:00Z", direction = Direction.Until, totalMinutes = 30),
        ),
        CountdownCase(
            "floating-tokyo", null, "2027-01-01", null, Recurrence.None, "Asia/Tokyo", "2026-12-31T14:00:00Z",
            Expected("2026-12-31T15:00:00Z", direction = Direction.Until, totalMinutes = 60),
        ),
        CountdownCase(
            "weekly-dst-new-york", "America/New_York", "2026-10-26", "09:00:00", Recurrence.Weekly, null, "2026-11-02T00:00:00Z",
            Expected("2026-11-02T14:00:00Z", occurrence = "2026-11-02", direction = Direction.Until),
        ),
        // Recurrence.
        CountdownCase(
            "monthly-today", "UTC", "2026-01-15", null, Recurrence.Monthly, null, "2026-10-15T20:00:00Z",
            Expected(occurrence = "2026-10-15", direction = Direction.Today),
        ),
        CountdownCase(
            "monthly-day-passed-this-month", "UTC", "2026-01-15", "10:00:00", Recurrence.Monthly, null, "2026-03-20T00:00:00Z",
            Expected("2026-04-15T10:00:00Z", occurrence = "2026-04-15", direction = Direction.Until, totalDays = 26),
        ),
        CountdownCase(
            "monthly-december-31", "UTC", "2026-01-31", null, Recurrence.Monthly, null, "2026-12-31T12:00:00Z",
            Expected(occurrence = "2026-12-31", direction = Direction.Today),
        ),
        CountdownCase(
            "custom-days-100", "UTC", "2026-01-01", null, Recurrence.CustomDays(100), null, "2026-10-12T00:00:00Z",
            Expected(occurrence = "2026-10-28", totalDays = 16),
        ),
        CountdownCase(
            "weekly-on-target-day", "UTC", "2026-10-12", "18:00:00", Recurrence.Weekly, null, "2026-10-12T20:00:00Z",
            Expected(occurrence = "2026-10-12", direction = Direction.Today),
        ),
    )
}

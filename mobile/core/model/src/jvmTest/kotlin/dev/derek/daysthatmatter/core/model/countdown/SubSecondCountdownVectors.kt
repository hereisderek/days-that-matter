package dev.derek.daysthatmatter.core.model.countdown

import dev.derek.daysthatmatter.core.model.event.Recurrence

/**
 * Parity cases with a `nowInstant` that has a fraction of a second, as a browser clock gives.
 * The engine floors totals and the breakdown, so a fraction never shows as a whole second; the
 * share page's `countdown.js` must do the same. Written to the vector file after [CountdownVectors]
 * by [main] in `CountdownVectorWriter.kt`. Their expectations are checked in
 * `SubSecondCountdownVectorsTest`, so [Expected] is left empty here.
 */
object SubSecondCountdownVectors {
    private fun case(name: String, zone: String?, date: String, time: String?, now: String, recurrence: Recurrence = Recurrence.None) =
        CountdownCase(name, zone, date, time, recurrence, null, now, Expected())

    val cases: List<CountdownCase> = listOf(
        case("subsecond-until-floors", "UTC", "2026-10-12", "12:00:10", "2026-10-12T12:00:00.250Z"),
        case("subsecond-since-floors", "UTC", "2026-10-12", "12:00:00", "2026-10-12T12:00:10.999Z"),
        case("subsecond-just-before-zero", "UTC", "2026-10-12", "12:00:00", "2026-10-12T11:59:59.999Z"),
        case("subsecond-just-after-zero", "UTC", "2026-10-12", "12:00:00", "2026-10-12T12:00:00.001Z"),
        case("subsecond-day-boundary", "UTC", "2026-10-13", null, "2026-10-11T23:59:59.500Z"),
        case("subsecond-auto-below-48h", "UTC", "2026-10-14", null, "2026-10-12T00:00:00.001Z"),
        case("subsecond-month-end-new-york", "America/New_York", "2026-12-01", null, "2026-11-01T03:59:59.900Z"),
        case("subsecond-before-1970", "UTC", "1969-07-20", "20:17:40", "1969-07-20T20:17:39.400Z"),
        case("subsecond-yearly-since", "Asia/Kolkata", "2020-10-12", "09:00:00", "2026-10-12T03:59:59.750Z", Recurrence.Yearly(2020)),
    )
}

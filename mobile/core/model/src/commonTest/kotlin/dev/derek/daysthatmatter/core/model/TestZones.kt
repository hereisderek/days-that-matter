package dev.derek.daysthatmatter.core.model

import kotlinx.datetime.TimeZone

/**
 * Makes the IANA time zone database available to kotlinx-datetime. Needed on JS only, where the
 * zones come from the npm package `@js-joda/timezone`; a no-op on the other targets.
 */
expect fun loadTimeZoneDatabase()

/** The zone [id], with the database loaded. */
fun zone(id: String): TimeZone {
    loadTimeZoneDatabase()
    return TimeZone.of(id)
}

/**
 * A string holding the single UTF-16 unit [code], built at run time. The Kotlin/JS compiler folds
 * constant expressions into literals, and a lone surrogate does not survive its UTF-8 output.
 */
fun utf16Unit(code: Int): String = CharArray(1) { code.toChar() }.concatToString()

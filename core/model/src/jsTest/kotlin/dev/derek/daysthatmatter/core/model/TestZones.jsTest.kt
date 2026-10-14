package dev.derek.daysthatmatter.core.model

/** Importing the package registers its zone rules with js-joda, which kotlinx-datetime uses on JS. */
@JsModule("@js-joda/timezone")
@JsNonModule
external object JsJodaTimeZoneModule

// Referencing the module is what loads it; the value itself is not needed.
@Suppress("UNUSED_EXPRESSION")
actual fun loadTimeZoneDatabase() {
    JsJodaTimeZoneModule
}

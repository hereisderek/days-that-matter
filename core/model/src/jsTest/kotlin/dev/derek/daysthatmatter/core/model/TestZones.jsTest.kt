package dev.derek.daysthatmatter.core.model

/** Importing the package registers its zone rules with js-joda, which kotlinx-datetime uses on JS. */
@JsModule("@js-joda/timezone")
@JsNonModule
external object JsJodaTimeZoneModule

actual fun loadTimeZoneDatabase() {
    JsJodaTimeZoneModule
}

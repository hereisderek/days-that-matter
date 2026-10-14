package dev.derek.daysthatmatter.core.model

import kotlinx.serialization.json.Json

/**
 * The JSON configuration shared by the app and the backend for every `:core:model` type.
 *
 * Unknown fields are ignored on read so an older client can read documents written by a newer one.
 * Default values are not written, which keeps payloads small.
 */
val ModelJson: Json = Json {
    ignoreUnknownKeys = true
    encodeDefaults = false
    explicitNulls = false
}

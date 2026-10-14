package dev.derek.daysthatmatter.core.model.event

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonClassDiscriminator

/** `backdrop.kind`. */
@Serializable
enum class BackdropKind {
    /** A still photo: [Backdrop.stillId] only. */
    @SerialName("still") Still,

    /** An animated photo: [Backdrop.stillId] is the key photo, [Backdrop.motionId] the MP4. */
    @SerialName("animated") Animated,
}

/**
 * A photo backdrop (BACKEND.md section 7.2, design D9).
 *
 * @property dim scrim from 0 to 0.8.
 * @property blur radius from 0 to 16 in points at a 390 pt card width, scaled with the card.
 * @property stillUrl set by the server on reads; ignored in writes.
 * @property motionUrl set by the server on reads; ignored in writes.
 */
@Serializable
data class Backdrop(
    val kind: BackdropKind,
    val stillId: String,
    val motionId: String? = null,
    val dim: Double,
    val blur: Double = 0.0,
    val stillUrl: String? = null,
    val motionUrl: String? = null,
) {
    /** Blur radius in points for a card of [cardWidth] points (design D9). */
    fun blurRadiusFor(cardWidth: Double): Double = blur * cardWidth / REFERENCE_CARD_WIDTH

    companion object {
        /** Card width in points that [blur] is given for. */
        const val REFERENCE_CARD_WIDTH: Double = 390.0
    }
}

/**
 * A day's background audio: one of a built-in track, a custom file from the writer's library, or a
 * Spotify link (BACKEND.md section 7.2, design D15).
 */
@OptIn(ExperimentalSerializationApi::class)
@Serializable
@JsonClassDiscriminator("kind")
sealed interface Audio {
    /** A track of the built-in catalog. */
    @Serializable
    @SerialName("library")
    data class Library(val trackId: String) : Audio

    /** A custom audio file from the writer's library. Never in a public link projection. */
    @Serializable
    @SerialName("custom")
    data class Custom(val mediaId: String, val title: String) : Audio

    /** An `open.spotify.com` track, album or playlist; title and artist come from the app (oEmbed). */
    @Serializable
    @SerialName("spotify")
    data class Spotify(val url: String, val title: String? = null, val artist: String? = null) : Audio
}

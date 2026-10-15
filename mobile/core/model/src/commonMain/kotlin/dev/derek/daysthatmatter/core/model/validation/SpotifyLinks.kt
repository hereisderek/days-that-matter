package dev.derek.daysthatmatter.core.model.validation

/**
 * Spotify links an event may use (BACKEND.md section 7.2): `https://open.spotify.com/` track, album
 * or playlist URLs. An `intl-xx/` segment is allowed; the query and fragment are dropped.
 */
object SpotifyLinks {
    enum class Kind { Track, Album, Playlist }

    /** A parsed link; [url] is the normalized form that is stored. */
    data class Link(val kind: Kind, val id: String, val url: String)

    private val pattern = Regex(
        "^https://open\\.spotify\\.com/(intl-[a-z]{2}/)?(track|album|playlist)/([A-Za-z0-9]{22})/?(\\?[^#\\s]*)?(#\\S*)?$",
    )

    /** Parses [url], or returns null when it is not a supported Spotify link. */
    fun parse(url: String): Link? {
        val m = pattern.matchEntire(url) ?: return null
        val intl = m.groupValues[1]
        val kind = m.groupValues[2]
        val id = m.groupValues[3]
        return Link(
            kind = Kind.entries.first { it.name.lowercase() == kind },
            id = id,
            url = "https://open.spotify.com/$intl$kind/$id",
        )
    }
}

package dev.derek.daysthatmatter.feature.settings.domain

/**
 * Time-of-day greeting for Home:
 * - Morning (05:00 to 11:59): "Good morning"
 * - Afternoon (12:00 to 16:59): "Good afternoon"
 * - Evening / Night (17:00 to 04:59): "Good evening"
 *
 * Appends ", {Name}" when a non-blank name is provided.
 */
object Greeting {
    fun format(hour: Int, name: String? = null): String {
        val clean = name?.trim().orEmpty()
        val base = when (hour) {
            in 5..11 -> "Good morning"
            in 12..16 -> "Good afternoon"
            else -> "Good evening"
        }
        return if (clean.isNotEmpty()) "$base, $clean" else base
    }
}

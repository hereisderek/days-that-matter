package dev.derek.daysthatmatter.core.designsystem.theme

import androidx.compose.ui.graphics.Color
import dev.derek.daysthatmatter.core.designsystem.components.CardBackground

/** A named color swatch (`COLORS` in design/v2/app.js). */
data class CardSwatch(val name: String, val color: Color)

/** Edge color of an Outline card over a photo (`edgeColor` in design/v2/app.js). */
val PhotoEdgeColor = Color(0xFF8FA39A)

/** Backdrop colors for cards. Not tied to the app theme: a Mint card is Mint in light and dark. */
object CardPalette {
    val Mint = CardSwatch("Mint", Color(0xFFCDEFDF))

    /** The 16 swatches of Customize > Background > Color: eight pastels, then eight saturated and dark ones. */
    val swatches: List<CardSwatch> = listOf(
        Mint,
        CardSwatch("Sky", Color(0xFFCFE5F8)),
        CardSwatch("Peach", Color(0xFFFADDCB)),
        CardSwatch("Lilac", Color(0xFFE2DBF6)),
        CardSwatch("Butter", Color(0xFFF7ECB9)),
        CardSwatch("Blush", Color(0xFFF6D3DC)),
        CardSwatch("Sage", Color(0xFFD9E3D0)),
        CardSwatch("Mist", Color(0xFFE5E8EC)),
        CardSwatch("Jade", Color(0xFF0E7F5A)),
        CardSwatch("Ocean", Color(0xFF2D6CDF)),
        CardSwatch("Coral", Color(0xFFC8472E)),
        CardSwatch("Plum", Color(0xFF7B4CC6)),
        CardSwatch("Marigold", Color(0xFFF0B429)),
        CardSwatch("Forest", Color(0xFF1F3D33)),
        CardSwatch("Ink", Color(0xFF18201C)),
        CardSwatch("Paper", Color(0xFFFBFAF6)),
    )

    /** The eight gradient presets (`GRADS` in design/v2/app.js): a base color and three blobs. */
    val gradients: List<Pair<String, CardBackground.Mesh>> = listOf(
        "Lagoon" to mesh(0xFFE3F4EE, 0xFFC2F1E0, 0xFFBCDDFF, 0xFFDAF6C6),
        "Morning" to mesh(0xFFFFEDE6, 0xFFFFE0C9, 0xFFFFCDDB, 0xFFD9E0FF),
        "Meadow" to mesh(0xFFEBF6DA, 0xFFE8F7BE, 0xFFB2E9CD, 0xFFFFF2BF),
        "Glacier" to mesh(0xFFE7F0FF, 0xFFE0EEFF, 0xFFC3D5FF, 0xFFE2FAFF),
        "Citrus" to mesh(0xFFFFE6C4, 0xFFFFEF98, 0xFFFFB585, 0xFFFFD9BB),
        "Dusk" to mesh(0xFF3F3787, 0xFFFF9A8B, 0xFF7C6CF0, 0xFF2B377F),
        "Deep sea" to mesh(0xFF0E3C4E, 0xFF1C9E74, 0xFF0E5C70, 0xFF0A2C45),
        "Berry" to mesh(0xFF6E45B8, 0xFFF28DB0, 0xFFA479E8, 0xFF5A3BAF),
    )

    private fun mesh(base: Long, a: Long, b: Long, c: Long) =
        CardBackground.Mesh(Color(base), Color(a), Color(b), Color(c))
}

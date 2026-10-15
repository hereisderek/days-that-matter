package dev.derek.daysthatmatter.core.designsystem.icons

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.dp

/**
 * Icons of the event editor, from the `ICONS` table of design/v2/app.js, drawn like [DtmIcons]: 24 x 24 viewport,
 * stroke 1.8, round caps and joins.
 */
object EditorIcons {
    val Edit = icon("edit", "M4 20h4L19.3 8.7a2.1 2.1 0 00-3-3L5 17v3z M14.5 7.5l2 2")
    val Info = icon("info", "M3.5 12a8.5 8.5 0 1 0 17 0a8.5 8.5 0 1 0 -17 0z M12 11v5M12 8h.01")
    val Sparkle = icon("sparkle", "M12 4l1.8 5.2L19 11l-5.2 1.8L12 18l-1.8-5.2L5 11l5.2-1.8z")

    val All: List<ImageVector> by lazy { listOf(Edit, Info, Sparkle) }
}

private fun icon(name: String, pathData: String): ImageVector =
    ImageVector.Builder(
        name = name,
        defaultWidth = 20.dp,
        defaultHeight = 20.dp,
        viewportWidth = 24f,
        viewportHeight = 24f,
    ).addPath(
        pathData = PathParser().parsePathString(pathData).toNodes(),
        stroke = SolidColor(Color.Black),
        strokeLineWidth = 1.8f,
        strokeLineCap = StrokeCap.Round,
        strokeLineJoin = StrokeJoin.Round,
    ).build()

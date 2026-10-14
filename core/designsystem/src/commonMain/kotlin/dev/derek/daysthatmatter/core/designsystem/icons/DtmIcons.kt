package dev.derek.daysthatmatter.core.designsystem.icons

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.dp

/**
 * Line icons from the `ICONS` table of design/v2/app.js: 24 x 24 viewport, stroke 1.8, round caps and joins.
 * Circles and rounded rectangles of the SVG source are written as path commands.
 */
object DtmIcons {
    val Back = icon("back", "M15 18l-6-6 6-6")
    val Chevron = icon("chev", "M9 6l6 6-6 6")
    val Close = icon("close", "M6 6l12 12M18 6 6 18")
    val Check = icon("check", "M5 12.5l4.5 4.5L19 7.5")
    val Search = icon("search", circle(11f, 11f, 6.5f) + "M20 20l-4.2-4.2")
    val Plus = icon("plus", "M12 5v14M5 12h14")
    val Pin = icon("pin", "M9 3.5h6l-1 5 3 3v2H7v-2l3-3z M12 13.5V21")
    val User = icon("user", circle(12f, 8.5f, 3.5f) + "M5 20a7 7 0 0114 0")
    val Grid = icon(
        "grid",
        roundRect(4f, 4f, 7f, 7f, 2f) + roundRect(13f, 4f, 7f, 7f, 2f) +
            roundRect(4f, 13f, 7f, 7f, 2f) + roundRect(13f, 13f, 7f, 7f, 2f),
    )
    val List = icon("list", roundRect(4f, 5f, 16f, 5.5f, 2f) + roundRect(4f, 13.5f, 16f, 5.5f, 2f))
    val Sort = icon("sort", "M7 5v14M4 16l3 3 3-3M17 19V5M14 8l3-3 3 3")
    val Memo = icon("memo", "M5 4h14v11l-5 5H5z M14 20v-5h5M9 9h6M9 12.5h3")
    val Archive = icon("archive", roundRect(3.5f, 4f, 17f, 5f, 1.5f) + "M5 9v9a2 2 0 002 2h10a2 2 0 002-2V9M10 13h4")
    val People = icon("people", circle(9f, 8.5f, 3.2f) + "M3.5 19.5a5.5 5.5 0 0111 0 M15.5 5.5a3.2 3.2 0 010 6.2M17.5 19.5a5.5 5.5 0 00-2.2-4.4")

    /** All icons by name, for the design gallery. */
    val All: List<ImageVector> by lazy {
        listOf(Back, Chevron, Close, Check, Search, Plus, Pin, User, Grid, List, Sort, Memo, Archive, People)
    }
}

private fun circle(cx: Float, cy: Float, r: Float): String =
    "M${cx - r} ${cy}a$r $r 0 1 0 ${2 * r} 0a$r $r 0 1 0 ${-2 * r} 0z "

private fun roundRect(x: Float, y: Float, w: Float, h: Float, r: Float): String =
    "M${x + r} ${y}h${w - 2 * r}a$r $r 0 0 1 $r ${r}v${h - 2 * r}a$r $r 0 0 1 ${-r} ${r}h${-(w - 2 * r)}" +
        "a$r $r 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a$r $r 0 0 1 $r ${-r}z "

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

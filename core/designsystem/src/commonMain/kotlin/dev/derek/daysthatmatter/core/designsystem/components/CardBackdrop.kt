package dev.derek.daysthatmatter.core.designsystem.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.layout.ContentScale

/**
 * Background of a day card: the color layer, the black dim scrim and, for photos, the legibility gradient
 * (`.card-bg`, `.card-scrim`, `.card-legible` in design/v2/styles.css). The film grain of `.card-grain` is not drawn.
 */
@Composable
internal fun CardBackdrop(background: CardBackground, dim: Float, modifier: Modifier = Modifier) {
    Box(modifier.fillMaxSize()) {
        when (background) {
            is CardBackground.Solid -> Box(Modifier.fillMaxSize().background(background.color))
            is CardBackground.Mesh -> Box(Modifier.fillMaxSize().drawBehind { drawMesh(background) })
            is CardBackground.Image -> Image(
                painter = background.painter,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize().blur(background.blur),
            )
        }
        if (dim > 0f) Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = dim.coerceIn(0f, 1f))))
        if (background is CardBackground.Image) Box(Modifier.fillMaxSize().drawBehind { drawLegibility() })
    }
}

/** `.card-legible` for rows: a left-to-right veil; the vertical variant is used by hero cards. */
private fun DrawScope.drawLegibility() {
    drawRect(
        Brush.horizontalGradient(
            0f to Color.Black.copy(alpha = 0.34f),
            0.5f to Color.Black.copy(alpha = 0.08f),
            1f to Color.Black.copy(alpha = 0.30f),
        ),
    )
}

/** `mesh()` in design/v2/app.js: elliptical radial blobs a, b, c (top layer first in CSS) over the base color. */
private fun DrawScope.drawMesh(mesh: CardBackground.Mesh) {
    drawRect(mesh.base)
    blob(mesh.c, 0.70f, 1.04f, 1.10f, 0.90f, 0.66f)
    blob(mesh.b, 0.96f, 0.04f, 0.90f, 0.85f, 0.60f)
    blob(mesh.a, 0.08f, 0.06f, 1.20f, 0.90f, 0.62f)
}

/** One `radial-gradient(rx ry at cx cy, color 0, transparent stop)`; radii and center are fractions of the box. */
private fun DrawScope.blob(color: Color, cx: Float, cy: Float, rx: Float, ry: Float, stop: Float) {
    val center = Offset(cx * size.width, cy * size.height)
    val radiusX = rx * size.width
    val radiusY = ry * size.height
    val squash = radiusY / radiusX
    withTransform({ scale(1f, squash, pivot = center) }) {
        drawRect(
            brush = Brush.radialGradient(
                0f to color,
                stop to color.copy(alpha = 0f),
                center = center,
                radius = radiusX,
            ),
            topLeft = Offset(0f, center.y - center.y / squash),
            size = Size(size.width, size.height / squash),
        )
    }
}

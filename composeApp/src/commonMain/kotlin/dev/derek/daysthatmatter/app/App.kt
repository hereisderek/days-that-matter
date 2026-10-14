package dev.derek.daysthatmatter.app

import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import dev.derek.daysthatmatter.core.designsystem.gallery.DesignGallery
import dev.derek.daysthatmatter.core.designsystem.theme.DaysThatMatterTheme
import dev.derek.daysthatmatter.core.designsystem.theme.DtmTheme

/**
 * Root of the app UI on every platform. Until the real screens exist it shows the design gallery of
 * :core:designsystem inside the theme; the gallery draws its own light and dark panels.
 */
@Composable
fun App(modifier: Modifier = Modifier) {
    DaysThatMatterTheme {
        Surface(modifier = modifier, color = DtmTheme.colors.bg) {
            DesignGallery(Modifier.safeDrawingPadding())
        }
    }
}

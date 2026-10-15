package dev.derek.daysthatmatter.core.designsystem.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf

internal val LocalDtmColors = staticCompositionLocalOf { lightDtmColors() }
internal val LocalDtmTypography = staticCompositionLocalOf { dtmTypographyFallback() }
internal val LocalDtmRadii = staticCompositionLocalOf { DtmRadii() }
internal val LocalDtmSpacing = staticCompositionLocalOf { DtmSpacing() }
internal val LocalDtmElevation = staticCompositionLocalOf { DtmElevation() }
val LocalReducedMotion = staticCompositionLocalOf { false }

/** Read access to the design tokens of the nearest [DaysThatMatterTheme]. */
object DtmTheme {
    val colors: DtmColors @Composable @ReadOnlyComposable get() = LocalDtmColors.current
    val typography: DtmTypography @Composable @ReadOnlyComposable get() = LocalDtmTypography.current
    val radii: DtmRadii @Composable @ReadOnlyComposable get() = LocalDtmRadii.current
    val spacing: DtmSpacing @Composable @ReadOnlyComposable get() = LocalDtmSpacing.current
    val elevation: DtmElevation @Composable @ReadOnlyComposable get() = LocalDtmElevation.current
    val reducedMotion: Boolean @Composable @ReadOnlyComposable get() = LocalReducedMotion.current
}

/**
 * Theme of the app: v2 tokens through [DtmTheme] and a matching Material 3 theme.
 *
 * @param darkTheme defaults to the system setting.
 * @param accent the app accent (Settings > Accent).
 * @param dynamicColorScheme a wallpaper-based scheme from the platform (Android 12+). Null by default on purpose:
 * the brand palette must show. When set, only the Material 3 [ColorScheme] changes; [DtmTheme.colors] keeps the
 * brand palette, so cards and the components of this module look the same either way.
 * @param reducedMotion when true, turns off animations and transitions (accessibility prefers-reduced-motion).
 */
@Composable
fun DaysThatMatterTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    accent: AccentChoice = AccentChoice.Jade,
    dynamicColorScheme: ColorScheme? = null,
    reducedMotion: Boolean = false,
    content: @Composable () -> Unit,
) {
    val colors = remember(darkTheme, accent) { if (darkTheme) darkDtmColors(accent) else lightDtmColors(accent) }
    val typography = rememberDtmTypography()
    val radii = remember { DtmRadii() }
    val materialTypography = remember(typography) { typography.toMaterialTypography() }
    val materialColors = dynamicColorScheme ?: remember(colors) { colors.toMaterialColorScheme() }
    CompositionLocalProvider(
        LocalDtmColors provides colors,
        LocalDtmTypography provides typography,
        LocalDtmRadii provides radii,
        LocalDtmSpacing provides DtmSpacing(),
        LocalDtmElevation provides DtmElevation(),
        LocalReducedMotion provides reducedMotion,
    ) {
        MaterialTheme(
            colorScheme = materialColors,
            typography = materialTypography,
            shapes = remember(radii) { radii.toMaterialShapes() },
            content = content,
        )
    }
}

package dev.derek.daysthatmatter.core.designsystem.theme

import androidx.compose.material3.ColorScheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color

/**
 * App accent choices (design/v2/styles.css `:root[data-accent=...]`, Settings > Accent). Each has a light and a
 * dark value; [Jade] is the default.
 */
enum class AccentChoice(val light: Color, val dark: Color) {
    Jade(Color(0xFF0E8F63), Color(0xFF52D6A3)),
    Sky(Color(0xFF2A6FD6), Color(0xFF8BBBFF)),
    Coral(Color(0xFFC9472C), Color(0xFFFF9C82)),
    Plum(Color(0xFF7547C2), Color(0xFFC2A8FF)),
    Ink(Color(0xFF1B2420), Color(0xFFE6ECE8)),
}

/**
 * Chrome colors of the app shell (design/v2/styles.css `:root` variables). Day cards bring their own background and
 * pick their text color from it ([CardTone]); these colors are for everything around the cards.
 */
@Immutable
data class DtmColors(
    val isDark: Boolean,
    /** `--page`: the area outside the phone in the prototype; used for the gallery canvas. */
    val page: Color,
    /** `--bg`: screen background. */
    val bg: Color,
    /** `--surface`: cards, sheets, inputs. */
    val surface: Color,
    val surface2: Color,
    val surface3: Color,
    /** `--ink`, `--ink-2`, `--ink-3`: primary, secondary and tertiary text. */
    val ink: Color,
    val ink2: Color,
    val ink3: Color,
    /** `--line`, `--line-2`: hairline and stronger borders (translucent ink). */
    val line: Color,
    val line2: Color,
    val accent: Color,
    val onAccent: Color,
    /** `--accent-soft`: 13% accent mixed into the surface (sRGB). */
    val accentSoft: Color,
    val danger: Color,
    val goldBg: Color,
    val goldInk: Color,
    /** Status colors from design/DESIGN_SYSTEM.md section 2.1; v2 defines none, they are the same in both themes. */
    val rose: Color,
    val emerald: Color,
    val amber: Color,
    val violet: Color,
    /** Tint of the platform shadow used for [DtmElevation]. */
    val shadowTint: Color,
)

/** Mixes [other] into this color by [fraction] in sRGB, like CSS `color-mix(in srgb, ...)`. */
fun Color.mixSrgb(other: Color, fraction: Float): Color = Color(
    red = red + (other.red - red) * fraction,
    green = green + (other.green - green) * fraction,
    blue = blue + (other.blue - blue) * fraction,
    alpha = alpha + (other.alpha - alpha) * fraction,
)

private const val ACCENT_SOFT_FRACTION = 0.13f

private val Rose = Color(0xFFF43F5E)
private val Emerald = Color(0xFF10B981)
private val Amber = Color(0xFFF59E0B)
private val Violet = Color(0xFF8B5CF6)
private val Danger = Color(0xFFD2433A)

fun lightDtmColors(accent: AccentChoice = AccentChoice.Jade): DtmColors {
    val surface = Color(0xFFFFFFFF)
    return DtmColors(
        isDark = false,
        page = Color(0xFFEDF2EE),
        bg = Color(0xFFF5F7F3),
        surface = surface,
        surface2 = Color(0xFFEEF2ED),
        surface3 = Color(0xFFDCE3DD),
        ink = Color(0xFF111714),
        ink2 = Color(0xFF4A544F),
        ink3 = Color(0xFF7F8984),
        line = Color(0xFF111714).copy(alpha = 0.07f),
        line2 = Color(0xFF111714).copy(alpha = 0.13f),
        accent = accent.light,
        onAccent = Color(0xFFFFFFFF),
        accentSoft = surface.mixSrgb(accent.light, ACCENT_SOFT_FRACTION),
        danger = Danger,
        goldBg = Color(0xFFFFF1CF),
        goldInk = Color(0xFF8A5A00),
        rose = Rose,
        emerald = Emerald,
        amber = Amber,
        violet = Violet,
        shadowTint = Color(0xFF111E18),
    )
}

fun darkDtmColors(accent: AccentChoice = AccentChoice.Jade): DtmColors {
    val surface = Color(0xFF171C1A)
    return DtmColors(
        isDark = true,
        page = Color(0xFF0A0D0C),
        bg = Color(0xFF0F1312),
        surface = surface,
        surface2 = Color(0xFF1F2623),
        surface3 = Color(0xFF2C3531),
        ink = Color(0xFFECF1EE),
        ink2 = Color(0xFFA9B3AE),
        ink3 = Color(0xFF737D78),
        line = Color(0xFFECF1EE).copy(alpha = 0.07f),
        line2 = Color(0xFFECF1EE).copy(alpha = 0.14f),
        accent = accent.dark,
        onAccent = Color(0xFF06120D),
        accentSoft = surface.mixSrgb(accent.dark, ACCENT_SOFT_FRACTION),
        danger = Danger,
        goldBg = Color(0xFFF2C46D).copy(alpha = 0.16f),
        goldInk = Color(0xFFF2C46D),
        rose = Rose,
        emerald = Emerald,
        amber = Amber,
        violet = Violet,
        shadowTint = Color(0xFF000000),
    )
}

/** Maps the chrome colors onto a Material 3 [ColorScheme] so stock Material components pick up the brand palette. */
fun DtmColors.toMaterialColorScheme(): ColorScheme = if (isDark) {
    darkColorScheme(
        primary = accent,
        onPrimary = onAccent,
        primaryContainer = accentSoft,
        onPrimaryContainer = accent,
        secondary = ink2,
        onSecondary = bg,
        secondaryContainer = surface2,
        onSecondaryContainer = ink,
        tertiary = violet,
        background = bg,
        onBackground = ink,
        surface = surface,
        onSurface = ink,
        surfaceVariant = surface2,
        onSurfaceVariant = ink2,
        surfaceTint = accent,
        outline = line2,
        outlineVariant = line,
        error = danger,
        surfaceContainerLowest = bg,
        surfaceContainerLow = surface,
        surfaceContainer = surface,
        surfaceContainerHigh = surface2,
        surfaceContainerHighest = surface3,
    )
} else {
    lightColorScheme(
        primary = accent,
        onPrimary = onAccent,
        primaryContainer = accentSoft,
        onPrimaryContainer = accent,
        secondary = ink2,
        onSecondary = surface,
        secondaryContainer = surface2,
        onSecondaryContainer = ink,
        tertiary = violet,
        background = bg,
        onBackground = ink,
        surface = surface,
        onSurface = ink,
        surfaceVariant = surface2,
        onSurfaceVariant = ink2,
        surfaceTint = accent,
        outline = line2,
        outlineVariant = line,
        error = danger,
        surfaceContainerLowest = surface,
        surfaceContainerLow = surface,
        surfaceContainer = surface,
        surfaceContainerHigh = surface2,
        surfaceContainerHighest = surface3,
    )
}

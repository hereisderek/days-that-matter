package dev.derek.daysthatmatter.core.designsystem.theme

import androidx.compose.material3.Typography
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.remember
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineBreak
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import dev.derek.daysthatmatter.core.designsystem.resources.Res
import dev.derek.daysthatmatter.core.designsystem.resources.geist_bold
import dev.derek.daysthatmatter.core.designsystem.resources.geist_medium
import dev.derek.daysthatmatter.core.designsystem.resources.geist_mono_medium
import dev.derek.daysthatmatter.core.designsystem.resources.geist_mono_regular
import dev.derek.daysthatmatter.core.designsystem.resources.geist_regular
import dev.derek.daysthatmatter.core.designsystem.resources.geist_semibold
import org.jetbrains.compose.resources.Font

/**
 * Text styles of the app shell (design/v2/styles.css). Sizes are sp. v2 sets weights 550 and 650 with a variable
 * font; the bundled static Geist cuts map 550 to Medium (500) and 650 to SemiBold (600).
 *
 * Card text (title, date line, number, unit) uses the `card*` and `number*` styles; the number styles take the
 * card typeface from [CardTypeface].
 */
@Immutable
data class DtmTypography(
    val sans: FontFamily,
    val mono: FontFamily,
    /** `body`: 15 / 1.45. */
    val body: TextStyle,
    /** `.kicker`: 13, ink-3. */
    val kicker: TextStyle,
    /** `.h1`, `.page-title`: 32, tracking -0.04em, line height 1.05. */
    val screenTitle: TextStyle,
    /** `.sec-head h2`: 14 semibold. */
    val sectionTitle: TextStyle,
    /** `.sheet-h`, `.empty b`: 17. */
    val heading: TextStyle,
    /** `.chip`: 14 medium. */
    val chip: TextStyle,
    /** `.btn`: 16 semibold. */
    val button: TextStyle,
    /** `.btn-row .btn`, `.btn.sm`: 15 / 14 semibold. */
    val buttonSmall: TextStyle,
    /** `.glass-pill`: 12.5 semibold. */
    val pill: TextStyle,
    /** `.memo-badge`: 10.5 bold. */
    val memoBadge: TextStyle,
    /** `.tick`: mono 11.5 to 13. */
    val tick: TextStyle,
    /** `.card .pre`: 11 caps with tracking 0.06em. */
    val pre: TextStyle,
    /** Base of the card number: weight 650, tracking -0.045em, line height 0.92, tabular figures. Size is set per context. */
    val number: TextStyle,
    /** Base of the card title: weight 600, tracking -0.01em. Size is set per context. */
    val cardTitle: TextStyle,
    /** Base of the card date line and unit label. Size is set per context. */
    val cardMeta: TextStyle,
    val cardUnit: TextStyle,
)

private const val TABULAR = "tnum"

fun dtmTypography(sans: FontFamily, mono: FontFamily): DtmTypography {
    fun style(
        size: Float,
        weight: FontWeight = FontWeight.Normal,
        tracking: TextUnit = 0.em,
        lineHeight: TextUnit = TextUnit.Unspecified,
        family: FontFamily = sans,
    ) = TextStyle(
        fontFamily = family,
        fontSize = size.sp,
        fontWeight = weight,
        letterSpacing = tracking,
        lineHeight = lineHeight,
        lineBreak = LineBreak.Simple,
    )
    return DtmTypography(
        sans = sans,
        mono = mono,
        body = style(15f, lineHeight = 21.75.sp),
        kicker = style(13f, FontWeight.Medium),
        screenTitle = style(32f, FontWeight.SemiBold, (-0.04).em, 33.6.sp),
        sectionTitle = style(14f, FontWeight.SemiBold, (-0.01).em),
        heading = style(17f, FontWeight.SemiBold),
        chip = style(14f, FontWeight.Medium),
        button = style(16f, FontWeight.SemiBold),
        buttonSmall = style(14f, FontWeight.SemiBold),
        pill = style(12.5f, FontWeight.SemiBold),
        memoBadge = style(10.5f, FontWeight.Bold, lineHeight = 10.5.sp),
        tick = style(11.5f, FontWeight.Medium, family = mono).copy(fontFeatureSettings = TABULAR),
        pre = style(11f, FontWeight.SemiBold, 0.06.em),
        number = style(30f, FontWeight.SemiBold, (-0.045).em).copy(fontFeatureSettings = TABULAR),
        cardTitle = style(16f, FontWeight.SemiBold, (-0.01).em),
        cardMeta = style(13f),
        cardUnit = style(11.5f, FontWeight.Medium),
    )
}

/** Fallback used in tests and previews that do not load the bundled font. */
fun dtmTypographyFallback(): DtmTypography = dtmTypography(FontFamily.SansSerif, FontFamily.Monospace)

/** Loads the bundled Geist and Geist Mono (SIL OFL 1.1, see FONT-LICENSE-Geist.txt) as multiplatform resources. */
@Composable
fun rememberDtmTypography(): DtmTypography {
    val regular = Font(Res.font.geist_regular, FontWeight.Normal)
    val medium = Font(Res.font.geist_medium, FontWeight.Medium)
    val semiBold = Font(Res.font.geist_semibold, FontWeight.SemiBold)
    val bold = Font(Res.font.geist_bold, FontWeight.Bold)
    val monoRegular = Font(Res.font.geist_mono_regular, FontWeight.Normal)
    val monoMedium = Font(Res.font.geist_mono_medium, FontWeight.Medium)
    return remember(regular, medium, semiBold, bold, monoRegular, monoMedium) {
        dtmTypography(
            sans = FontFamily(regular, medium, semiBold, bold),
            mono = FontFamily(monoRegular, monoMedium),
        )
    }
}

/** Maps the v2 text styles onto Material 3 roles so stock components look right. */
fun DtmTypography.toMaterialTypography(): Typography = Typography(
    displayLarge = number.copy(fontSize = 112.sp),
    displayMedium = number.copy(fontSize = 76.sp),
    displaySmall = number.copy(fontSize = 46.sp),
    headlineLarge = screenTitle,
    headlineMedium = cardTitle.copy(fontSize = 21.sp),
    headlineSmall = cardTitle.copy(fontSize = 19.sp),
    titleLarge = heading,
    titleMedium = button,
    titleSmall = sectionTitle,
    bodyLarge = body,
    bodyMedium = body.copy(fontSize = 14.sp, lineHeight = 20.sp),
    bodySmall = cardMeta,
    labelLarge = chip,
    labelMedium = pill,
    labelSmall = pre,
)

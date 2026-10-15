package dev.derek.daysthatmatter.core.designsystem.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Shapes
import androidx.compose.runtime.Immutable
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** Corner radii (design/v2/styles.css `--r-*` and the per-context radii of `.card`). */
@Immutable
data class DtmRadii(
    /** `--r-sm` 12. */
    val sm: Dp = 12.dp,
    /** `--r-md` 16: inputs, search field, mini card. */
    val md: Dp = 16.dp,
    /** `--r-lg` 22: Medium list row, tile. */
    val lg: Dp = 22.dp,
    /** `--r-xl` 30: hero card. */
    val xl: Dp = 30.dp,
    /** `.ctx-row.size-sm` 18. */
    val rowSmall: Dp = 18.dp,
    /** `.ctx-row.size-lg` 26. */
    val rowLarge: Dp = 26.dp,
    /** Bottom sheet 36, detail panel top 28. */
    val sheet: Dp = 36.dp,
    /** `999px`: chips, buttons, FAB. */
    val pill: Dp = 999.dp,
)

/** Spacing steps used by the v2 layout (px in the prototype are dp here). */
@Immutable
data class DtmSpacing(
    val hairline: Dp = 2.dp,
    val xs: Dp = 4.dp,
    val sm: Dp = 8.dp,
    /** List and grid gap. */
    val gap: Dp = 10.dp,
    val md: Dp = 12.dp,
    /** Card padding in tiles. */
    val card: Dp = 14.dp,
    /** Screen side gutter. */
    val screen: Dp = 16.dp,
    val lg: Dp = 18.dp,
    /** Header and section side padding. */
    val xl: Dp = 20.dp,
    val xxl: Dp = 24.dp,
    val xxxl: Dp = 32.dp,
)

/**
 * Platform shadow elevations standing in for `--shadow-1` and `--shadow-2`. Compose shadows cannot set a spread or
 * an offset, so these are approximations; the tint comes from [DtmColors.shadowTint].
 */
@Immutable
data class DtmElevation(
    /** `--shadow-1`: icon buttons, search field, grouped surfaces. */
    val raised: Dp = 3.dp,
    /** `--shadow-2`: FAB, sheets, toasts. */
    val floating: Dp = 14.dp,
)

/** Fixed component sizes read from design/v2/styles.css. */
object DtmSizes {
    val rowSmall = 64.dp
    val rowMedium = 84.dp
    val rowLarge = 132.dp
    val tileLargeHeight = 196.dp
    val iconButton = 40.dp
    val touchTarget = 48.dp
    val chip = 34.dp
    val search = 46.dp
    val button = 54.dp
    val buttonSmall = 36.dp
    val fab = 54.dp
}

internal fun DtmRadii.toMaterialShapes(): Shapes = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = RoundedCornerShape(sm),
    medium = RoundedCornerShape(md),
    large = RoundedCornerShape(lg),
    extraLarge = RoundedCornerShape(xl),
)

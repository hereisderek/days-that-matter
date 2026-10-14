package dev.derek.daysthatmatter.core.designsystem.gallery

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.derek.daysthatmatter.core.designsystem.components.BottomFade
import dev.derek.daysthatmatter.core.designsystem.components.CardSize
import dev.derek.daysthatmatter.core.designsystem.components.CardStyle
import dev.derek.daysthatmatter.core.designsystem.components.CardTypeface
import dev.derek.daysthatmatter.core.designsystem.components.CategoryChip
import dev.derek.daysthatmatter.core.designsystem.components.CardBackground
import dev.derek.daysthatmatter.core.designsystem.components.DayCardGrid
import dev.derek.daysthatmatter.core.designsystem.components.DayCardRow
import dev.derek.daysthatmatter.core.designsystem.components.DayCardState
import dev.derek.daysthatmatter.core.designsystem.components.DtmButton
import dev.derek.daysthatmatter.core.designsystem.components.DtmButtonSize
import dev.derek.daysthatmatter.core.designsystem.components.DtmButtonStyle
import dev.derek.daysthatmatter.core.designsystem.components.DtmTopBar
import dev.derek.daysthatmatter.core.designsystem.components.EmptyState
import dev.derek.daysthatmatter.core.designsystem.components.IconCircleButton
import dev.derek.daysthatmatter.core.designsystem.components.MemoBadgePosition
import dev.derek.daysthatmatter.core.designsystem.components.NewDayFab
import dev.derek.daysthatmatter.core.designsystem.components.SearchField
import dev.derek.daysthatmatter.core.designsystem.components.SectionHeader
import dev.derek.daysthatmatter.core.designsystem.icons.DtmIcons
import dev.derek.daysthatmatter.core.designsystem.theme.AccentChoice
import dev.derek.daysthatmatter.core.designsystem.theme.CardPalette
import dev.derek.daysthatmatter.core.designsystem.theme.DaysThatMatterTheme
import dev.derek.daysthatmatter.core.designsystem.theme.DtmColors
import dev.derek.daysthatmatter.core.designsystem.theme.DtmTheme

/** Which theme(s) the gallery shows. */
enum class GalleryMode(val label: String) { Light("Light"), Dark("Dark"), Both("Both") }

/**
 * Debug design gallery: every token and base component, in light and dark, to compare with design/v2 side by side.
 * Not for production screens. The app shows it from `App` until the real screens exist.
 */
@Composable
fun DesignGallery(modifier: Modifier = Modifier, initialMode: GalleryMode = GalleryMode.Light) {
    var mode by rememberSaveable { mutableStateOf(initialMode) }
    val themes = when (mode) {
        GalleryMode.Light -> listOf(false)
        GalleryMode.Dark -> listOf(true)
        GalleryMode.Both -> listOf(false, true)
    }
    Column(modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        themes.forEach { dark ->
            DaysThatMatterTheme(darkTheme = dark) {
                GalleryPanel(
                    dark = dark,
                    modeSwitch = if (dark == themes.first()) {
                        {
                            Row(horizontalArrangement = Arrangement.spacedBy(0.dp)) {
                                GalleryMode.entries.forEach { m ->
                                    CategoryChip(m.label, selected = m == mode, onClick = { mode = m })
                                }
                            }
                        }
                    } else {
                        null
                    },
                )
            }
        }
    }
}

@Composable
private fun GalleryPanel(dark: Boolean, modeSwitch: (@Composable () -> Unit)?) {
    val colors = DtmTheme.colors
    Column(Modifier.fillMaxWidth().background(colors.bg).padding(bottom = 24.dp)) {
        DtmTopBar(
            title = if (dark) "Design gallery · Dark" else "Design gallery · Light",
            kicker = "Days That Matter · design v2",
            actions = {
                IconCircleButton(DtmIcons.Search, "Search", onClick = {})
                IconCircleButton(DtmIcons.User, "Account", onClick = {})
            },
        )
        if (modeSwitch != null) Box(Modifier.padding(horizontal = 16.dp)) { modeSwitch() }

        GalleryTitle("Colors")
        Swatches(
            listOf(
                "page" to colors.page, "bg" to colors.bg, "surface" to colors.surface, "surface-2" to colors.surface2,
                "surface-3" to colors.surface3, "ink" to colors.ink, "ink-2" to colors.ink2, "ink-3" to colors.ink3,
                "accent" to colors.accent, "on-accent" to colors.onAccent, "accent-soft" to colors.accentSoft,
                "danger" to colors.danger, "gold-bg" to colors.goldBg, "gold-ink" to colors.goldInk,
                "line" to colors.line, "line-2" to colors.line2,
                "rose" to colors.rose, "emerald" to colors.emerald, "amber" to colors.amber, "violet" to colors.violet,
            ),
        )
        GalleryTitle("App accents")
        Swatches(AccentChoice.entries.map { it.name to if (dark) it.dark else it.light })
        GalleryTitle("Card colors")
        Swatches(CardPalette.swatches.map { it.name to it.color })
        GalleryTitle("Card gradients")
        FlowRow(
            Modifier.padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            CardPalette.gradients.forEach { (name, mesh) ->
                Box(Modifier.size(width = 76.dp, height = 56.dp)) {
                    DayCardRow(
                        sample("", name, "", size = CardSize.Small).copy(background = mesh),
                        Modifier.fillMaxSize(),
                    )
                }
            }
        }

        GalleryTitle("Type")
        TypeSamples()
        GalleryTitle("Radii, spacing, elevation")
        Dimens()

        GalleryTitle("Controls")
        Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            SearchField(value = "", onValueChange = {}, placeholder = "Search your days", onClose = {})
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                CategoryChip("All", selected = true, onClick = {})
                CategoryChip("Upcoming", selected = false, onClick = {})
                CategoryChip("Birthdays", selected = false, onClick = {})
            }
            DtmButton("Save day", onClick = {}, style = DtmButtonStyle.Primary)
            DtmButton("Save day", onClick = {}, style = DtmButtonStyle.Accent)
            DtmButton("Share", onClick = {}, style = DtmButtonStyle.Secondary)
            DtmButton("Not now", onClick = {}, style = DtmButtonStyle.Text)
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                DtmButton("Cancel", onClick = {}, style = DtmButtonStyle.Secondary, size = DtmButtonSize.Compact, modifier = Modifier.weight(1f))
                DtmButton("Done", onClick = {}, size = DtmButtonSize.Compact, modifier = Modifier.weight(1f))
            }
            DtmButton("Manage people", onClick = {}, style = DtmButtonStyle.Secondary, size = DtmButtonSize.Small)
            DtmButton("Disabled", onClick = {}, enabled = false)
        }

        SectionHeader("Upcoming", count = 3, actions = {
            IconCircleButton(DtmIcons.Grid, "Show as grid", onClick = {})
            IconCircleButton(DtmIcons.Sort, "Sort", onClick = {})
        })
        Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            samples.forEach { DayCardRow(it) }
        }
        SectionHeader("Styles and typefaces")
        Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            styleSamples.forEach { DayCardRow(it) }
        }
        SectionHeader("Memo badge, top left")
        Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            DayCardRow(samples[1].copy(memoBadge = MemoBadgePosition.TopLeft))
            DayCardRow(samples[0].copy(memoBadge = MemoBadgePosition.TopLeft, size = CardSize.Small, memoCount = 12))
        }
        SectionHeader("Grid")
        DayCardGrid(gridSamples, Modifier.padding(horizontal = 16.dp))

        EmptyState("🌤️", "Nothing here yet", "Add a day and give it a photo or a color.")
        Box(Modifier.fillMaxWidth().height(150.dp)) {
            BottomFade(Modifier.align(Alignment.BottomCenter))
            NewDayFab("New day", onClick = {}, modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 30.dp))
        }
    }
}

@Composable
private fun GalleryTitle(text: String) {
    Text(
        text = text.uppercase(),
        style = DtmTheme.typography.pre,
        color = DtmTheme.colors.ink3,
        modifier = Modifier.padding(start = 20.dp, top = 22.dp, bottom = 8.dp),
    )
}

@Composable
private fun Swatches(items: List<Pair<String, Color>>) {
    val colors = DtmTheme.colors
    FlowRow(
        Modifier.padding(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items.forEach { (name, color) ->
            Column(Modifier.size(width = 64.dp, height = 62.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Box(
                    Modifier
                        .size(36.dp)
                        .background(colors.surface, CircleShape)
                        .background(color, CircleShape)
                        .border(1.dp, colors.line2, CircleShape),
                )
                Text(text = name, style = DtmTheme.typography.cardMeta.copy(fontSize = 10.sp), color = colors.ink2, maxLines = 1)
            }
        }
    }
}

@Composable
private fun TypeSamples() {
    val colors = DtmTheme.colors
    val type = DtmTheme.typography
    Column(Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text("Your days", style = type.screenTitle, color = colors.ink)
        Text("Upcoming 3", style = type.sectionTitle, color = colors.ink2)
        Text("Saturday, 14 October", style = type.kicker, color = colors.ink3)
        Text("Body text, 15 sp with a 1.45 line height.", style = type.body, color = colors.ink)
        Text("1,248", style = type.number.copy(fontSize = 46.sp), color = colors.ink)
        Text("37d 04h 12m 08s", style = type.tick, color = colors.ink2)
    }
}

@Composable
private fun Dimens() {
    val colors = DtmTheme.colors
    val radii = DtmTheme.radii
    Row(Modifier.padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        listOf(radii.sm, radii.md, radii.lg, radii.xl).forEach { r: Dp ->
            Box(
                Modifier.size(56.dp).background(colors.surface2, RoundedCornerShape(r)).border(1.dp, colors.line2, RoundedCornerShape(r)),
                contentAlignment = Alignment.Center,
            ) {
                Text("${r.value.toInt()}", style = DtmTheme.typography.cardMeta, color = colors.ink2)
            }
        }
        Box(
            Modifier.size(56.dp).background(colors.ink, RoundedCornerShape(radii.pill)),
            contentAlignment = Alignment.Center,
        ) { Icon(DtmIcons.Check, contentDescription = null, tint = colors.bg, modifier = Modifier.size(20.dp)) }
    }
}

private val samples: List<DayCardState>
    get() = listOf(
        sample("🏔️", "Norway trip", "38", size = CardSize.Medium, unit = "days to go", meta = "Sat, 21 Nov · 9:30", mesh = 5, memos = 3),
        sample("🎂", "Mia's birthday", "92", size = CardSize.Medium, unit = "days to go", meta = "Mon, 15 Jan · yearly", color = 2),
        sample("💸", "Payday", "6", size = CardSize.Small, unit = "days to go", color = 3, style = CardStyle.Clean),
        sample(
            "💞", "Together", "1,973", size = CardSize.Large, unit = "days together", meta = "Since 20 May 2021",
            tick = "1,973d 04h 12m 08s", mesh = 0,
        ),
    )

private val styleSamples: List<DayCardState>
    get() = listOf(
        sample("🚀", "App launch", "35", unit = "workdays to go", meta = "Wed, 2 Dec", color = 9, style = CardStyle.Outline, typeface = CardTypeface.Mono),
        sample("🏃", "Spring marathon", "158", unit = "days to go", meta = "Sun, 21 Mar", mesh = 4, style = CardStyle.Poster),
        sample("🐶", "Mochi came home", "951", unit = "days since", meta = "Since 9 Mar 2024", color = 4, typeface = CardTypeface.Serif),
        sample("🌙", "Night shift", "12", unit = "days to go", meta = "Fri, 27 Oct", mesh = 6, dim = 0.2f),
    )

private val gridSamples: List<DayCardState>
    get() = listOf(
        sample("🏔️", "Norway trip", "38", unit = "days to go", meta = "Sat, 21 Nov", mesh = 5),
        sample("🎂", "Mia's birthday", "92", unit = "days to go", meta = "Mon, 15 Jan", color = 2),
        sample("💞", "Together", "1,973", unit = "days together", meta = "Since 20 May 2021", mesh = 0, size = CardSize.Large),
        sample("💸", "Payday", "6", unit = "days to go", meta = "Monthly", color = 3, size = CardSize.Small),
        sample("🚗", "Driving test", "120", unit = "days since", meta = "Since 14 Jun", color = 1, size = CardSize.Small),
    )

private fun sample(
    emoji: String,
    title: String,
    number: String,
    size: CardSize = CardSize.Medium,
    unit: String = "days to go",
    meta: String = "",
    tick: String? = null,
    color: Int? = null,
    mesh: Int? = null,
    style: CardStyle = CardStyle.Glass,
    typeface: CardTypeface = CardTypeface.Sans,
    dim: Float = 0f,
    memos: Int = 0,
): DayCardState = DayCardState(
    title = title,
    emoji = emoji,
    number = number,
    unit = unit,
    meta = meta,
    tick = tick,
    background = when {
        mesh != null -> CardPalette.gradients[mesh].second
        color != null -> CardBackground.Solid(CardPalette.swatches[color].color)
        else -> CardBackground.Solid(CardPalette.Mint.color)
    },
    style = style,
    typeface = typeface,
    size = size,
    dim = dim,
    memoCount = memos,
)

# Feature Specification: Customization & Visual Theming

## 1. Overview & Goals
Empowers users to transform simple dates into personalized visual art. Offers customizable card styles, background imagery, gradients, curated typography, and automatic contrast calculation to ensure readability.

---

## 2. Customization Options

### 2.1 Backgrounds
1. **Curated Color Presets:** Carefully selected minimal, pastel, and vibrant palettes.
2. **Gradients:** Multi-stop linear and radial gradients with adjustable angle.
3. **Photo & Animated Backdrops:** A still photo (free), or an animated photo from an iPhone Live Photo or a Google Motion Photo (needs Premium on the plan of the person saving it; free users can preview it and are offered "Use still photo" on save; viewers always see it animated). Picked from the platform photo pickers and converted on the device (stills JPEG or WebP, at most 1.5 MB and 2560 px; motion H.264 MP4, at most 4 MB, 5 s, 1280 px, silent). The animation plays once when the event opens and on touch, then rests on the key photo; reduced motion shows the key photo only. Photo backdrops in use are limited per plan (free 5, Premium 300; animated: Premium 30), see [`premium/SPEC.md`](../premium/SPEC.md). Location and camera metadata are removed. Requirements: the [`event-backdrops`](../../../openspec/changes/pluggable-backend-live-sharing/specs/event-backdrops/spec.md) spec.
4. **Curated Wallpapers:** Bundled high-resolution nature, abstract, and festive wallpapers.
5. **Dark Mode Adaptation:** Automatic darkening / scrim overlay applied in dark mode.
6. **Dim and Blur:** every backdrop has a dim level (0 to 0.8, shared as `backdrop.dim`). Photo and art backdrops also have a blur radius from 0 to 16, default 0, shared as `backdrop.blur`. The radius is in points at a 390 pt card width and scales with the card, so a 195 pt card uses half. The app and the public web page render it; the server never blurs. Compose: `Modifier.blur` needs Android 12; below that, draw a pre-blurred, downscaled bitmap. Requirements: the [`event-backdrops`](../../../openspec/changes/pluggable-backend-live-sharing/specs/event-backdrops/spec.md) spec ("Backdrop blur").

### 2.2 Typography Presets
- **Modern Sans:** Crisp, geometric readability (Geist, bundled; v2 uses it for the app and the Modern card typeface).
- **Classic Serif:** Elegant, romantic milestones (Playfair / Merriweather).
- **Playful Rounded:** Birthdays, fun events (Nunito / Quicksand).
- **Monospace Tech:** Deadlines, count-ups, productivity (JetBrains Mono).
- **Editorial Condensed:** High-impact posters (Oswald / Anton).

### 2.3 Card Styles
- **Glassmorphic:** Frosted glass effect with blur, subtle white border, and soft drop shadow.
- **Minimalist Clean:** Pure flat surface with subtle border, maximizing clean typography.
- **Card Outlined:** High-contrast outline card, great for light or dark wallpapers.
- **Full-Bleed Poster:** Background stretches edge-to-edge with overlaid floating typography.

### 2.4 Card Sizes
Each day has a card size, part of its shared look (`theme.size`), set by the owner or an editor. Requirements: the [`home-screen`](../../../openspec/changes/design-v2-features/specs/home-screen/spec.md) spec of the change `design-v2-features`.

| Size | Home list row | Shows |
| :--- | :--- | :--- |
| Small | 64 pt | Emoji, title, number |
| Medium (default) | 84 pt | Adds the date line and unit |
| Large | 132 pt | A 44 pt number, the date and repeat line, a live ticker; spans two columns in the grid |

The pinned carousel, the day page, widgets, share images and the web page ignore size.

---

## 3. Data Models

```kotlin
package dev.derek.daysthatmatter.features.customization.domain.model

import kotlinx.serialization.Serializable

@Serializable
data class EventCustomization(
    val id: String,
    val background: BackgroundConfig = BackgroundConfig.SolidColor("#2563EB"),
    val cardStyle: CardStyle = CardStyle.Glassmorphic,
    val typography: TypographyStyle = TypographyStyle.ModernSans,
    val textColorOverride: String? = null,
    val dimBackgroundFactor: Float = 0.2f, // 0.0 to 0.8 scrim overlay; shared as backdrop.dim
    val blurRadius: Float = 0f,            // 0 to 16, pt at a 390 pt card width; photo and art backdrops; shared as backdrop.blur
    val size: CardSize = CardSize.Medium   // Home list size; shared as theme.size
)

@Serializable
enum class CardSize { Small, Medium, Large }

@Serializable
sealed interface BackgroundConfig {
    @Serializable data class SolidColor(val hexColor: String) : BackgroundConfig
    @Serializable data class LinearGradient(val colors: List<String>, val angleDegrees: Float) : BackgroundConfig
    @Serializable data class ImagePreset(val presetId: String) : BackgroundConfig
    @Serializable data class Photo(
        val kind: BackdropKind,                 // Still or Animated
        val stillLocalPath: String?,            // device cache; for Animated this is the key photo
        val stillId: String? = null,            // set after upload
        val motionLocalPath: String? = null,    // Animated only: H.264 MP4
        val motionId: String? = null
    ) : BackgroundConfig
}

@Serializable
enum class BackdropKind { Still, Animated }

@Serializable
enum class CardStyle {
    Glassmorphic,
    MinimalistClean,
    CardOutlined,
    FullBleedPoster
}

@Serializable
enum class TypographyStyle {
    ModernSans,
    ClassicSerif,
    PlayfulRounded,
    MonospaceTech,
    EditorialCondensed
}
```

---

## 4. UI/UX Flow & Live Preview Canvas

### 4.1 Customization Screen (`CustomizationEditorScreen`)
- **Top Half: Sticky Interactive Canvas:**
  - Shows instant, real-time preview of the event card as the user switches colors, fonts, or images.
  - Interactive tap-to-toggle unit display.
- **Bottom Half: Categorized Settings Sheet:**
  - Tab 1: **Background** (Solid / Gradient / Photo upload; dim and blur sliders).
  - Tab 2: **Card Style** (Visual selector chips, card size).
  - Tab 3: **Typography** (Font family chips with live text previews).
  - Tab 4: **Audio** (Background music linking).

### 4.2 Auto-Contrast Engine
- Computes perceived luminance of the selected background / image area.
- Automatically suggests or enforces white vs dark text to maintain at least WCAG AA contrast ratio (>= 4.5:1).
- Adds subtle text drop shadows when full-bleed image backgrounds are selected.

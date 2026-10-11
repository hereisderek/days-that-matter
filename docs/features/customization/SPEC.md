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

### 2.2 Typography Presets
- **Modern Sans:** Crisp, geometric readability (Inter / Roboto).
- **Classic Serif:** Elegant, romantic milestones (Playfair / Merriweather).
- **Playful Rounded:** Birthdays, fun events (Nunito / Quicksand).
- **Monospace Tech:** Deadlines, count-ups, productivity (JetBrains Mono).
- **Editorial Condensed:** High-impact posters (Oswald / Anton).

### 2.3 Card Styles
- **Glassmorphic:** Frosted glass effect with blur, subtle white border, and soft drop shadow.
- **Minimalist Clean:** Pure flat surface with subtle border, maximizing clean typography.
- **Card Outlined:** High-contrast outline card, great for light or dark wallpapers.
- **Full-Bleed Poster:** Background stretches edge-to-edge with overlaid floating typography.

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
    val dimBackgroundFactor: Float = 0.2f // 0.0 to 0.8 scrim overlay; shared as backdrop.dim
)

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
  - Tab 1: **Background** (Solid / Gradient / Photo upload).
  - Tab 2: **Card Style** (Visual selector chips).
  - Tab 3: **Typography** (Font family chips with live text previews).
  - Tab 4: **Audio** (Background music linking).

### 4.2 Auto-Contrast Engine
- Computes perceived luminance of the selected background / image area.
- Automatically suggests or enforces white vs dark text to maintain at least WCAG AA contrast ratio (>= 4.5:1).
- Adds subtle text drop shadows when full-bleed image backgrounds are selected.

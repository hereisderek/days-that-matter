# :core:designsystem

Theme, design tokens and base components of Days That Matter, built from `design/v2` (`styles.css` wins over `design/DESIGN_SYSTEM.md`).

## Use

```kotlin
DaysThatMatterTheme {                       // follows the system light/dark setting
    val bg = DtmTheme.colors.bg             // tokens: colors, typography, radii, spacing, elevation
    DayCardRow(DayCardState(title = "Norway trip", emoji = "🏔️", number = "38", unit = "days to go"))
}
```

- `theme/`: `DtmColors` (light and dark), `AccentChoice`, `DtmTypography`, `DtmRadii`, `DtmSpacing`, `DtmElevation`, `CardTone`, `CardPalette`, `DaysThatMatterTheme`. Only these files hold literal color, size and font values.
- `AutoContrast.kt`: `resolveCardTone`, picks white or ink text for a card background (WCAG contrast, black dim scrim included).
- `components/`: `DayCardRow`, `DayCardTile`, `DayCardGrid`, `CountdownNumber`, `CategoryChip`, `DtmButton`, `SearchField`, `DtmTopBar`, `IconCircleButton`, `SectionHeader`, `EmptyState`, `NewDayFab`, `BottomFade`. Components take plain values (`DayCardState`), never `:core:model` types.
- `gallery/DesignGallery.kt`: debug gallery of every token and component in light, dark or both. `:composeApp` shows it until the real screens exist.
- Dynamic color is off by default so the brand palette shows. Pass `dynamicColorScheme` to `DaysThatMatterTheme` to replace only the Material 3 scheme (Android 12+); `DtmTheme.colors` and the cards keep the brand palette.

## Font

Geist and Geist Mono (SIL OFL 1.1, `FONT-LICENSE-Geist.txt`) are bundled as Compose resources in `src/commonMain/composeResources/font` (Regular, Medium, SemiBold, Bold; Mono Regular, Medium). v2 asks for weights 550 and 650 from a variable font; the static cuts map them to Medium and SemiBold. v2's card typefaces Instrument Serif, Nunito and Oswald are not bundled: Serif uses the platform serif, Rounded and Condensed use Geist. Add them with the Customize work.

## Tests

- Token, contrast, size and grid tests are in `commonTest` and run on every host target.
- Compose UI tests are in `jvmTest` (`runComposeUiTest`, headless): `./gradlew :core:designsystem:jvmTest`. The module has a `jvm()` target only for these tests; no app links it. They do not need a device.
- `./gradlew :core:designsystem:allTests` runs both.

## Deviations from v2 (each on purpose)

| Item | v2 | Here | Reason |
| :--- | :--- | :--- | :--- |
| Weights 550 and 650 | variable Geist | Medium (500), SemiBold (600) | static fonts; variable fonts are not reliable on every KMP target |
| Backdrop blur of glass chips and pills | `backdrop-filter: blur` | translucent fill and edge only | no cross-platform backdrop blur in Compose |
| Film grain `.card-grain` | noise at 22% overlay | not drawn | cost against a barely visible effect |
| Shadows `--shadow-1`, `--shadow-2` | offset, blur and negative spread | platform elevation 3 dp and 14 dp, tinted | Compose shadows have no spread or offset |
| Radial gradients | elliptical, percent sizes | elliptical via a scale transform, same stops | same look; checked by eye |
| Auto text color | `luminance * (1 - dim)` crossover 0.2 | dim blended in sRGB, then higher WCAG ratio of white or ink | same crossover, honest with the scrim |
| Touch targets | icon button 40 px, chip 34 px | 48 dp touch target, visible size unchanged | Android guideline; chips and icon buttons take 48 dp of layout height |
| Bottom navigation | none; floating "New day" pill and a fade | `NewDayFab` and `BottomFade` | the 4-tab bar of `DESIGN_SYSTEM.md` is v1 |
| Category colors | chips are neutral | no category colors; status colors rose, emerald, amber and violet kept as tokens | v2 has none; `DESIGN_SYSTEM.md` has the status set |
| Pinned hero card, detail page card, widget and share image cards | drawn | not built | not in this wave's list |

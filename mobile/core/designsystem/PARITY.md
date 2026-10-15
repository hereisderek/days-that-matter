# Parity with design/v2 (styles.css)

| Token or component | v2 source | Here | Match |
| :--- | :--- | :--- | :--- |
| Light bg, surface, ink, accent | `:root` l.7-19 | F5F7F3, FFFFFF, 111714, 0E8F63 (`TokensTest`) | yes |
| Dark bg, surface, ink, accent | `data-theme=dark` l.59-76 | 0F1312, 171C1A, ECF1EE, 52D6A3 | yes |
| Accent soft | `color-mix(accent 13%, surface)` l.21 | sRGB mix 13% | yes |
| Status colors rose, emerald, amber, violet | none in v2; DESIGN_SYSTEM.md 2.1 | F43F5E, 10B981, F59E0B, 8B5CF6 | doc value (v2 has none) |
| Radii | `--r-xl/lg/md/sm` l.27-30 | 30, 22, 16, 12 | yes |
| Font | `--font-ui` Geist (DESIGN_SYSTEM.md says Inter) | Geist bundled | yes (v2 wins) |
| Screen title | `.h1` l.338 | 32 sp, -0.04em, 1.05, weight 600 not 650 | approx (static font) |
| Row heights | `.ctx-row` l.257, size-sm/lg | 64, 84, 132 dp (tested) | yes |
| Row radii | l.257, 595, 604 | 18, 22, 26 | yes |
| Row number sizes | l.264-267, 590-607 | 24, 30, 46; poster 40; serif 36 (tested) | yes |
| Emoji chip sizes | `.ctx-row .emo` | 36, 46, 54 dp | yes |
| Tile | `.ctx-tile` l.270-277, 609-612 | 1:1.1, Small 1:0.8, Large 196 dp full width, number 46/60 | yes |
| Glass tone | `.card`, `.tone-light` l.204-210 | CardTone values (tested) | yes |
| Card styles | `.st-clean/outline/poster` | Glass, Clean, Outline, Poster | yes (grain and backdrop blur omitted) |
| Memo badge | l.746-757 | 18 dp tab, left 24 / right 10 dp, "9+" (tested) | yes |
| Chip | `.chip` l.181 | 34 dp, 14 sp, pill, ink when selected | yes (48 dp touch target added) |
| Buttons | `.btn` l.194-200 | 54 dp / 16 sp, 50 / 15, 36 / 14 | yes |
| Search | `.search` l.340 | 46 dp, radius 16, shadow | approx (shadow) |
| Header | `.home-head` l.336 | kicker 13, title 32, 40 dp round buttons | yes |
| Section header | `.sec-head` l.346 | 14 sp semibold, count ink-3 | yes |
| Empty state | `.empty` l.357 | 40 sp emoji, 17 sp title | yes |
| FAB | `.fab` l.354 | 54 dp pill, ink | yes (shadow approx) |
| Shadows | `--shadow-1/2` | elevation 3 / 14 dp | no (platform limit) |

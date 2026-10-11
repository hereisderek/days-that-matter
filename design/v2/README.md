# Days That Matter: design v2

An interactive prototype of a new UI for Days That Matter, plus the design rules behind it and a list of missing features.

This version was designed from the feature specs in [`docs/features/`](../../docs/features/), not from v1.

## Open the prototype

```bash
python3 -m http.server 8766 --directory design/v2
```

Then open http://localhost:8766. Opening `index.html` directly from disk also works.

The left panel jumps between screens and switches light and dark. On a phone-width window the panel becomes a row of tabs and the app fills the screen.

Things to try:

- Long-press (or right-click) any card on Home, then **Pin to top**. The pinned card moves into the big slot and the old one goes back to the list, with Undo.
- Open a day and tap the big number to cycle Days, Y·M·D, Weeks, Hours and Workdays.
- **Customize**: change the photo (or upload your own), color, gradient or art, then the card style and typeface. The preview switches between how the card looks pinned, in the list, and as a widget.
- Settings › **Count the first day as Day 1**, then look at the "Since" cards.

| File | What it holds |
| :--- | :--- |
| `index.html` | Page shell and font loading |
| `styles.css` | Design tokens (top of file), components, screens |
| `app.js` | Sample data, date math, screens, interactions |
| `README.md` | This document |

Prototype limits: sample photos are loaded from picsum.photos (Unsplash photos). The QR code is a placeholder pattern. Buttons that would open system UI (file picker, share sheet, sign-in) show a short message instead.

---

## 1. Direction

The brief: modern, fresh and light (耳目一新, 清新), while every day card can look different.

The design solves this by splitting the screen into two layers:

- **The app shell is quiet.** Near-white background with a faint green tint, white surfaces, dark ink, one accent color. No gradients or heavy shadows in the shell.
- **The cards carry the color.** Each day has its own photo, color, gradient or art. Because the shell is neutral, a list of very different cards still looks calm.

Principles:

1. **The number leads.** The day count is the largest thing on every card. Labels next to it are short and plain ("days left", "days since").
2. **One pinned day.** Exactly one day can be pinned. It becomes the large card at the top of Home. Pinning another day replaces it.
3. **Same customization everywhere.** Background, card style, typeface, text color, darkness, blur and music work the same way for every day, and the card looks the same in the list, the pinned slot, the day page, widgets and share images.
4. **Readable by default.** Text color is chosen from the background automatically. Photos get a dark scrim and a soft gradient behind the text. The editor shows the contrast ratio.
5. **Soft motion.** Short fades and slides, a light spring on switches, a list that settles in. Everything turns off with the system "reduce motion" setting.

## 2. Tokens

All values live at the top of `styles.css`.

### Color

| Token | Light | Dark | Use |
| :--- | :--- | :--- | :--- |
| `--bg` | `#F5F7F3` | `#0F1312` | Screen background |
| `--surface` | `#FFFFFF` | `#171C1A` | Cards in settings, blocks, sheets, inputs |
| `--surface-2` | `#EEF2ED` | `#1F2623` | Segmented controls, tracks, wells |
| `--surface-3` | `#DCE3DD` | `#2C3531` | Switch off state |
| `--ink` | `#111714` | `#ECF1EE` | Primary text, primary button |
| `--ink-2` | `#4A544F` | `#A9B3AE` | Secondary text |
| `--ink-3` | `#7F8984` | `#737D78` | Captions, counts |
| `--line` / `--line-2` | 7% / 13% ink | 7% / 14% ink | Dividers, outlines |
| `--accent` | `#0E8F63` (Jade) | `#52D6A3` | Save, switches, progress, focus ring |
| `--accent-soft` | accent 13% on surface | same | Tags, milestone chips |
| `--danger` | `#D2433A` | same | Delete, revoke |

App accent is a setting with five options: Jade (default), Sky, Coral, Plum, Ink. Each has a light and a dark value.

### Type

UI font: **Geist** (variable, 400 to 700). Numbers use tabular figures.

| Role | Size / weight | Where |
| :--- | :--- | :--- |
| Display XL | 112 / 650, tracking -4.5% | Day page number |
| Display L | 76 / 650 | Pinned card number |
| Display M | 44 to 46 / 650 | Grid tile, small widget |
| Display S | 30 / 650 | List row number |
| Title | 32 / 650, tracking -4% | Screen titles |
| Body | 15 / 400 | Default text |
| Label | 13 / 600 | Field labels, section titles |
| Caption | 11.5 to 12.5 / 500 | Units under numbers, notes |
| Mono | Geist Mono 12 to 13 / 500 | Live ticker |

Card typefaces (maps to `TypographyStyle` in the customization spec):

| v2 name | Font | Spec enum |
| :--- | :--- | :--- |
| Modern | Geist | `ModernSans` |
| Serif | Instrument Serif (titles in italic) | `ClassicSerif` |
| Rounded | Nunito 800 | `PlayfulRounded` |
| Mono | Geist Mono | `MonospaceTech` |
| Poster | Oswald 600, uppercase titles | `EditorialCondensed` |

All five are SIL Open Font License fonts and can be bundled as Compose resources.

### Shape, space, depth, motion

- Radius: 36 sheets, 30 pinned card and widgets frame, 22 cards, 16 inputs and tiles, 12 small controls, full pill for chips, buttons and segmented controls.
- Spacing: 16 screen gutter, 10 between cards, 18 to 20 between sections, 14 to 16 inside blocks.
- Elevation: `--shadow-1` (resting blocks, chips) and `--shadow-2` (floating button, sheets, previews). Cards in lists have no shadow.
- Motion: `cubic-bezier(.2,.8,.2,1)` for movement, a light overshoot spring for switches. Screen push 420 ms, sheet 380 ms, list items rise 500 ms with a 40 ms stagger. All disabled under reduce motion.
- Texture: a fine noise layer at 22% overlay on Glass and Poster cards. It keeps flat colors and gradients from looking plastic.

## 3. The day card

One component, drawn in several sizes.

**Layers, bottom to top:** background (photo, color, gradient or art) → darken scrim (`dim`, 0 to 70%) → legibility gradient (photos only) → grain → content.

**Sizes (contexts):**

| Context | Size | Shows |
| :--- | :--- | :--- |
| Pinned | full width × 240 | Pin badge, emoji, title, full date and time, big number, live ticker |
| List row | full width × 84 | Emoji, title, short date and repeat info, number and unit |
| Grid tile | half width, 1:1.1 | Emoji, number, unit, title, date |
| Day page | full screen | Everything, plus the unit switch |
| Widget small / medium | 1:1 / 2:1 | Number, unit, title; medium adds the next three days |
| Share story / square | 9:16 / 1:1 | Emoji, title, number, date, optional watermark |

**Card styles** (maps to `CardStyle`):

| v2 name | Behavior | Spec enum |
| :--- | :--- | :--- |
| Glass | Background fills the card. Emoji, pin badge and ticker sit on frosted chips. Grain on. | `Glassmorphic` |
| Clean | Background fills the card. No chips, no grain, no blur. | `MinimalistClean` |
| Outline | Light surface card with a 1.5 px edge in the chosen color. The emoji chip shows the background as a swatch. Follows the app theme. | `CardOutlined` |
| Poster | Background fills the card. Number about 25% larger, title in small uppercase. | `FullBleedPoster` |

On the day page and in share images, Outline is drawn as Clean, because those are full-bleed by nature.

**Text color.** `Auto` picks white or ink, whichever has more contrast against the background's base color after the darken scrim (relative luminance above 0.2 means ink). Gradients and art presets store a base color for this. Photos always get white text with the scrim and legibility gradient. Users can force Light or Dark; the editor then shows the ratio and warns below 4.5:1.

**Dark mode.** Card backgrounds are drawn at 90% brightness so pastel cards do not glare on a dark screen.

## 4. Screens

### Welcome

Three floating sample cards (a photo card, a color card, a serif anniversary) show what the app does before any text. Then one line of copy and three actions: **Continue with Google** (primary), **Continue with email**, **Skip for now**. Skipping creates a guest account as the auth spec requires.

### Home

- Header: today's date and "Your days", search and settings buttons.
- **Pinned card** at the top, if a day is pinned and the setting is on. Hidden while searching or filtering so results are not split.
- Filter chips: All, Upcoming, Since, then the categories.
- Two sections, **Upcoming** and **Since**, each with a count. The first section header holds the list/grid switch and sort (Closest first, Furthest first, A to Z, Recently added).
- A pinned day that is shown in the list (while filtering) gets a small pin icon.
- Long-press or right-click a card for: Pin to top / Unpin, Customize, Share, Duplicate, Delete. Delete shows Undo.
- Floating **New day** button, with a fade behind it so the last card never sits under it.
- Empty state for no days and for no search results.

### Day page

- The day's own background fills the screen. Back, music, share and more buttons sit on glass circles.
- Category and repeat badge, emoji, title, full date and time, then the number.
- Tap the number, or use the segmented control, to switch Days / Y·M·D / Weeks / Hours / Workdays. The choice is saved on the day.
- The live ticker under the number counts down to the exact event time. The big number counts calendar days. A trip at 9:30 next month can show "38 days" and "37d 23h": both are correct, and this is intended.
- A sheet slides up over the background with: action buttons (Customize, Share, Music, Memo), **Milestones** (countdown progress for future days; next milestone, reached milestones and next anniversary for past days), **Memos** (timeline with author, date and milestone tag, quick add field), and **Details**.
- Opening a day on its date plays a short confetti burst.
- The music button is a small record that spins while playing.

### Customize

- Sticky preview at the top, with a switch to see the card **Pinned**, in the **List**, or as a **Widget**.
- Tabs:
  - **Details**: title (40 characters, counter), emoji, date, optional time, repeat (never, yearly, monthly, weekly, every N days), category, **Pin to top** (shows which day it will replace), reminder.
  - **Background**: Photo (upload or samples, tap to set the focus point), Color (16 swatches plus custom), Gradient (8 soft mesh gradients), Art (6 illustrated presets). Darken and Blur sliders. Contrast readout.
  - **Style**: card style with live mini previews of the current day, typeface, text color (Auto, Light, Dark), default unit.
  - **Sound**: preset tracks with preview, pick a file, volume, loop, fade.
- Save without a title shows "Give it a name first" and returns to the title field.

### Share

A sheet with three tabs: **Story 9:16**, **Square**, **Link & QR**. The image tabs show the export at true ratio with a watermark switch. The link tab shows the link, a QR code, expiry (never, 7, 30, 365 days), update and revoke. It states what is shared, and warns that **photos are not shared**: the share service only accepts theme ids, so the web page needs a color fallback for photo cards.

### Widgets

A home-screen mock with a small and a medium widget, a lock-screen mock with a circular and a rectangular accessory, and a widget look option: Match card, Minimal, Tinted.

### Settings

Account card (guest state with Sign in), Appearance (theme, accent, big pinned card, home layout), Counting (first day as Day 1, week start, workdays), Reminders, Widgets, Backup and import, Recently deleted, Privacy lock, Language. Items marked **New** do not exist in the current specs; see section 6.

## 5. Pinning rule (differs from the current spec)

`docs/features/events/SPEC.md` §4.1 describes a "Pinned Hero Carousel" of several pinned days. v2 uses **one** pinned day, as requested.

- At most one `Event.isPinned == true` per user. Pinning a day clears the flag on the others in the same database transaction (a use case such as `PinEventUseCase`), and the sync layer sends both changes together.
- After pinning, a message names the day that moved back to the list and offers Undo.
- Settings › **Big pinned card** hides the large slot for people who prefer a plain list. The pin is kept; the day just shows in the list with a pin icon.
- Widgets default to the pinned day.

The events spec should be updated if this is accepted.

## 6. Missing functionality and recommended additions

Compared against all specs in `docs/features/` and `docs/SPEC.md`. P0 means the UI above depends on it, or the first release would feel incomplete without it. P1 is soon after. P2 is later.

### P0: gaps the v2 UI needs

| # | Item | Why | Touches |
| :--- | :--- | :--- | :--- |
| 1 | **Reminders and notifications** | No spec mentions notifications at all. A countdown app without "remind me the day before" misses its main daily use. Needs per-day reminder (on the day, 1 day, 1 week before, custom), default delivery time, and milestone alerts for count-ups. iOS allows 64 pending notifications, so schedule the nearest ones and refill. Android 13+ needs the notification permission prompt. | New `docs/features/reminders/SPEC.md`, `Event`, settings |
| 2 | **Single pin** | See section 5. Spec says carousel. | Events spec §4.1 |
| 3 | **Fields the UI needs on `Event`** | `emoji` (the share payload has it, the model does not), `timeZone` (the sharing spec §2.6 already flags this), `displayUnit` (share payload has "unit mode"), `sortOrder` (spec promises custom order), `reminders`, `deletedAt`. | Events spec §3, Room schema, sync |
| 4 | **Category model** | `Event.categoryId` exists, but there is no `Category` entity (name, emoji, color, order, built-in vs custom) and no screen to manage them. | Events spec |
| 5 | **Settings screen spec** | Not specified anywhere: theme, accent, counting rules, notifications, data, language, about, plus the account items from the auth spec. | New spec section |
| 6 | **"Count the first day as Day 1"** | Couples and streak counters expect "Day 1" on the start date (在一起第 N 天). Changes the number and the milestone math, so it must be one shared rule in the engine. | Events spec §2 |
| 7 | **Delete with Undo and Recently deleted** | Only memos have undo today. With cloud sync a soft delete (tombstone) is needed anyway; keep deleted days for 30 days. | Events spec, persistence and sync |
| 8 | **What happens when a one-time day passes** | Spec implies it turns into "X days since". Better: on the day after, ask once: keep counting up, archive, or repeat yearly. Add an Archive filter. | Events spec §2.2 |
| 9 | **Empty, loading, error and offline states** | None are specified per screen. v2 shows Home empty and no-results states; the rest need definitions. | All feature specs |
| 10 | **Photo handling rules** | Focus point, max stored size and compression, what a guest loses on reinstall, storage quota for synced users, and the share fallback color for photo cards. | Customization spec §2.1, sharing spec |

### P1: recommended soon after

| # | Item | Why |
| :--- | :--- | :--- |
| 11 | **Lunar calendar dates (农历)** | Many Chinese users keep birthdays and festivals on lunar dates. Needs "repeats yearly on the lunar date" and a lunar date picker. Other calendars (Hebrew, Islamic) can follow the same model. |
| 12 | **Holidays and templates** | Public holiday sets per region (also needed for correct Workdays counts), Chinese festivals and solar terms (节气), and quick templates: Birthday, Anniversary, Exam, Payday, Due date, Retirement. Makes the first minute in the app faster. |
| 13 | **Milestone model** | The day page shows milestones (100, 365, 500, 520, 1000, 1314, yearly), but no spec defines the list, custom milestones, or alerts. |
| 14 | **Backup, export, import** | Guest data lives only on the device. Add JSON export and import, and `.ics` import from the system calendar. |
| 15 | **Widget configuration** | Spec covers widget sizes but not choosing which day each widget shows, the widget look, or hiding titles. |
| 16 | **Privacy lock and private days** | Biometric app lock. A "private" flag that hides the title in widgets, notifications and share previews. |
| 17 | **Localization** | At least English, 简体中文, 繁體中文. Locale date formats, week start, plural rules for "1 day / 2 days". |
| 18 | **Accessibility details** | Cap Dynamic Type growth of the big number so it does not wrap, screen-reader labels for live counters that do not announce every second, 44/48 pt touch targets, reduce motion. The master spec only states the contrast target. |
| 19 | **Adaptive layout** | Tablet, desktop and web: Home list on the left, day page on the right at 840 dp and wider, keyboard shortcuts, hover states. Not mocked in v2. |
| 20 | **Custom order** | Drag to reorder in the list. Needs `sortOrder` (item 3). |

### P2: later

| # | Item | Why |
| :--- | :--- | :--- |
| 21 | **Range days** | Start and end date with progress: pregnancy week 23 of 40, semester 58%, visa days left. |
| 22 | **Calendar view** | Month view of all days. |
| 23 | **Live Activities and ongoing notifications** | iOS Dynamic Island and Lock Screen countdown in the last 24 hours; Android equivalent. |
| 24 | **Watch** | Wear OS tile and watchOS complication. |
| 25 | **Shared and collaborative days** | Already deferred in the sharing spec (memos on shared days). |
| 26 | **Define Premium** | `UserSession.isPremium` exists but no spec says what it unlocks. Decide before building any paywall (for example cloud photo sync, custom audio, extra widgets). |
| 27 | **Voice and system actions** | Siri / App Shortcuts and Android App Functions: "How many days until the Norway trip?" |

## 7. Proposed model changes

These are proposals. Following `AGENTS.md`, the feature specs should be updated once the design is accepted, not before.

```kotlin
// Event (events spec §3), additions only
val emoji: String = "✨",
val timeZone: String? = null,             // IANA name; null = floating (sharing spec §2.6)
val displayUnit: DisplayUnit = DisplayUnit.Days, // Days, YearsMonthsDays, Weeks, Hours, Workdays
val sortOrder: Long = 0,
val reminders: List<Reminder> = emptyList(),
val deletedAt: Instant? = null,
// isPinned: at most one per owner, enforced by PinEventUseCase

// EventCustomization (customization spec §3)
val textColor: TextColorMode = TextColorMode.Auto,   // Auto, Light, Dark; replaces textColorOverride
val blurRadius: Float = 0f,                           // 0 to 16, photos and art only

// BackgroundConfig
data class CustomImage(val localPath: String, val remoteUrl: String? = null,
                       val focusX: Float = .5f, val focusY: Float = .5f) : BackgroundConfig
data class GradientPreset(val presetId: String) : BackgroundConfig // soft mesh presets in v2
// ImagePreset(presetId) covers the Art presets (bundled vector art)
```

Each gradient and art preset needs a stored base color, used for auto text color and as the share-page fallback.

## 8. Notes for the Compose build

- **Fonts:** bundle Geist, Geist Mono, Instrument Serif, Nunito and Oswald as Compose resources. Turn on tabular figures (`fontFeatureSettings = "tnum"`) for every number.
- **Glass:** `Modifier.blur` blurs a composable's own content, not what is behind it. Frosted chips need a backdrop blur (Android `RenderEffect` on 12+, platform effects elsewhere). Below Android 12 use the translucent fill without blur; the design still reads.
- **Mesh gradients:** three `Brush.radialGradient` layers over a solid base color reproduce the CSS presets.
- **Grain:** a small tiled noise bitmap drawn at 20% opacity. Optional on low-end devices.
- **Auto contrast for photos:** sample the average luminance of the lower part of the decoded image once, store it with the customization, and raise the default darken value for bright photos. The prototype uses a fixed scrim instead.
- **Live ticker:** recompose only the ticker text once a second, not the card.
- **Reduce motion:** read the platform setting (Android animator duration scale, iOS Reduce Motion) and skip the stagger, confetti and record spin.

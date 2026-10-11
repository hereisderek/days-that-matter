# Days That Matter: design v2

An interactive prototype of a new UI for Days That Matter, plus the design rules behind it and a list of missing features.

This version was designed from the specs, not from v1. Revision 2 follows the OpenSpec change [`pluggable-backend-live-sharing`](../../openspec/changes/pluggable-backend-live-sharing/) and the feature docs updated with it (accounts, plans, live sharing, backdrops, audio). Where the two disagree, the OpenSpec change wins, as `AGENTS.md` says.

## Open the prototype

```bash
python3 -m http.server 8766 --directory design/v2
```

Then open http://localhost:8766. Opening `index.html` directly from disk also works.

The left panel jumps between screens and switches the theme, the account (Guest or Signed in) and the plan (Free or Premium). On a phone-width window it becomes a row of tabs and the app fills the screen.

Things to try:

- Long-press (or right-click) a card on Home. Owned days offer **Pin to top**; the pinned card moves into the big slot and the old one goes back to the list, with Undo. "Grandma's 90th" is shared with you as an editor and offers Edit, History, Report and Leave instead.
- Open a day and tap the big number to cycle **Auto**, **Days** and **Y·M·D**.
- **Customize** › Background › Photo: pick a tile marked LIVE. It moves in the preview. On Free, Save shows the paywall with **Use still photo**.
- **Share** on "Norway trip": create a public link with a label and expiry, an invite with a role and use count, change a member's role, remove someone.
- Switch the panel to **Guest** and tap Share: the sign-in prompt appears first. Create a day as a guest: the prompt appears once after the first save.
- Settings shows the account, Sync, and the plan's limits in use. Create days until the eleventh: the paywall appears.

| File | What it holds |
| :--- | :--- |
| `index.html` | Page shell and font loading |
| `styles.css` | Design tokens (top of file), components, screens |
| `app.js` | Sample data, date math, plan table, screens, interactions |
| `README.md` | This document |

Prototype limits: sample photos are loaded from picsum.photos (Unsplash photos), and their "Live" motion is simulated with a short zoom. The QR code is a placeholder pattern. Buttons that would open system UI (file picker, share sheet, store purchase, Spotify) show a short message instead. Sign-in buttons are plain text; production uses Apple's and Google's official button assets.

---

## 1. Direction

The brief: modern, fresh and light (耳目一新, 清新), while every day card can look different.

The design splits the screen into two layers:

- **The app shell is quiet.** Near-white background with a faint green tint, white surfaces, dark ink, one accent color. No gradients or heavy shadows in the shell.
- **The cards carry the color.** Each day has its own photo, Live Photo, color, gradient or art. Because the shell is neutral, a list of very different cards still looks calm.

Principles:

1. **The number leads.** The day count is the largest thing on every card. Labels next to it are short and plain ("days left", "days since").
2. **One pinned day.** Exactly one owned day can be pinned. It becomes the large card at the top of Home.
3. **Same customization everywhere.** Background, card style, typeface, text color, darkness and music work the same way for every day, and the card looks the same in the list, the pinned slot, the day page, widgets, share images and the web page.
4. **Readable by default.** Text color is chosen from the background automatically. Photos get a dark scrim and a soft gradient behind the text. The editor shows the contrast ratio. The specs require 4.5:1.
5. **Calm about money and accounts.** Guests can do everything local without signing in. Paid features can be picked and previewed for free; the paywall appears only on Save and always offers a free way out where one exists.
6. **Soft motion.** Short fades and slides, a light spring on switches, Live Photos that play once. Everything turns off with the system "reduce motion" setting.

## 2. Tokens

All values live at the top of `styles.css`.

### Color

| Token | Light | Dark | Use |
| :--- | :--- | :--- | :--- |
| `--bg` | `#F5F7F3` | `#0F1312` | Screen background |
| `--surface` | `#FFFFFF` | `#171C1A` | Blocks, sheets, inputs |
| `--surface-2` | `#EEF2ED` | `#1F2623` | Segmented controls, wells |
| `--surface-3` | `#DCE3DD` | `#2C3531` | Switch off state |
| `--ink` | `#111714` | `#ECF1EE` | Primary text, primary button |
| `--ink-2` | `#4A544F` | `#A9B3AE` | Secondary text |
| `--ink-3` | `#7F8984` | `#737D78` | Captions, counts |
| `--line` / `--line-2` | 7% / 13% ink | 7% / 14% ink | Dividers, outlines |
| `--accent` | `#0E8F63` (Jade) | `#52D6A3` | Save, switches, progress, focus ring |
| `--accent-soft` | accent 13% on surface | same | Tags, milestone chips |
| `--gold-bg` / `--gold-ink` | `#FFF1CF` / `#8A5A00` | 16% gold / `#F2C46D` | Premium badge only |
| `--danger` | `#D2433A` | same | Delete, revoke, leave |

App accent is a setting with five options: Jade (default), Sky, Coral, Plum, Ink. Each has a light and a dark value. Gold is reserved for the Premium badge so it never competes with the accent.

### Type

UI font: **Geist** (variable, 400 to 700). Numbers use tabular figures.

| Role | Size / weight | Where |
| :--- | :--- | :--- |
| Display XL | 112 / 650, tracking -4.5% | Day page number |
| Display L | 76 / 650 | Pinned card number |
| Display M | 44 to 58 / 650 | Grid tile, small widget, banner export |
| Display S | 30 / 650 | List row number |
| Title | 32 / 650, tracking -4% | Screen titles |
| Body | 15 / 400 | Default text |
| Label | 13 / 600 | Field labels, section titles |
| Caption | 11.5 to 12.5 / 500 | Units under numbers, notes |
| Mono | Geist Mono 12 to 13 / 500 | Live ticker, email code |

Card typefaces (maps to `TypographyStyle`):

| v2 name | Font | Spec enum |
| :--- | :--- | :--- |
| Modern | Geist | `ModernSans` |
| Serif | Instrument Serif (titles in italic) | `ClassicSerif` |
| Rounded | Nunito 800 | `PlayfulRounded` |
| Mono | Geist Mono | `MonospaceTech` |
| Poster | Oswald 600, uppercase titles | `EditorialCondensed` |

All five are SIL Open Font License fonts and can be bundled as Compose resources.

### Shape, space, depth, motion

- Radius: 36 sheets, 30 pinned card and widget frame, 22 cards, 16 inputs and tiles, 12 small controls, full pill for chips, buttons and segmented controls.
- Spacing: 16 screen gutter, 10 between cards, 18 to 20 between sections, 14 to 16 inside blocks.
- Elevation: `--shadow-1` (resting blocks, chips) and `--shadow-2` (floating button, sheets, previews). Cards in lists have no shadow.
- Motion: `cubic-bezier(.2,.8,.2,1)` for movement, a light overshoot spring for switches. Screen push 420 ms, sheet 380 ms, list items rise 500 ms with a 40 ms stagger, Live Photo 2.4 s once. All disabled under reduce motion.
- Texture: a fine noise layer at 22% overlay on Glass and Poster cards.

## 3. The day card

One component, drawn in several sizes.

**Layers, bottom to top:** backdrop (photo, Live Photo, color, gradient or art) → darken scrim (`dim`, 0 to 80%, a shared field) → legibility gradient (photos only) → grain → content.

**Sizes (contexts):**

| Context | Size | Shows |
| :--- | :--- | :--- |
| Pinned | full width × 240 | Pin badge, emoji, title, short date, time and zone, big number, live ticker |
| List row | full width × 84 | Emoji, title, pin or shared marker, short date and repeat info, number and unit |
| Grid tile | half width, 1:1.1 | Emoji, markers, number, unit, title, date |
| Day page | full screen | Everything, plus the unit switch; Live Photos play here |
| Widget small / medium | 1:1 / 2:1 | Number, unit, title; medium adds the next three days |
| Share story / banner | 9:16 (1080×1920) / 1.91:1 (1200×630) | Emoji, title, number, date, optional watermark "Tracked with Days That Matter" |

**Markers:** a pin icon for the pinned day; a people icon for days you share; a people icon and the owner's name ("Mum") for days shared with you.

**Card styles** (maps to `CardStyle`):

| v2 name | Behavior | Spec enum |
| :--- | :--- | :--- |
| Glass | Backdrop fills the card. Emoji, pin badge and ticker sit on frosted chips. Grain on. | `Glassmorphic` |
| Clean | Backdrop fills the card. No chips, no grain, no blur. | `MinimalistClean` |
| Outline | Light surface card with a 1.5 px edge in the chosen color. The emoji chip shows the backdrop as a swatch. Follows the app theme. | `CardOutlined` |
| Poster | Backdrop fills the card. Number about 25% larger, title in small uppercase. | `FullBleedPoster` |

On the day page and in share images, Outline is drawn as Clean, because those are full-bleed.

**Live Photos and Motion Photos** (event-backdrops spec): the motion plays once when the day opens and again when the user touches the backdrop, then rests on the key photo. A small "Live" badge sits next to the category on the day page. Lists, widgets, link previews and exports use the key photo. Reduce motion shows the key photo only.

**Text color.** `Auto` picks white or ink, whichever has more contrast against the backdrop's base color after the darken scrim (relative luminance above 0.2 means ink). Gradients and art presets store a base color for this. Photos always get white text with the scrim and legibility gradient. Users can force Light or Dark; the editor then shows the ratio and warns below 4.5:1.

**Dark mode.** Backdrops are drawn at 90% brightness so pastel cards do not glare on a dark screen.

## 4. Screens

### Welcome

Three floating sample cards, one line of copy, then **Continue with Apple** (primary on iOS), **Continue with Google**, **Continue with email**, and **Skip for now**. The same buttons sign in or create an account; there are no passwords. Only the methods the region enables are shown (`GET /config`). Under the buttons: "By continuing you agree to the Terms of Service and Privacy Policy", both linked.

### Sign-in prompt (sheet)

Shown to guests on Share, Invite, Sync, opening an invite, and once after the first saved day. Title "Sign in or create an account", one line on why, the sign-in buttons, and **Not now** where the action can wait (not on Share, which needs an account). After signing in, the interrupted action continues; for Share, the share sheet opens with the days already uploading.

Email sign-in is two steps in the same sheet: address, then the 6-digit code ("Valid for 10 minutes", "Send a new code").

### Home

- Header: today's date and "Your days", search, and the account button (initial when signed in). While edits are waiting to sync, the date line reads "Syncing 2 changes…" with a pulsing dot; sync runs on its own within 2 seconds, so this is brief.
- **Pinned card** at the top, if an owned day is pinned and the setting is on. Hidden while searching or filtering.
- Filter chips: All, Upcoming, Since, **Shared** (signed in only), then the categories.
- Two sections, **Upcoming** and **Since**, each with a count. The first section header holds the list/grid switch and sort.
- Long-press or right-click a card. Owner: Pin to top / Unpin, Customize, Share, History, Duplicate, Delete (with Undo). Editor of a shared day: Edit, Share image, History, Report, Leave. Viewer: Share image, Report, Leave.
- Floating **New day** button. On Free with 10 owned days it opens the paywall instead of an empty editor.
- Guests do not see days shared with them (they have none) or the Shared chip.

### Day page

- The day's own backdrop fills the screen. Back, music (record for tracks and files, Spotify icon for Spotify links), share and more buttons sit on glass circles.
- Badge: category and repeat for owned days; owner name and role ("Mum · Editor") for shared days. "Live" badge for animated backdrops.
- Title, full date and time. A fixed zone different from the device's shows both: "9:30 AM Oslo time", then the same moment in the viewer's local time in brackets.
- Tap the number, or use the segmented control, to switch **Auto / Days / Y·M·D** (`UnitMode`). Auto shows days, then hours and minutes in the last 48 hours. The choice is a shared field, so viewers do not get the control.
- The live ticker counts to the exact event instant. The big number counts calendar days, so a trip next month at 9:30 can show "38 days" and "37d 23h"; both are correct.
- The sheet below the backdrop:
  - Action buttons by role. Owner: Customize, Share, Music, Memo. Editor: Edit, History, Music, Leave. Viewer: Music, Report, Leave.
  - **Shared** block: for owners, the people and how many public links, with "Manage people and links"; for members, who owns it, how many people, and what their role allows.
  - **Milestones** (countdown progress, or next milestone and anniversary for past days).
  - **Memos**, owner only, labelled "only you".
  - **Details**: date, time, time zone (Fixed or Floating), repeat, music; for owners also reminder, pinned, notes, and a History button.

### History (sheet)

Owners and editors, signed in. Each revision shows author, time, revision number, and each changed field as old → new. The newest is marked Current; older ones have **Restore**, which adds a new revision. Changes to owner-only fields (notes) appear only for the owner, marked "only you see this".

### Customize

- Sticky preview at the top, with a switch to see the card **Pinned** (or **Large** for shared days), in the **List**, or as a **Widget**. Live Photos move in the preview whatever the plan.
- Tabs:
  - **Details**: title (1 to 100 characters, counter), emoji, date, optional time, **time zone** (this device, the day's own zone, or Floating, with one line on when to use each), repeat. Owner only: category, **Pin to top** (shows which day it replaces), **Notes** (4,000 characters, never shared). Editors see a note that the owner keeps notes, category, pin and memos. Reminder for everyone (proposal).
  - **Background**: Photo (shows "3 of 5 photo backdrops" and the Live Photo plan, upload or samples, LIVE tiles, a **Play as Live Photo** switch, focus point), Color, Gradient, Art. Darken slider 0 to 80%. Contrast readout. A note says photos are resized on the phone, location data is removed, and people you share with see them.
  - **Style**: card style with live mini previews, typeface, text color, unit mode.
  - **Sound**: three sources, one per day.
    - **Built-in**: the catalog with title, artist and length; Premium tracks carry a badge; every track has a preview button.
    - **My files** (Premium): pick a file; a long song shows a trim bar to choose the part to keep (AAC, at most 4 MB, about 5½ minutes). Plays for the owner and members, never on public links.
    - **Spotify**: paste a link or share from Spotify; shows the name and "opens in Spotify"; Free shows "3 days (1 used)".
    - Volume, loop and fade are under "On this device" because they do not sync.
- **Save** checks the plan of the person saving (premium spec). Over a Free limit it opens the paywall with the matching reason and a free way out: **Use still photo**, **Keep the previous music**, **Keep the previous background**. Over a Premium limit it says "Limit reached" with the same way out.

### Paywall (sheet)

A light gold-and-mint header with "Premium", the reason it opened ("Animated photos are part of Premium"), five benefits from the plan table, Yearly and Monthly options with store prices, **Upgrade to Premium**, the free alternative if any, **Restore purchases**, **Not now**, and one line: billed by Apple or Google, people you share with never need Premium, ending a plan never removes anything. Only Premium is offered; Premium Plus is reserved.

### Share (sheet, owner)

Three tabs. "Links update live when the day changes" under the title; there is no "update link" step anymore.

- **Public link**: up to 10 links, each with label and expiry, copy and revoke (revoke asks to confirm and says other links and people keep access). **New public link**: optional label, expiry 5 days, 30 days, Never (default) or Custom. QR code of the first link. A note lists what is shared (title, date, time, zone, unit, repeat, look, photo, built-in music) and what stays private (notes, memos, category, pin; own music files play for invited people only).
- **People**: create an invite with role (Viewer · sees it live / Editor · can change it), how many people (1, 5, 10, Unlimited, Custom) and expiry (30 days default). Open invites with uses left, copy and revoke. People list (n of 100) with a role switch and remove; removed people with **Allow again**.
- **Image**: Story 9:16 or Banner 1.91:1 preview, watermark switch, Save and Share.

Members get only the Image tab, with "Only Mum can create links and invites."

### Widgets

A home-screen mock with a small and a medium widget, a lock-screen mock with a circular and a rectangular accessory, and a widget look option: Match card, Minimal, Tinted. Live Photos show the key photo.

### Settings

- Signed in: profile (name, email, sign-in methods, plan badge) and **Sync** ("Synced 4 min ago" or "2 changes waiting", **Sync now**; after a manual sync: "Changes sync automatically after each edit"). Guest: "Saved on this device only" with **Sign in**.
- **Plan**: limits in use as meters (Days 9 of 10, Photo backdrops 3 of 5, Spotify days 1 of 3), Live photos and music files as Premium, **Upgrade to Premium** or "Manage in the App Store", **Restore purchases**.
- Appearance, Counting, Reminders, More (Widgets, Recently deleted, Privacy lock, Export for guests, Language, Terms of Service, Privacy Policy).
- **Account** (signed in): display name, add sign-in method, **Sign out** (this device only; warns about unsynced changes), **Delete account** (lists what is deleted; on Premium, says to cancel the subscription in the store first).

Items marked **New** are proposals not in the current specs; see section 6.

## 5. Pinning rule (differs from the events spec)

`docs/features/events/SPEC.md` §4.1 still describes a "Pinned Hero Carousel". v2 uses **one** pinned day, as requested.

- At most one owned `Event.isPinned == true` per user. Pinning clears the flag on the others in the same transaction (a use case such as `PinEventUseCase`); the sync layer sends both changes.
- After pinning, a message names the day that moved back to the list and offers Undo.
- Settings › **Big pinned card** hides the large slot; the pin stays and shows as an icon in the list.
- Pin state is an owner-only field (event-sync spec), so members cannot pin a day shared with them. See gap 10.

The events spec should be updated if this is accepted.

## 6. Missing functionality and recommended additions

Compared against `openspec/changes/pluggable-backend-live-sharing/`, `docs/features/` and `docs/SPEC.md`. P0 means the UI depends on it or the first release would feel incomplete without it.

Covered by the new specs and removed from this list: what Premium includes, sharing with roles and live updates, photo limits and metadata removal, the time zone, emoji and unit fields on `Event`, and sign-in methods.

### P0

| # | Item | Why | Touches |
| :--- | :--- | :--- | :--- |
| 1 | **Reminders (local notifications)** | Still no spec. Push notifications are out of scope in the OpenSpec change, so reminders must be scheduled on the device: on the day, 1 day, 1 week before, milestone alerts, default time. iOS allows 64 pending; schedule the nearest and refill. Android 13+ needs the permission prompt. | New spec, `Event`, settings |
| 2 | **Single pin** | Section 5. Spec says carousel. | Events spec §4.1 |
| 3 | **Fields still missing on `Event`** | `sortOrder` (the spec promises custom order), `reminders`, `deletedAt` for an owner-side trash. | Events spec §3, Room, sync |
| 4 | **Category model** | `Event.categoryId` exists, `Category` does not (name, emoji, color, order, built-in vs custom), and there is no screen to manage them. | Events spec |
| 5 | **App settings spec** | The auth spec now covers the account sheet. Theme, accent, counting rules, reminders, widgets, language and data are still unspecified. | New spec section |
| 6 | **"Count the first day as Day 1"** | Couples and streak counters expect "Day 1" on the start date (在一起第 N 天). Changes the number and milestones, so it belongs in the shared engine in `:core:model`. | Events spec §2 |
| 7 | **Undo and Recently deleted** | The sync spec defines what deletion does to other people, not how an owner recovers from a mistake. Keep deleted days 30 days on the backend and offer Undo in the app. | Events spec, BACKEND.md |
| 8 | **When a one-time day passes** | Ask once on the day after: keep counting up, archive, or repeat yearly. Add an Archive filter. | Events spec §2.2 |
| 9 | **Empty, loading, error and offline states in the app** | The sharing spec defines web page states and link errors; app screens still have none. v2 shows only Home empty and no-results states and the sync line. | All feature specs |
| 10 | **Member-side pin, category and reminder** | Pin and category are owner-only fields, so a member cannot pin or file a shared day on their own Home. Store a small per-account overlay (pin, category, reminder, sort order) next to the membership. | event-sync, event-sharing specs |
| 11 | **Paywall content and store rules** | Prices, trial or no trial, and the subscription terms Apple and Google require near the buy button (length, price per period, auto-renew, links to terms and privacy). | premium spec, `docs/legal/` |
| 12 | **Conflict message** | The sync spec says the app tells the owner when an offline edit replaced someone else's newer change. Proposed pattern: a toast "Your change replaced Lin's time" with **View history**. | event-sync spec |

### P1

| # | Item | Why |
| :--- | :--- | :--- |
| 13 | **Lunar calendar dates (农历)** | Many Chinese users keep birthdays and festivals on lunar dates. Needs "repeats yearly on the lunar date" and a lunar date picker, in the shared engine. Matters more with a China region planned (`CHINA.md`). |
| 14 | **Holidays and templates** | Public holiday sets per region, Chinese festivals and solar terms (节气), and quick templates: Birthday, Anniversary, Exam, Payday, Due date. |
| 15 | **Milestone model** | The day page shows milestones (100, 365, 500, 520, 1000, 1314, yearly) but no spec defines the list, custom milestones, or alerts. |
| 16 | **Workdays and weeks** | Events spec §2.1 lists working days, but `UnitMode` is only Auto, Days, Calendar. v2 dropped its Weeks, Hours and Workdays units to match. Add `Workdays` to `UnitMode` (and a holiday set) if wanted. |
| 17 | **Guest export** | Signed-in users are covered by sync. Guests keep data on one device only: offer JSON export and import, and `.ics` import. |
| 18 | **Activity on shared days** | Push is out of scope, so people learn about changes only by opening the app. Show a small "changed by Lin" marker on shared cards until opened. |
| 19 | **Widget configuration** | Choose the day per widget, widget look, hide titles. |
| 20 | **Privacy lock and private days** | Biometric lock; a private flag that hides the title in widgets, notifications and previews. |
| 21 | **Localization** | English, 简体中文, 繁體中文 at least; locale date formats; plural rules. |
| 22 | **Accessibility details** | Cap Dynamic Type growth of the big number, screen-reader labels for live counters that do not announce every second, 44/48 pt targets, reduce motion (also for Live Photos, already in the spec). |
| 23 | **Custom order** | Drag to reorder. Needs `sortOrder` (item 3) or the member overlay (item 10). |

### P2

| # | Item | Why |
| :--- | :--- | :--- |
| 24 | **Range days** | Start and end with progress: pregnancy week 23 of 40, semester 58%. |
| 25 | **Calendar view** | Month view of all days. |
| 26 | **Live Activities and ongoing notifications** | Last 24 hours on the Lock Screen and Dynamic Island; Android equivalent. |
| 27 | **Watch** | Wear OS tile and watchOS complication. |
| 28 | **Comments** | Planned as a later change (design D12). Reuse the memo timeline style with the owner's hide and remove controls. |
| 29 | **Adaptive layout** | Desktop and web apps come later; when they do: list on the left, day page on the right at 840 dp and wider. |
| 30 | **Voice and system actions** | Siri / App Shortcuts and Android App Functions: "How many days until the Norway trip?" |

## 7. Proposed model changes

These are proposals. Following `AGENTS.md`, specs change only once the design is accepted, through an OpenSpec change.

```kotlin
// Event (events spec §3), additions only. emoji, timeZone and unitMode already exist.
val sortOrder: Long = 0,
val reminders: List<Reminder> = emptyList(),
val deletedAt: Instant? = null,
// isPinned: at most one per owner, enforced by PinEventUseCase

// Per member, next to the membership (gap 10): pin, category, reminders, sort order for days shared with you.
data class MemberOverlay(val eventId: String, val isPinned: Boolean, val categoryId: String?, val sortOrder: Long)

// EventCustomization (customization spec §3)
val textColor: TextColorMode = TextColorMode.Auto,   // Auto, Light, Dark; replaces textColorOverride
// dimBackgroundFactor stays, 0.0 to 0.8, shared as backdrop.dim

// BackgroundConfig
data class Photo(..., val focusX: Float = .5f, val focusY: Float = .5f) : BackgroundConfig  // focus point, shared
data class GradientPreset(val presetId: String) : BackgroundConfig                          // the soft mesh presets
// ImagePreset(presetId) covers the Art presets
```

Each gradient and art preset needs a stored base color for auto text color and for the web page while the backdrop loads.

The first revision proposed a blur slider; it was dropped, because the backdrop is now a shared field and the web editor would need it too.

## 8. Notes for the Compose build

- **Fonts:** bundle Geist, Geist Mono, Instrument Serif, Nunito and Oswald as Compose resources. Turn on tabular figures (`fontFeatureSettings = "tnum"`) for every number.
- **Glass:** `Modifier.blur` blurs a composable's own content, not what is behind it. Frosted chips need a backdrop blur (Android `RenderEffect` on 12+, platform effects elsewhere). Below Android 12 use the translucent fill without blur.
- **Mesh gradients:** three `Brush.radialGradient` layers over a solid base color.
- **Live Photos:** play the silent MP4 once with Media3 (Android) or AVPlayer (iOS) over the key photo, then show the key photo; never loop. Skip under reduce motion.
- **Auto contrast for photos:** sample the average luminance of the lower part of the decoded key photo once, store it locally, and raise the default darken value for bright photos.
- **Live ticker:** recompose only the ticker text once a second, not the card.
- **Paywall and sign-in:** use the platforms' own purchase sheet and the official Sign in with Apple and Google buttons; the v2 sheet is the frame around them.

## 9. Revision history

**Revision 2** (aligned with `pluggable-backend-live-sharing`):

- Welcome: Apple, Google and email-code buttons; terms and privacy line. New sign-in prompt sheet with email-code steps.
- Accounts and sync: account button, sync line on Home, Sync in Settings, account section (name, methods, sign out, delete), guest mode in the prototype.
- Plans: Premium badge, paywall sheet with free alternatives, limit-reached sheet, plan meters in Settings, gating on Save and on New day.
- Sharing: public links with labels and expiry, invites with role, use count and expiry, people with roles, remove and allow again, revoke confirm. Removed "Update link" and the "photos are not shared" note. Square export replaced by Banner 1.91:1.
- Shared days: Shared chip, owner name on cards, role-based actions and menus, Shared block on the day page, Leave and Report.
- History sheet with restore.
- Backdrops: Live Photo tiles, Play as Live Photo switch, play-once motion, Live badge, photo usage line. Darken 0 to 80%. Blur removed.
- Event fields: title up to 100, Notes (owner only), time zone (fixed or floating) with local time shown, unit modes Auto, Days, Y·M·D (Weeks, Hours and Workdays removed).
- Audio: Built-in catalog with Premium tracks, My files with trim, Spotify links; local playback settings.
- Memos: owner only, no other authors.
- Gaps list rewritten (section 6).

**Revision 1:** first version of the design, prototype and gap list.

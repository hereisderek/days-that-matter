# Days That Matter: design v2

An interactive prototype of a new UI for Days That Matter, plus the design rules behind it and a list of missing features.

This version was designed from the specs, not from v1. Revision 2 follows the OpenSpec change [`pluggable-backend-live-sharing`](../../openspec/changes/pluggable-backend-live-sharing/) and the feature docs updated with it (accounts, plans, live sharing, backdrops, audio). Where the two disagree, the OpenSpec change wins, as `AGENTS.md` says.

## Open the prototype

```bash
python3 -m http.server 8766 --directory design/v2
```

Then open http://localhost:8766. Opening `index.html` directly from disk also works.

The left panel jumps between screens and switches the theme, the account (Local or Signed in), the plan (Free or Premium), the memo badge position (remote config) and, for offline use, the days on the device, the import choice and its result, the name, the time of day and the heavy-use nudge (section 9). On a phone-width window it becomes a row of tabs and the app fills the screen.

Things to try:

- Swipe the pinned carousel at the top of Home (or tap a dot or the peeking edge). The list below scrolls to the same day and outlines it. Scroll the list yourself and the carousel shrinks to a strip.
- Long-press (or right-click) a card in the list. Owned days offer **Pin to top**; the day joins the carousel first and stays in the list, with Undo. "Grandma's 90th" is shared with you as an editor and offers Edit, History, Report and Leave instead.
- Open a day and tap the big number to cycle **Auto**, **Days**, **Weeks**, **Hours**, **Y·M·D** and **Workdays** ("App launch" counts workdays).
- **New day** opens a chooser: a date, a smart day (days, weekends, public holidays or workdays left this year) or a seasonal template (Halloween is open in October; Christmas opens 1 November).
- Long-press a day and choose **Archive**: it leaves Home (and the carousel, if pinned) and appears under **Archived** at the end of the list.
- **Customize** › Sound › **My library**: pick a new song at the top, reuse an earlier one, or tap × to remove one from the list. Mia's birthday keeps playing its song after you remove it.
- Switch the panel's **Memo badge** between Left and Right (it stands in for remote config). Days with memos show the badge; Grandma's 90th, shared with you, never does.
- **Customize** › Background › Photo: pick a tile marked LIVE. It moves in the preview. On Free, Save shows the paywall with **Use still photo**.
- **Share** on "Norway trip": create a public link with a label and expiry, an invite with a role and use count, change a member's role, remove someone.
- Switch the panel to **Local** and tap Share: the sign-in prompt appears first. In local mode Settings has your name, which the Home greeting uses, and locked online items. Section 9 walks through the offline and import states.
- Settings shows the account, Sync, the plan's limits in use and the notification switches. Create days until the eleventh: the paywall appears (archived days still count).

| File | What it holds |
| :--- | :--- |
| `index.html` | Page shell and font loading |
| `styles.css` | Design tokens (top of file), components, screens |
| `app.js` | Sample data, date math, plan table, screens, interactions |
| `README.md` | This document |

Prototype limits: sample photos are loaded from picsum.photos (Unsplash photos), and their "Live" motion is simulated with a short zoom. The public holiday set is a sample (New Zealand 2026). The QR code is a placeholder pattern. Buttons that would open system UI (file picker, share sheet, store purchase, Spotify) show a short message instead. Sign-in buttons are plain text; production uses Apple's and Google's official button assets.

---

## 1. Direction

The brief: modern, fresh and light (耳目一新, 清新), while every day card can look different.

The design splits the screen into two layers:

- **The app shell is quiet.** Near-white background with a faint green tint, white surfaces, dark ink, one accent color. No gradients or heavy shadows in the shell.
- **The cards carry the color.** Each day has its own photo, Live Photo, color, gradient or art. Because the shell is neutral, a list of very different cards still looks calm.

Principles:

1. **The number leads.** The day count is the largest thing on every card. Labels next to it are short and plain ("days left", "days since").
2. **Pinned days lead.** Any number of owned days can be pinned. They sit in a carousel at the top of Home, one in focus, and stay in the list below.
3. **Same customization everywhere.** Background, card style, typeface, text color, darkness and music work the same way for every day, and the card looks the same in the list, the pinned carousel, the day page, widgets, share images and the web page.
4. **Readable by default.** Text color is chosen from the background automatically. Photos get a dark scrim and a soft gradient behind the text. The editor shows the contrast ratio. The specs require 4.5:1.
5. **Calm about money and accounts.** Local mode (no account) can do everything local without signing in. Paid features can be picked and previewed for free; the paywall appears only on Save and always offers a free way out where one exists.
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

**Layers, bottom to top:** backdrop (photo, Live Photo, color, gradient or art; photos and art can be blurred, `blur` 0 to 16, a shared field) → darken scrim (`dim`, 0 to 80%, a shared field) → legibility gradient (photos only) → grain → memo badge → content.

**Sizes (contexts):**

| Context | Size | Shows |
| :--- | :--- | :--- |
| Pinned (carousel) | full width × 240; minus 52 when several are pinned; 96 tall when collapsed | Pin badge, emoji, title, short date, time and zone, big number, live ticker; collapsed: title and number only |
| List row | full width × 64 / 84 / 132 (size Small / Medium / Large) | Small: emoji, title, number. Medium: adds pin or shared marker, short date and repeat, unit. Large: adds the live ticker, bigger number |
| Grid tile | half width, 1:1.1; Small 1:0.8; Large full width × 196 | Emoji, markers, number, unit, title, date |
| Day page | full screen | Everything, plus the unit switch; Live Photos play here |
| Widget small / medium | 1:1 / 2:1 | Number, unit, title; medium adds the next three days |
| Share story / banner | 9:16 (1080×1920) / 1.91:1 (1200×630) | Emoji, title, number, date, optional watermark "Tracked with Days That Matter" |

**Markers:** a pin icon for pinned days; a people icon for days you share; a people icon and the owner's name ("Mum") for days shared with you.

**Size in the list** (Customize › Style): Small, Medium (default) or Large. It is part of the look, so it syncs and people you share with see the same size in their list. The carousel, day page, widgets, share images and the web page ignore it.

**Memo badge:** an owner's card with memos shows a small accent tab with a memo icon and the count ("9+" above 9). Remote config `ui.memoBadge` picks the position: **left**, hanging from the top edge 24 pt from the left edge, or **right** (default), flush with the right edge 10 pt from the top (72 pt on pinned cards, below the emoji). With the right tab, the list number moves down 6 pt and grid tile markers move in so nothing overlaps. Memos are owner-only, so the badge never shows on days shared with you, on the web, on widgets or on share images.

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

Three floating sample cards, one line of copy and **Get started**, which opens the device-or-account choice (section 9). Revision 5 moved the sign-in buttons and the old "Skip for now" into that choice. The sign-in buttons (**Continue with Apple** (primary on iOS), **Continue with Google**, **Continue with email**) sign in or create an account; there are no passwords. Only the methods the region enables are shown (`GET /config`). Under the buttons: "By continuing you agree to the Terms of Service and Privacy Policy", both linked.

### Sign-in prompt (sheet)

Shown in local mode on Share, Invite, Sync, History, opening an invite, and from the locked rows in Settings (revision 5 removed the prompt after the first saved day; see section 9). Title "Sign in or create an account", one line on why, the sign-in buttons, and **Not now** where the action can wait (not on Share, which needs an account). After signing in, the interrupted action continues; for Share, the share sheet opens with the days already uploading.

Email sign-in is two steps in the same sheet: address, then the 6-digit code ("Valid for 10 minutes", "Send a new code").

### Home

- Header: today's date and a greeting ("Good morning, Sam"; "Your days" when the greeting is off), search, and the account button (initial when signed in). While edits are waiting to sync, the date line reads "Syncing 2 changes…" with a pulsing dot; sync runs on its own within 2 seconds, so this is brief.
- The header and the **pinned carousel** stay at the top; the list scrolls under them (section 5). The carousel shows when at least one owned day is pinned and the setting is on, and is hidden while searching or filtering.
- Filter chips: All, Upcoming, Since, **Shared** (signed in only), **Smart**, then the categories.
- Two sections, **Upcoming** and **Since**, each with a count. The first section header holds the list/grid switch and sort.
- Long-press or right-click a card. Owner: Pin to top / Unpin, Customize, Share, Archive, History, Duplicate, Delete (with Undo). Editor of a shared day: Edit, Share image, Archive, History, Report, Leave. Viewer: Share image, Archive, Report, Leave. Smart days have no Share.
- **Archived · n** row at the end of the list opens the Archived screen. Archiving hides a day from Home, the carousel and widget choices, turns its reminders and notifications off, and **unpins it**; unarchiving does not pin it again. Archive is personal: for a day shared with you it only hides your copy. Archived owned days still count toward the plan's day limit.
- Floating **New day** button opens a chooser: **A date**, **Smart days** (with today's count next to each) and **Seasonal · limited time** (templates outside their window are shown greyed with "Opens Nov 1"). On Free with 10 owned days it opens the paywall instead.
- Local mode does not show days shared with you (they have none) or the Shared chip.

### Day page

- The day's own backdrop fills the screen. Back, music (record for tracks and library songs; Spotify icon for Spotify links, which plays a 30-second preview), share and more buttons sit on glass circles.
- Badge: category and repeat for owned days; owner name and role ("Mum · Editor") for shared days. "Live" badge for animated backdrops.
- Title, full date and time. A fixed zone different from the device's shows both: "9:30 AM Oslo time", then the same moment in the viewer's local time in brackets.
- Tap the number, or use the control under it (it scrolls sideways), to switch **Auto / Days / Weeks / Hours / Y·M·D / Workdays** (`UnitMode`). Auto shows days, then hours and minutes in the last 48 hours. **Workdays** counts Monday to Friday and skips Saturdays and Sundays, for deadlines like "35 workdays to launch"; public holidays are not skipped yet. The choice is a shared field, so viewers do not get the control.
- The live ticker counts to the exact event instant. The big number counts calendar days, so a trip next month at 9:30 can show "38 days" and "37d 23h"; both are correct.
- The sheet below the backdrop:
  - Action buttons by role. Owner: Customize, Share, Music, Memo. Editor: Edit, History, Music, Leave. Viewer: Music, Report, Leave.
  - **Shared** block: for owners, the people and how many public links, with "Manage people and links"; for members, who owns it, how many people, and what their role allows.
  - **Milestones** (countdown progress, or next milestone and anniversary for past days).
  - **Memos**, owner only, labelled "only you".
  - **Details**: date, time, time zone (Fixed or Floating), repeat, music (Spotify adds **Open in Spotify**), archived with **Unarchive**; for owners also reminder, pinned ("Yes, in the carousel"), notes, and a History button.
- **Smart days** show their rule instead of date, time and repeat, the year's progress instead of milestones, the next public holidays for the holiday rule, and no unit control or Share.

### History (sheet)

Owners and editors, signed in. Each revision shows author, time, revision number, and each changed field as old → new. The newest is marked Current; older ones have **Restore**, which adds a new revision. Changes to owner-only fields (notes) appear only for the owner, marked "only you see this".

### Customize

- Sticky preview at the top, with a switch to see the card **Pinned** (or **Large** for shared days), in the **List**, or as a **Widget**. Live Photos move in the preview whatever the plan.
- Tabs:
  - **Details**: title (1 to 100 characters, counter), emoji, date, optional time, **time zone** (this device, the day's own zone, or Floating, with one line on when to use each), repeat. Owner only: category, **Pin to top** (says how many days are already in the carousel), **Notes** (4,000 characters, never shared). Editors see a note that the owner keeps notes, category, pin and memos. Reminder for everyone (proposal).
  - **Background**: Photo (shows "3 of 5 photo backdrops" and the Live Photo plan, upload or samples, LIVE tiles, a **Play as Live Photo** switch, focus point), Color, Gradient, Art. Darken slider 0 to 80%; **Blur** slider 0 to 16 for photos and art. Contrast readout. A note says photos are resized on the phone, location data is removed, and people you share with see them.
  - **Style**: card style with live mini previews, **size in the list** (Small, Medium, Large; the preview switches to the list view), typeface, text color, unit (six choices, with a line on what Workdays means).
  - **Sound**: three sources, one per day.
    - **Built-in**: the catalog with title, artist and length; Premium tracks carry a badge; every track has a preview button.
    - **My library** (Premium to save): **Pick an audio file** stays at the top; a new pick shows a "New" row with a trim bar to choose the part to keep (AAC, at most 4 MB, about 5½ minutes). Below it, **Your library** lists earlier songs, newest first, with length and "used on N days", a preview button, and **×** to remove a song from the list. Removing only hides it: days that use it keep playing it, and it counts toward the 20 songs until no day uses it. Songs play for the owner and members, never on public links.
    - **Spotify**: paste a link or share from Spotify; shows the name and "30-second preview here, full song in Spotify"; Free shows "3 days (1 used)". The in-app preview is an assumption to check against Spotify's rules when building (the Web API stopped returning preview URLs for new apps in November 2024; the embed player still plays previews).
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

The web is **view-only** (decision, 2026-10-12): public link pages show the day live; invite and member links open the app, and in a browser show a page to get the app. There is no sign-in or editing on the web. The share sheet says so.

### Widgets

A home-screen mock with a small and a medium widget, a lock-screen mock with a circular and a rectangular accessory, and a widget look option: Match card, Minimal, Tinted. Live Photos show the key photo.

### Settings

- Signed in: profile (name, email, sign-in methods, plan badge) and **Sync** ("Synced 4 min ago" or "2 changes waiting", **Sync now**; after a manual sync: "Changes sync automatically after each edit"). Local: the "Local · this device only" card with the name field and **Sign in or create an account** (section 9).
- **Plan**: limits in use as meters (Days 9 of 10, Photo backdrops 3 of 5, Spotify days 1 of 3), Live photos and music files as Premium, **Upgrade to Premium** or "Manage in the App Store", **Restore purchases**.
- Appearance, Counting.
- **Notifications**: Reminders (local, set per day, work offline) with the delivery time; **Changes to shared days**; **Added to a day**; **Offers and news** (off by default, at most 2 a month).
- More (Widgets, Recently deleted, Privacy lock, Export for local mode, Language, Terms of Service, Privacy Policy).
- **Account** (signed in): display name, add sign-in method, **Download my data** (emails a download link that works for 30 days), **Sign out** (this device only; warns about unsynced changes), **Delete account** (lists what is deleted; on Premium, says to cancel the subscription in the store first). A line under it: accounts not used for 24 months are deleted after two emails sent 3 months apart, each with a download link.

Items marked **New** were added in this design; where they are specified is listed in section 6.

## 5. Pinned carousel

This matches the "Pinned Hero Carousel" in `docs/features/events/SPEC.md` §4.1 and adds how it behaves.

- **Any number of owned days can be pinned.** Newest pin first. Pinning puts the day at the front of the carousel and centres it; the message says it stays in the list, with Undo.
- **One card in focus.** The centred card is full size. Its neighbours show only a 16 pt edge (26 pt side padding minus a 10 pt gap), scaled to 92% toward the centre and faded to 60%, so you can tell more are there. Swipes snap one card at a time. Dots under the carousel show the count and position; the active dot is a short bar. Tapping a peeking edge or a dot centres that card; tapping the centred card opens the day.
- **Pinned days stay in the list.** They keep their place in Upcoming or Since, with a pin icon.
- **The list follows the carousel.** When the carousel settles on a card, the list scrolls (smooth, 14 pt below its top edge) to that day's row and draws a 2.5 pt accent ring around it, with a short settle animation. The ring stays while that card is centred. If the row cannot reach the top (end of the list), the list stops at its end with the row visible. Under reduce motion the list jumps instead of scrolling.
- **Layout.** Header and carousel are fixed at the top of Home; only the list scrolls, so the carousel stays in view while the list moves. When the user scrolls the list down, the carousel collapses to a 96 pt strip (title and number) and expands again at the top of the list. The scroll that follows a swipe does not collapse it.
- Hidden while searching or filtering. Settings › **Pinned carousel** turns it off; pins then show only as icons in the list.
- Pin state is an owner-only field (event-sync spec), so members cannot pin a day shared with them. See gap 10.
- Order comes from the owner-only field `pinnedAt`, newest first.
- Archiving a pinned day unpins it.

## 6. Missing functionality and recommended additions

Compared against `openspec/changes/pluggable-backend-live-sharing/`, `openspec/changes/design-v2-features/`, `docs/features/` and `docs/SPEC.md`. P0 means the UI depends on it or the first release would feel incomplete without it.

Now specified, so removed from this list: Premium and promotions, sharing with roles and live updates, photo limits, time zone, emoji and unit fields, sign-in methods, notifications (reminders, shared changes, added to a day, offers), pin order (`pinnedAt`), archive, the six unit modes including Workdays, card size, blur, memo badge, the audio library, inactive accounts and data export, the storage report, and the read-only web.

### Decisions still open

| Item | Status |
| :--- | :--- |
| **Inactive account period** | 24 months is a placeholder in the specs and in Settings. Confirm the number, and what happens when the warning emails bounce (proposal: keep the schedule). |
| **Spotify preview** | Assumed from use of Spotify. Check at implementation: the Web API no longer returns `preview_url` for new apps (since November 2024); the embed player plays previews for listeners who are not logged in. Fallback: open in Spotify only. |
| **Add people by name** | Under consideration: add someone you already share a day with to another day by typing their name; they get an "added to a day" notification. Not specified. |
| **Push delivery** | Whether Cloudflare Workers can call APNs (HTTP/2) directly needs a spike; the alternative is FCM for both platforms. China has no FCM. |
| **Smart days** | Draft. Open: where holiday sets come from per region, whether smart days can be shared later, and how seasonal windows are managed. |

### P0

| # | Item | Why | Touches |
| :--- | :--- | :--- | :--- |
| 1 | **Fields still missing on `Event`** | `sortOrder` (the spec promises custom order) and `deletedAt` for an owner-side trash. | Events spec §3, Room, sync |
| 2 | **Category model** | `Event.categoryId` exists, `Category` does not (name, emoji, color, order, built-in vs custom), and there is no screen to manage them. | Events spec |
| 3 | **App settings spec** | Account and notifications are now specified. Theme, accent, counting rules, widgets, language and data are not. | New spec section |
| 4 | **"Count the first day as Day 1"** | Couples and streak counters expect "Day 1" on the start date (在一起第 N 天). Changes the number and milestones, so it belongs in the shared engine in `:core:model`. | Events spec §2 |
| 5 | **Undo and Recently deleted** | The sync spec defines what deletion does to other people, not how an owner recovers from a mistake. Keep deleted days 30 days and offer Undo. | Events spec, BACKEND.md |
| 6 | **When a one-time day passes** | Archive now exists. On the day after a one-time day, ask once: keep counting up, archive, or repeat yearly. | Events spec §2.2 |
| 7 | **Empty, loading, error and offline states in the app** | Web page states and link errors are specified; app screens are not. v2 shows Home empty and no-results, Archived empty and the sync line. | All feature specs |
| 8 | **Member-side pin and category** | Archive is now personal for members, but pin and category are still owner-only, so a member cannot pin or file a shared day. Store them next to the membership, like archive. | event-sync, event-sharing specs |
| 9 | **Paywall content and store rules** | Prices, trial or no trial, and the subscription terms Apple and Google require near the buy button. | premium spec, `docs/legal/` |
| 10 | **Conflict message** | The sync spec says the app tells the owner when an offline edit replaced someone else's newer change. Proposed pattern: a toast "Your change replaced Lin's time" with **View history**. | event-sync spec |

### P1

| # | Item | Why |
| :--- | :--- | :--- |
| 11 | **Lunar calendar dates (农历)** | Many Chinese users keep birthdays and festivals on lunar dates. Needs "repeats yearly on the lunar date" and a lunar date picker, in the shared engine. |
| 12 | **Holiday sets per region** | Smart days and Workdays both need real public holiday data per region (and Chinese festivals and solar terms, 节气). Workdays could then skip holidays. |
| 13 | **Milestone model** | The day page shows milestones (100, 365, 500, 520, 1000, 1314, yearly) but no spec defines the list, custom milestones, or alerts. |
| 14 | **Local export** | Signed-in users can download their data. Local mode keeps data on one device only: offer JSON export and import, and `.ics` import. |
| 15 | **"Changed by" marker** | Push covers changes to shared days, but people who turn it off need a small "changed by Lin" marker on the card until they open it. |
| 16 | **Widget configuration** | Choose the day per widget, widget look, hide titles. |
| 17 | **Privacy lock and private days** | Biometric lock; a private flag that hides the title in widgets, notifications and previews. |
| 18 | **Localization** | English, 简体中文, 繁體中文 at least; locale date formats; plural rules. |
| 19 | **Accessibility details** | Cap Dynamic Type growth of the big number, screen-reader labels for live counters that do not announce every second, 44/48 pt targets, reduce motion. |
| 20 | **Custom order** | Drag to reorder. Needs `sortOrder` (item 1). |

### P2

| # | Item | Why |
| :--- | :--- | :--- |
| 21 | **Range days** | Start and end with progress: pregnancy week 23 of 40, semester 58%. |
| 22 | **Calendar view** | Month view of all days. |
| 23 | **Live Activities and ongoing notifications** | Last 24 hours on the Lock Screen and Dynamic Island; Android equivalent. |
| 24 | **Watch** | Wear OS tile and watchOS complication. |
| 25 | **Comments** | Planned as a later change (design D12). Reuse the memo timeline style with the owner's hide and remove controls. |
| 26 | **Adaptive layout** | Desktop and web apps come later; when they do: list on the left, day page on the right at 840 dp and wider. |
| 27 | **Voice and system actions** | Siri / App Shortcuts and Android App Functions: "How many days until the Norway trip?" |

## 7. Model changes

Specified now (see `docs/features/events/SPEC.md`, `docs/features/customization/SPEC.md`, `docs/features/media/SPEC.md` and the two OpenSpec changes): `UnitMode { Auto, Days, Weeks, Hours, Calendar, Workdays }`; owner-only `pinnedAt` and `archivedAt` (members keep archive on their membership); `CardSize { Small, Medium, Large }`; `backdrop.blur` 0 to 16; the custom audio library; smart days as a draft (`Event.kind = Date | Smart(ruleId)`).

Still proposals:

```kotlin
// Event (events spec §3)
val sortOrder: Long = 0,
val deletedAt: Instant? = null,

// Next to the membership (gap 8), like archive: pin and category for days shared with you.

// EventCustomization (customization spec §3)
val textColor: TextColorMode = TextColorMode.Auto,   // Auto, Light, Dark; replaces textColorOverride

// BackgroundConfig
data class Photo(..., val focusX: Float = .5f, val focusY: Float = .5f) : BackgroundConfig  // focus point, shared
data class GradientPreset(val presetId: String) : BackgroundConfig                          // the soft mesh presets
// ImagePreset(presetId) covers the Art presets
```

Each gradient and art preset needs a stored base color for auto text color and for the web page while the backdrop loads.

## 8. Notes for the Compose build

- **Fonts:** bundle Geist, Geist Mono, Instrument Serif, Nunito and Oswald as Compose resources. Turn on tabular figures (`fontFeatureSettings = "tnum"`) for every number.
- **Glass:** `Modifier.blur` blurs a composable's own content, not what is behind it. Frosted chips need a backdrop blur (Android `RenderEffect` on 12+, platform effects elsewhere). Below Android 12 use the translucent fill without blur.
- **Backdrop blur:** `Modifier.blur(radius)` on the backdrop image on Android 12+; below that, draw a downscaled, pre-blurred bitmap. Scale the radius with the card width (16 at 390 pt).
- **Mesh gradients:** three `Brush.radialGradient` layers over a solid base color.
- **Live Photos:** play the silent MP4 once with Media3 (Android) or AVPlayer (iOS) over the key photo, then show the key photo; never loop. Skip under reduce motion.
- **Auto contrast for photos:** sample the average luminance of the lower part of the decoded key photo once, store it locally, and raise the default darken value for bright photos.
- **Live ticker:** recompose only the ticker text once a second, not the card.
- **Pinned carousel:** `HorizontalPager` with `contentPadding = PaddingValues(horizontal = 26.dp)` and `pageSpacing = 10.dp`; scale and alpha from `currentPageOffsetFraction` in `graphicsLayer`, with the transform origin on the side facing the centre. Follow the list with `snapshotFlow { pagerState.settledPage }` → `listState.animateScrollToItem(index, scrollOffset)`. Collapse the pager when `listState.firstVisibleItemScrollOffset` passes 24 dp, ignoring scrolls started by the follow.
- **Paywall and sign-in:** use the platforms' own purchase sheet and the official Sign in with Apple and Google buttons; the v2 sheet is the frame around them.

## 9. Offline use and importing local days

Added in revision 5 of this document, from the owner's requirement "support offline usage". The prototype shows every state; the panel on the left (section "Open the prototype") reaches each one. Onboarding itself is built later; only the first-launch choice screen is drawn here. Nothing in `docs/`, `openspec/` or the app was changed.

### 9.1 The model in one paragraph

Without an account the app is in **local mode** (this replaces "guest"). Local mode is a full, offline app for the user's own days: customize, widgets, reminders, memos. It has no online features (sync, sharing, links, invites, history, restore) and it follows the same plan limits as an account (10 days, 5 photo backdrops and so on, Premium features still Premium), so a user who signs in later is never over the limits because of what they did offline. Each signed-in account has its own database on the device and local mode has one more; **nothing is copied between them except by an explicit, confirmed import**. The name in Settings is stored on the device and drives the Home greeting.

### 9.2 Screens and states

| # | Screen | What it shows | Prototype |
| :--- | :--- | :--- | :--- |
| 1 | **First-launch choice** (new, step 2 of onboarding, after Welcome) | "Where should your days live?" Two cards of equal size and weight, each with a full-width primary button: **Use on this device** (no account; all your own days, looks, widgets and reminders; works offline; "Good to know": no sharing, sync, history or invites, and Premium features and plan limits still apply, so moving to an account never goes over them) and **Sign in or create an account** (sharing, sync, history, backup; "Free to start. No password."). Terms line applies to the account path only. | Panel › Device or account |
| 2 | **Settings, local mode** | A "Local · this device only" card, **Your name** (optional field, stays on the device), an info block explaining local mode, **Sign in or create an account** (accent button), then a **Needs an account** group (Sync, Sharing and invites, History and restore, Backup) with lock icons. Tapping one opens the sign-in prompt with a matching reason, the same behavior Share and Sync have for guests today. Plan meters stay, with a line saying limits are the same as an account's. | Account › Local, then Settings |
| 3 | **Home greeting** | The h1 becomes "Good morning, Sam". Morning 05:00 to 11:59, afternoon 12:00 to 16:59, evening 17:00 to 21:59, late night 22:00 to 04:59 ("Still up, Sam?"). No name: "Good morning" / "Still up?". Signed in: the account display name. The date line, search and account button stay. Long names wrap to two lines and then end with an ellipsis; emoji names are fine. Settings › Appearance › **Greeting on Home** turns it off (back to "Your days"). | Panel › Name, Time of day |
| 4 | **Heavy-use nudge** (sheet) | "Your days deserve a backup". Counts what is on the phone ("4 days and 3 memos"), four benefits (sharing, sync, history and restore, backup), **Sign in or create an account**, **Not now**, and "We won't ask again for a month." | Panel › Heavy-use nudge: Show |
| 5 | **Import prompt** (sheet, right after sign-in) | "Import this phone's days?", "Found 4 days and 3 memos kept on this device", the first three days listed, a paragraph saying import is permanent, that the days leave local mode on this phone, and that nothing is imported if the user says not now. If the import takes a Free account above 10 days, an info line says so and that nothing is deleted. **Import 4 days…** (primary) and **Not now, keep on this device**. | Panel › Import choice › Not yet |
| 5b | **Confirm** (second sheet) | "This can't be undone". Import 4 days and 3 memos into the account email? Saved to the account and synced; removed from local mode on this phone, and signing out will not bring them back; can't be moved back. **Yes, import 4 days**, **Go back**. | Import › Import 4 days… |
| 5c | **Success** | "4 days imported", "3 memos came with them", they are in the account and on other devices, no longer in local mode. **Done**. | Confirm › Yes |
| 5d | **Partial or failed** | "3 of 4 days imported". The one that failed stays on the phone, safe and unchanged; the others are in the account for good. **Try again**, **Keep it on this device for now**. Import is per day: each day moves whole or stays. | Panel › Import result › Partial |
| 6 | **After "Not now"** | Signed-in Home shows only the account's days. Settings has **On this device › Import days from this device** with the count ("4 days and 3 memos kept on this phone, not in your account"). It opens the same sheets as 5 and 5b. When all days are imported the group disappears. | Panel › Import choice › Skipped |
| 7 | **Sign out** | Confirmation "Sign out and use this device only?": back to local mode, where only the days kept on this phone (never imported ones) are shown; account days, including imported ones, stay in the account. After confirming the app opens Home in local mode with the local greeting. | Settings › Sign out |

Panel switches added for review: **Account** (Local, Signed in), **Days on device** (None, Some), **Import choice** (Not yet, Imported, Skipped), **Import result** (All, Partial), **Name** (Short, Long, Emoji, None), **Time of day** (Now, Morning, Afternoon, Evening, Late) and **Heavy-use nudge › Show**. "Not yet" signs in if needed and opens the import prompt; "Imported" runs the import; "Skipped" closes it. The prototype starts signed in with 4 local days and "Skipped", so the account Home, the local Home and the Settings import row can all be compared at once. Tapping outside an import sheet is "Not now"; tapping outside the nudge is "Not now".

### 9.3 Copy

| Where | Text |
| :--- | :--- |
| Choice, device card | **Use on this device** · No account. Nothing leaves your phone. · "All your own days, looks, widgets and reminders" · "Works offline, no sign-in" · *Good to know.* Sharing, sync, history and invites need an account. Premium features and the plan's limits apply here too, so moving to an account later never goes over them. |
| Choice, account card | **Sign in or create an account** · Free to start. No password. · "Share days with people you choose" · "Sync across all your devices" · "History, restore and backup" |
| Settings, local | **Local · this device only** · No account. Your days stay on this phone. · **Your name** Optional. Used in greetings. Stays on this device. · *Local mode.* Everything about your own days works here, offline. Sharing, sync, history and invites need an account. Premium features and the plan's limits still apply, so signing in later never goes over them. |
| Nudge | **Your days deserve a backup** · You are keeping 4 days and 3 memos on this phone. An account adds: · Sharing with the people you choose · Sync across your devices · History, so any change can be restored · A backup if this phone is lost · [Sign in or create an account] [Not now] · Your days stay on this phone until you decide to import them. We won't ask again for a month. |
| Import prompt | **Import this phone's days?** Found 4 days and 3 memos kept on this device. Importing moves them into your account, so they sync to your other devices. It is permanent: they leave local mode on this phone and can't be moved back. If you choose not now, nothing is imported. [Import 4 days…] [Not now, keep on this device] They stay here and are not shown in your account. You can import them later from Settings. |
| Confirm | **This can't be undone** · Import 4 days and 3 memos into alex@example.com? · They are saved to your account and sync to your other devices. · They are removed from local mode on this phone. Signing out later will not bring them back here. · You can't move them back. Delete or edit them in your account as you would any day. · [Yes, import 4 days] [Go back] |
| Partial | **3 of 4 days imported** · First 5K couldn't be imported. The connection dropped. 1 day stayed on this phone, safe and unchanged. The others are in your account for good. · [Try again] [Keep it on this device for now] |
| Sign out | **Sign out and use this device only?** You will go back to local mode, where you see only the days kept on this phone (4 days). Days in your account, including any you imported, stay in your account and won't show here. Other devices stay signed in. |

The owner's draft "found local event, want to import?" became a sheet title that names the device ("Import this phone's days?") and a first line that gives the counts. "Phone" is the word for the app on iOS and Android; a tablet build would say "device". The confirmation is its own sheet so the irreversible part gets a full screen of attention, and its button repeats the number ("Yes, import 4 days") instead of "OK".

### 9.4 Proposed rules (the product owner decides)

**What counts as heavy use** (local mode only; days the user made, not seasonal or smart templates they did not edit): any one of

- 12 or more days **and** 14 or more days since first launch (the user came back, not one long first evening), or
- 25 or more days, or
- 20 or more memos.

**When it may appear:** only on Home, at app start or when coming back from a Save; never inside an editor, a sheet or a day page; never in the first 7 days; never while a sign-in is in progress.

**How often it may reappear:**

- At most once in 30 days.
- After **Not now** twice it stops for good. The second "Not now" says so: "OK. We won't ask again. It's in Settings if you change your mind." Settings keeps the **Sign in or create an account** button, so nothing is lost.
- Closing the sheet any other way (tap outside, back) counts as Not now.
- Signing in ends it. Signing out later starts the counters from zero.
- It never blocks anything and has no countdown.

**Import prompt rules:** asked right after every sign-in while local days exist, unless the user chose "Not now" earlier on this device (then only the Settings row is shown, so the prompt does not nag at every sign-in). If more local days appear later (the user signed out and made more), the Settings row shows the new count and the prompt returns once. Import is per day and atomic per day; failed days stay local.

### 9.5 Acceptance checks (walk through in the prototype)

Start with **Reset demo**.

| # | Check | Steps | Expect |
| :--- | :--- | :--- | :--- |
| Y1 | **Yes: the records go to the account** | Panel › Import choice › **Not yet**. Tap **Import 4 days…**, then **Yes, import 4 days**. | Success sheet "4 days imported". Account Home now lists Japan 2027, Dad's retirement party, Sourdough starter and First 5K with the other days; the date line reads "Syncing 4 changes…". Settings has no import group. Another device signed in to the account would pull them (stand-in: switch Account to Local and back to Signed in; the days are still there). Build check: the backend holds 4 events owned by this account and memos with them. |
| Y2 | **Yes: local mode no longer has them** | After Y1, panel Account › **Local**. | Home shows the empty state ("Nothing here yet"); panel "Days on device" reads None; Settings has no import row. Build check: the local database has no rows for those ids. |
| N1 | **No: signed-in user does not see local days** | Panel › Import choice › **Not yet**, then **Not now, keep on this device**. | Account Home shows only the account's days (no Japan 2027). Settings has **On this device › Import days from this device** with 4. |
| N2 | **No: local days are visible in local mode** | After N1, panel Account › **Local**. | Home lists the 4 local days (Japan 2027 pinned in the carousel), greeting uses the local name. |
| N3 | **Import later from Settings** | After N1, Settings › **Import days from this device**. | Same prompt, same confirm, same success as at sign-in; afterwards the row disappears. |
| S1 | **Sign out** | Signed in, Settings › **Sign out**. | The sheet explains local mode; after "Sign out" Home shows only the local days and the local greeting; imported days are not there. |
| P1 | **Partial import** | Panel › Import result › **Partial**, then run Y1. | "3 of 4 days imported" naming First 5K. **Try again** gives "4 days imported". Settings (before retrying, via "Keep it on this device for now") still shows the row with 1. |
| G1 | **Greeting** | Panel › Name and Time of day. | Short, long (two lines, ellipsis), emoji and empty names; four times of day; works in Local and Signed in; switch off in Settings › Appearance. |
| H1 | **Nudge** | Panel › Heavy-use nudge › Show. Tap **Not now** twice. | The second time the toast says it won't ask again. **Sign in or create an account** opens the usual sign-in sheet. |
| C1 | **Choice screen** | Panel › Device or account. | **Use on this device** opens local Home; **Sign in or create an account** opens the sign-in sheet and, after signing in, the import prompt if local days exist. |

### 9.6 What changes compared with today

| Topic | Today (revision 4, auth spec, accounts spec) | Now |
| :--- | :--- | :--- |
| Name | "Guest" | **Local** (prototype, notes). The enum `AuthState.Guest` would become a local state; naming is the owner's call. |
| Welcome | Three sign-in buttons and "Skip for now" | Welcome has **Get started**; the next screen is the device-or-account choice. Both options are equal. |
| First saved day | Sign-in prompt once after the first save | Removed. The heavy-use nudge replaces it, later and less often. |
| First sign-in | Local days upload automatically; both sets kept | Nothing uploads by itself. The user is asked, confirms, and the move is permanent. |
| Local data after sign-in | Same data set, now synced | Separate databases. Local days stay in local mode unless imported. |
| Sign out | Days stay on the phone, you become a guest with the same days | Return to local mode with only the local days; the account's days are not shown. |
| Settings (no account) | "Guest · Saved on this device only" and Sign in | Local card, name field, explanation, Sign in or create an account, locked online items. |
| Home header | "Your days" | Greeting (can be turned off). |
| Plan limits | Apply to guests | Unchanged; an import may take an account above its limit (nothing deleted), as the premium spec already allows. |

### 9.7 Conflicts with existing specs and the built backend (listed, not resolved)

1. **Accounts spec, "First sign-in uploads local data"** (and its scenario of 4 local + 2 account = 6): requires automatic upload and no choice. The new requirement makes it an explicit, permanent import.
2. **Auth feature spec**, section 2 item 8 ("First sign-in on a device") says the same; section 4.1 "Skip for now (Continue as Guest)", `AuthState.Guest` and the word "guest" throughout.
3. **Accounts spec and auth spec 4.2 / 2.1, "prompt once after the first saved event"**: removed in this design.
4. **Accounts spec, Sessions** ("signing out ... SHALL keep the device's data until the user removes it") and auth spec 4.3 "Sign Out": under separate databases the account's cached days are not shown after sign-out; whether they stay on disk is undecided (open question 4).
5. **Built backend, first sign-in upload exception**: `backend/core/src/http/sync.ts` (`FIRST_UPLOAD_WINDOW_SECONDS` = 86,400, `FIRST_UPLOADS_PER_SESSION` = 500, query `?firstUpload=1&createdAt=`), the store port's `firstUpload` option with the `first_upload_at` marker, and the tests `test/sync/first-upload.test.ts` and `conformance.ts`. The exception lets the first upload exceed the plan's owned-event limit only for a session younger than 24 hours. An import chosen later from Settings can come days afterwards, so the window does not fit; the 500 cap and the "createdAt before session" rule also assume an automatic upload. The exception probably needs to be tied to an explicit import request instead of the session age.
6. **Premium spec, "Guest data above the free limit"** (14 events kept, creating a new one shows the paywall): still true for imports, but it is worded for automatic upload of "local and account events".
7. **Premium spec, "Guest buys, then signs in"**: still valid, but the plan is now bought in local mode and moves to an account on sign-in while the days do not; worth a scenario.
8. **To check by whoever builds it** (not read for this task): `docs/architecture/PERSISTENCE_AND_SYNC.md` and the events spec probably describe one Room database; this requirement needs one per signed-in account plus one for local mode, and widgets, reminders and notifications must follow whichever is active. `docs/legal/` (AGENTS.md rule 8) may need a line on what is kept on the device without an account.

### 9.8 Open questions for the owner

1. **Heavy-use thresholds and frequency** in 9.4: are 12 days / 14 days / 25 days / 20 memos and "once a month, stop after two Not nows" right?
2. **Re-asking after "Not now":** this design asks once per device and then only shows the Settings row. Or ask at every sign-in?
3. **Choose which days to import?** Now it is all or nothing (only errors split it). A selection list is a small addition.
4. **Sign out:** keep the account's cached days on the phone (fast sign-in, offline) or remove them? Removing is the safer privacy default, and the sign-out sheet would then say so.
5. **Name at first launch:** the name is asked for only in Settings. Ask on the choice screen too? Should the account's display name start from the local name when signing in?
6. **Greeting wording:** "Good morning, Sam" and the late-night "Still up, Sam?" are proposals; also needed in Chinese and other languages.
7. **Local backup:** with no account, a phone loss loses everything. The nudge says so; a JSON export (gap 14) is now more important and could be offered next to the nudge.
8. **Sign-in prompt for locked Settings rows** reuses the existing sheet. A short "what you get" version of it could replace it for non-Share rows.
9. **Imported days over the Free limit:** kept in full, creating a new day shows the paywall (premium spec). Is a softer note at import time (as drawn) enough?
10. **Revision number:** the request said "revision 3"; this README already has revisions 1 to 4, so this is revision 5.

### 9.9 Components

No new colors, fonts or component styles. `.choice` (the two onboarding cards) is a `.block` with a header row, the `.benefits` list and a `.btn`; it exists as a class only because the existing `.block` has no inner header row. The import and nudge sheets use `.sheet`, `.benefits`, `.form-card`, `.lrow`, `.info`, `.empty` and `.btn`. The greeting is the existing `.h1` at 28 px (one step under the 32 px title). Added CSS is one block at the end of `styles.css`; it uses existing tokens and sizes only.

### 9.10 Screenshots

All in `offline-accounts/`, light and dark, named `<number>-<screen>-<state>-<light|dark>.png`.

## 10. Revision history

**Revision 5:** offline use and importing local days.

- New section 9 with the model, screens, copy, proposed rules, acceptance checks, conflicts with the specs and the built backend, and open questions.
- First-launch choice screen (device or account), local-mode Settings (name, locked online items), Home greeting, heavy-use nudge, import prompt with confirmation, success and partial states, Settings import row, sign-out back to local mode.
- Panel: Account is now Local or Signed in; added Days on device, Import choice, Import result, Name, Time of day and the nudge button.
- Welcome has **Get started** instead of the sign-in buttons and "Skip for now". The sign-in prompt after the first saved day is gone.
- "Guest" renamed "Local" (list in 9.6 and the next bullet). Renamed in: panel Account switch, Settings card, toast on starting local use, sign-out toast and sheet, Welcome hint in the panel, `ACT.guest` (now `local-start`), and README lines on the panel, sign-in prompt, Home, Settings, More, gap 14 and revision 2.

**Revision 4:**

- Sound: "My files" is now **My library**: pick at the top, earlier songs below with "used on N days", × removes a song from the list while days keep playing it.
- Spotify links play a 30-second preview in the app (assumption to check), with **Open in Spotify** for the full song.
- **Archive**: menu item for every role, Archived row and screen, archiving unpins.
- **Blur** is back (shared field, 0 to 16). Revision 2 removed it because the web editor would also have needed it; the web is now view-only, so that cost is gone.
- **Weeks, Hours and Workdays** are back next to Auto, Days and Y·M·D, with a line explaining Workdays.
- **Size in the list**: Small, Medium, Large.
- **Memo badge** on owners' cards, position from remote config.
- **Notifications** settings (reminders, shared changes, added to a day, offers), **Download my data**, and the inactive-account line in Settings.
- **New day** chooser with smart days and seasonal templates.
- Share sheet says the web is view-only.
- Seed data: two days removed so the Free demo stays under 10 owned days.


**Revision 3:**

- Several pinned days in a carousel instead of one: centre card in focus, neighbours show a 16 pt edge, dots, tap to centre or open.
- Pinned days stay in the list. Swiping the carousel scrolls the list to that day and outlines it.
- Home layout: header and carousel fixed, list scrolls under them; the carousel collapses to a strip while the list is scrolled.
- Removed the single-pin rule, so the design matches the events spec's carousel. Gap 2 is now pin order.


**Revision 2** (aligned with `pluggable-backend-live-sharing`):

- Welcome: Apple, Google and email-code buttons; terms and privacy line. New sign-in prompt sheet with email-code steps.
- Accounts and sync: account button, sync line on Home, Sync in Settings, account section (name, methods, sign out, delete), guest mode in the prototype (renamed Local in revision 5).
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

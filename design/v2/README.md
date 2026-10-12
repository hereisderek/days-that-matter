# Days That Matter: design v2

An interactive prototype of a new UI for Days That Matter, plus the design rules behind it and a list of missing features.

This version was designed from the specs, not from v1. Revision 2 follows the OpenSpec change [`pluggable-backend-live-sharing`](../../openspec/changes/pluggable-backend-live-sharing/) and the feature docs updated with it (accounts, plans, live sharing, backdrops, audio). Where the two disagree, the OpenSpec change wins, as `AGENTS.md` says.

## Open the prototype

```bash
python3 -m http.server 8766 --directory design/v2
```

Then open http://localhost:8766. Opening `index.html` directly from disk also works.

The left panel jumps between screens and switches the theme, the account (Guest or Signed in), the plan (Free or Premium) and the memo badge position (remote config). On a phone-width window it becomes a row of tabs and the app fills the screen.

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
- Switch the panel to **Guest** and tap Share: the sign-in prompt appears first. Create a day as a guest: the prompt appears once after the first save.
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

Three floating sample cards, one line of copy, then **Continue with Apple** (primary on iOS), **Continue with Google**, **Continue with email**, and **Skip for now**. The same buttons sign in or create an account; there are no passwords. Only the methods the region enables are shown (`GET /config`). Under the buttons: "By continuing you agree to the Terms of Service and Privacy Policy", both linked.

### Sign-in prompt (sheet)

Shown to guests on Share, Invite, Sync, opening an invite, and once after the first saved day. Title "Sign in or create an account", one line on why, the sign-in buttons, and **Not now** where the action can wait (not on Share, which needs an account). After signing in, the interrupted action continues; for Share, the share sheet opens with the days already uploading.

Email sign-in is two steps in the same sheet: address, then the 6-digit code ("Valid for 10 minutes", "Send a new code").

### Home

- Header: today's date and "Your days", search, and the account button (initial when signed in). While edits are waiting to sync, the date line reads "Syncing 2 changes…" with a pulsing dot; sync runs on its own within 2 seconds, so this is brief.
- The header and the **pinned carousel** stay at the top; the list scrolls under them (section 5). The carousel shows when at least one owned day is pinned and the setting is on, and is hidden while searching or filtering.
- Filter chips: All, Upcoming, Since, **Shared** (signed in only), **Smart**, then the categories.
- Two sections, **Upcoming** and **Since**, each with a count. The first section header holds the list/grid switch and sort.
- Long-press or right-click a card. Owner: Pin to top / Unpin, Customize, Share, Archive, History, Duplicate, Delete (with Undo). Editor of a shared day: Edit, Share image, Archive, History, Report, Leave. Viewer: Share image, Archive, Report, Leave. Smart days have no Share.
- **Archived · n** row at the end of the list opens the Archived screen. Archiving hides a day from Home, the carousel and widget choices, turns its reminders and notifications off, and **unpins it**; unarchiving does not pin it again. Archive is personal: for a day shared with you it only hides your copy. Archived owned days still count toward the plan's day limit.
- Floating **New day** button opens a chooser: **A date**, **Smart days** (with today's count next to each) and **Seasonal · limited time** (templates outside their window are shown greyed with "Opens Nov 1"). On Free with 10 owned days it opens the paywall instead.
- Guests do not see days shared with them (they have none) or the Shared chip.

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

- Signed in: profile (name, email, sign-in methods, plan badge) and **Sync** ("Synced 4 min ago" or "2 changes waiting", **Sync now**; after a manual sync: "Changes sync automatically after each edit"). Guest: "Saved on this device only" with **Sign in**.
- **Plan**: limits in use as meters (Days 9 of 10, Photo backdrops 3 of 5, Spotify days 1 of 3), Live photos and music files as Premium, **Upgrade to Premium** or "Manage in the App Store", **Restore purchases**.
- Appearance, Counting.
- **Notifications**: Reminders (local, set per day, work offline) with the delivery time; **Changes to shared days**; **Added to a day**; **Offers and news** (off by default, at most 2 a month).
- More (Widgets, Recently deleted, Privacy lock, Export for guests, Language, Terms of Service, Privacy Policy).
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
| 14 | **Guest export** | Signed-in users can download their data. Guests keep data on one device only: offer JSON export and import, and `.ics` import. |
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

## 9. Revision history

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

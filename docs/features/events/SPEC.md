# Feature Specification: Event Tracking & Countdown Engine

## 1. Overview & Goals
The core heart of "Days That Matter". Calculates high-precision countdowns and count-ups for life events, supporting multiple display units, recurring schedules, and smart categorization.

---

## 2. Countdown Calculation Engine

### 2.1 Precision & Unit Modes
The engine uses `kotlinx-datetime` and computes time relative to the event's time zone (section 2.4). Each day has one unit mode (`unitMode`, a shared field; owners and editors change it, viewers cannot). Requirements: the [`countdown-units`](../../../openspec/changes/design-v2-features/specs/countdown-units/spec.md) spec of the change `design-v2-features`.

| Mode | API value | Shows |
| :--- | :--- | :--- |
| Auto (default) | `auto` | Days; hours and minutes when less than 48 hours remain |
| Days | `days` | Total days ("1,248 days") |
| Weeks | `weeks` | Weeks and days ("22 w 4 d") |
| Hours | `hours` | Whole hours to the exact time |
| Calendar, shown "Y·M·D" | `calendar` | Years, months and days ("3 years, 4 months, 12 days") |
| Workdays | `workdays` | Monday to Friday only |

- **Workdays:** Saturdays and Sundays are skipped. Countdowns count the days after today up to and including the target day. Count-ups count from the day after the start up to and including today. Public holidays are not skipped yet; region holiday sets come later (section 6). Typical uses: deadlines ("35 workdays to launch"), leave and retirement countdowns.
- The engine in `:core:model` computes every mode, and the countdown test vectors cover every mode, so the share page shows the same numbers.

### 2.2 Past vs. Future Events
- **Future Events (Countdowns):** Displays "X days until [Event Title]". Shows positive countdown values.
- **Past Events (Anniversaries / Count-ups):** Displays "X days since [Event Title]".
- **Day of Event:** Emphasizes celebratory state ("Today is [Event Title]! 🎉") with optional confetti animation.

### 2.3 Recurrence Rules
- **Annual:** Automatically advances target date to the next occurrence once passed (e.g., Birthdays, Wedding Anniversaries, New Year). Retains original anchor year to display milestone anniversary count (e.g., "5th Anniversary"). A Feb 29 date falls on Feb 28 in other years and on Feb 29 again in leap years.
- **Monthly:** Advances to the same day next month (with leap year / end-of-month clamping, e.g. Jan 31 &rarr; Feb 28). The anchor day stays: Jan 31 &rarr; Feb 28 &rarr; Mar 31.
- **Weekly / Custom Cadence:** Repeats every 7 days (weekly) or every N days (custom, 1 to 3,650), counted from the target date.
- A repeating day counts to its first occurrence on or after today's date in its zone. The occurrence stays "today" for the whole day, also after its time has passed, and moves on the next day.

### 2.4 Time Zones
- `timeZone` is an IANA zone id or null.
- A fixed zone means every viewer sees the same instant (a flight, a launch). New events default to the device's zone.
- Null means "floating": the viewer's local zone is used (New Year, birthdays).
- An event with no `targetTime` counts to 00:00 in its zone.
- The engine lives in `:core:model`, so the app and the backend compute the same result. The share page's `countdown.js` is checked against test vectors generated from this engine (`./gradlew :core:model:generateCountdownVectors` writes `backend/core/web/test/countdown-vectors.json`; `checkCountdownVectors` fails when the committed file is out of date).
- A local time in a DST gap moves forward by the length of the gap (02:30 on a spring-forward night is 03:30). An ambiguous time in a DST overlap takes the earlier instant.

### 2.5 Calculation Rules
Implemented by `CountdownEngine` in `:core:model` (package `dev.derek.daysthatmatter.core.model.countdown`).
- **Totals** (days, hours, minutes, seconds) are the real elapsed time between now and the target instant, rounded down. Days and Weeks count whole 24-hour periods: a date-only day 38 hours and 30 minutes away shows 1 day in Days, 38 in Hours, and 38 h 30 min in Auto. Across a DST change, 2 calendar days can be 47 or 49 hours.
- **Calendar breakdown** (years, months, days, then hours, minutes, seconds) uses wall-clock fields in the event's zone with end-of-month clamping (Jan 31 + 1 month = Feb 28 or 29), rounded down the same way as totals.
- **Auto** switches from days to hours and minutes when less than 48 whole hours remain (47:59 shows hours and minutes; 48:00 shows 2 days).
- **Workdays** count dates, not hours: Monday to Friday after today up to and including the occurrence date for a countdown, from the day after the date up to and including today for a count-up, and 0 on the day itself.
- **Direction:** "today" when the occurrence date is today's date in the event's zone; otherwise "until" or "since" by the target instant. A one-time day stays "today" for the rest of its date, then counts up.

---

## 3. Data Models

```kotlin
package dev.derek.daysthatmatter.features.events.domain.model

import kotlinx.datetime.Instant
import kotlinx.datetime.LocalDate
import kotlinx.datetime.LocalTime
import kotlinx.serialization.Serializable

@Serializable
data class Event(
    val id: String,
    val title: String,                          // 1 to 100 characters
    val emoji: String? = null,                  // at most one grapheme
    val notes: String? = null,                  // owner only, at most 4,000 characters
    val targetDate: LocalDate,
    val targetTime: LocalTime? = null,
    val timeZone: String? = null,               // IANA id; null = floating (section 2.4)
    val unitMode: UnitMode = UnitMode.Auto,
    val recurrence: Recurrence = Recurrence.None,
    val pinnedAt: Instant? = null,              // owner only; null = not pinned; carousel shows newest first
    val archivedAt: Instant? = null,            // owner only, personal; members archive on their membership
    val reminders: Reminders? = null,           // owner only, personal; members keep theirs on their membership
    val categoryId: String? = null,
    val customizationId: String? = null,
    val ownerId: String,
    val createdAt: Instant,
    val updatedAt: Instant
)

@Serializable
enum class UnitMode { Auto, Days, Weeks, Hours, Calendar, Workdays }   // Auto: days, then h/m under 48 hours

@Serializable
data class Reminders(
    val daysBefore: Set<Int>,                   // subset of 0 (on the day), 1, 7
    val time: LocalTime = LocalTime(9, 0)       // device local time
)

@Serializable
sealed interface Recurrence {                   // API JSON: {"type": "yearly", "originalYear": 2027, "days": null}
    data object None : Recurrence
    data class Yearly(val originalYear: Int) : Recurrence
    data object Monthly : Recurrence
    data object Weekly : Recurrence
    data class CustomDays(val days: Int) : Recurrence     // 1 to 3,650
}

// Engine output (:core:model, CountdownEngine.compute(target, now, viewerZone)); replaces TimeRemaining.
data class Countdown(
    val occurrenceDate: LocalDate,
    val target: Instant,
    val direction: Direction,                   // Until, Since, Today
    val totalDays: Long, val totalHours: Long, val totalMinutes: Long, val totalSeconds: Long,
    val years: Int, val months: Int, val days: Int, val hours: Int, val minutes: Int, val seconds: Int,
    val anniversary: Int?,                      // yearly only: occurrence year minus originalYear
    val workdays: Long
    // ...
) {
    fun value(mode: UnitMode): CountdownValue   // Days, HoursMinutes, WeeksDays, Hours, Calendar or Workdays
}
```

The types shared with the backend live in `:core:model` (package `dev.derek.daysthatmatter.core.model`): `event.EventDoc` (the API document of BACKEND.md section 7.2), `event.Recurrence`, `event.UnitMode`, `event.Reminders`, and `countdown.CountdownEngine`, `Countdown` and `CountdownValue`. The app's `Event` above maps to and from `EventDoc`.

---

## 4. UI/UX Flow & Screens

### 4.1 Home Event Dashboard (`HomeScreen`)
Requirements: the [`home-screen`](../../../openspec/changes/design-v2-features/specs/home-screen/spec.md) spec of the change `design-v2-features`.
- **Pinned Hero Carousel:** any number of owned days can be pinned (`pinnedAt`, newest first). Members cannot pin days shared with them.
  - The centred card is full size; neighbours show a 16 pt edge, scaled to 92% toward the centre and faded to 60%. One card per swipe. Dots show the count and position. Tapping an edge or a dot centres that card; tapping the centred card opens the day. Live ticking seconds on the cards.
  - Pinned days stay in the list with a pin icon. When the carousel settles on a card, the list scrolls to that day's row and outlines it; the outline stays while the card is centred. Under reduce motion the list jumps.
  - Header and carousel stay fixed; only the list scrolls. Scrolling the list collapses the carousel to a 96 pt strip (title and number); it expands at the top of the list. The scroll that follows the carousel does not collapse it.
  - Hidden while searching or filtering. A setting turns it off.
- **Card sizes:** Small, Medium, Large per day ([customization spec](../customization/SPEC.md) section 2.4).
- **Memo badge:** on the owner's cards, a memo icon and count ([memos spec](../memos/SPEC.md) section 4.2).
- **Archived row:** "Archived · 3" at the bottom of the list opens the Archived screen (section 5).
- **Filter & Search Bar:** Instant text query filtering, category pills (All, Birthdays, Anniversaries, Milestones, Work).
- **Sorting Options:**
  - Closest upcoming first.
  - Furthest upcoming first.
  - Most recent past events first.
  - Alphabetical / Custom user order.
- **List / Grid Toggle:** Quick toggle between compact density list and visual aesthetic cards.

### 4.2 Event Detail View (`EventDetailScreen`)
- High-impact visual header with current countdown.
- Unit switch for owners and editors: tapping the number moves to the next unit (Auto, Days, Weeks, Hours, Calendar, Workdays), and a list shows all six. Viewers get no control. In Workdays, a note says public holidays are not skipped yet.
- Milestones tracker (e.g., Progress bar toward 100 days, 500 days, 1000 days, 10,000 hours).
- Quick action buttons: Edit, Share, Audio Toggle, Add Memo.

### 4.3 Event Editor (`EventEditScreen`)
- Title field with character limit indicator.
- Material 3 Date Picker & Time Picker dialogs.
- Recurrence dropdown selector.
- Pin to top switch (owners only).
- Reminders: on the day, 1 day before, 1 week before; at 9:00 local time by default ([notifications spec](../notifications/SPEC.md)).
- Direct navigation into Customization Picker.

---

## 5. Archive
- Archiving hides a day from Home (list, grid, pinned carousel, filters, search) and from widget choices.
- The Archived screen, reached from the "Archived · N" row at the bottom of the Home list, lists archived days. They open normally and offer Unarchive and Delete (Leave for days shared with you).
- Archiving a pinned day unpins it; unarchiving does not pin it again.
- Archive is personal. Owners store `archivedAt` as an owner-only field on the event (synced to their devices, never shared). Members store it on their membership (`members.archived_at`), so archiving a day shared with you affects only you.
- Reminders and change notifications are off for archived days.
- Archived owned days still count toward the owned-event limit ([premium spec](../premium/SPEC.md)).

---

## 6. Smart Days (Draft)
Status: **draft**, not decided in detail. Requirements: the [`smart-days`](../../../openspec/changes/design-v2-features/specs/smart-days/spec.md) spec of the change `design-v2-features`; open questions in its design.md (D8).

- A smart day is computed from a rule instead of one date. Model idea: `Event.kind = Date | Smart(ruleId, params)`.
- Initial rules: days left this year (with progress through the year), weekends left this year, public holidays left this year (region holiday set), workdays left this year (Monday to Friday minus public holidays).
- Seasonal templates: limited-time days offered only inside a season window, for example a Christmas countdown offered 1 November to 25 December, Lunar New Year, exam season. Served from a backend catalog like the audio catalog, so they change without an app release.
- Holiday sets come from the backend per region (`GET /api/v1/holidays/{region}/{year}`), cached by the app.
- Smart days show under a "Smart" category and can be pinned, customized and archived. They cannot be shared yet.

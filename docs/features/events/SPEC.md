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
- **Annual:** Automatically advances target date to the next occurrence once passed (e.g., Birthdays, Wedding Anniversaries, New Year). Retains original anchor year to display milestone anniversary count (e.g., "5th Anniversary").
- **Monthly:** Advances to the same day next month (with leap year / end-of-month clamping, e.g. Jan 31 &rarr; Feb 28).
- **Weekly / Custom Cadence:** Repeats every N days.

### 2.4 Time Zones
- `timeZone` is an IANA zone id or null.
- A fixed zone means every viewer sees the same instant (a flight, a launch). New events default to the device's zone.
- Null means "floating": the viewer's local zone is used (New Year, birthdays).
- An event with no `targetTime` counts to 00:00 in its zone.
- The engine lives in `:core:model`, so the app and the backend compute the same result. The share page's `countdown.js` is checked against test vectors generated from this engine.

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
    val recurrence: RecurrenceRule = RecurrenceRule.None,
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
sealed interface RecurrenceRule {
    @Serializable data object None : RecurrenceRule
    @Serializable data class Yearly(val originalYear: Int) : RecurrenceRule
    @Serializable data object Monthly : RecurrenceRule
    @Serializable data object Weekly : RecurrenceRule
    @Serializable data class CustomDays(val days: Int) : RecurrenceRule
}

data class TimeRemaining(
    val isPast: Boolean,
    val totalDays: Long,
    val years: Int,
    val months: Int,
    val days: Int,
    val hours: Int,
    val minutes: Int,
    val seconds: Int,
    val isToday: Boolean
)
```

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

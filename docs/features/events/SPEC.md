# Feature Specification: Event Tracking & Countdown Engine

## 1. Overview & Goals
The core heart of "Days That Matter". Calculates high-precision countdowns and count-ups for life events, supporting multiple display units, recurring schedules, and smart categorization.

---

## 2. Countdown Calculation Engine

### 2.1 Precision & Unit Modes
The engine uses `kotlinx-datetime` and computes time relative to the user's local timezone:
1. **Total Units:**
   - Total Days (e.g., "1,248 days")
   - Total Hours / Total Minutes / Total Seconds (for near-term events < 48 hours)
2. **Calendar Breakdown:**
   - Years, Months, Days, Hours, Minutes, Seconds (e.g., "3 years, 4 months, 12 days")
3. **Working Days / Business Days:**
   - Optional exclusion of weekends (Saturdays & Sundays) for project deadlines or retirement goals.

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
    val isPinned: Boolean = false,
    val categoryId: String? = null,
    val customizationId: String? = null,
    val ownerId: String,
    val createdAt: Instant,
    val updatedAt: Instant
)

@Serializable
enum class UnitMode { Auto, Days, Calendar }   // Auto: days, then h/m/s under 48 hours

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
- **Pinned Hero Carousel:** Prominent, full-bleed cards for top milestones with live ticking seconds.
- **Filter & Search Bar:** Instant text query filtering, category pills (All, Birthdays, Anniversaries, Milestones, Work).
- **Sorting Options:**
  - Closest upcoming first.
  - Furthest upcoming first.
  - Most recent past events first.
  - Alphabetical / Custom user order.
- **List / Grid Toggle:** Quick toggle between compact density list and visual aesthetic cards.

### 4.2 Event Detail View (`EventDetailScreen`)
- High-impact visual header with current countdown.
- Toggle for calculation unit display (switch between Total Days and Years/Months/Days).
- Milestones tracker (e.g., Progress bar toward 100 days, 500 days, 1000 days, 10,000 hours).
- Quick action buttons: Edit, Share, Audio Toggle, Add Memo.

### 4.3 Event Editor (`EventEditScreen`)
- Title field with character limit indicator.
- Material 3 Date Picker & Time Picker dialogs.
- Recurrence dropdown selector.
- Pin to top switch.
- Direct navigation into Customization Picker.

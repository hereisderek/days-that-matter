# Feature Specification: Home & Lock Screen Widgets

## 1. Overview & Goals
Provides glanceable countdowns on mobile home screens and lock screens, keeping life milestones visible without opening the application.

---

## 2. Platform Widget Architectures

### 2.1 Android (Jetpack Glance)
- **Framework:** Jetpack Glance (Kotlin Compose-based widget API for RemoteViews).
- **Supported Widget Families:**
  - **Small (2x2):** Single event title, remaining day count, circular progress gauge.
  - **Medium (4x2):** Multi-event carousel or single event with detailed breakdown (Years, Months, Days) and target date.
  - **Lock Screen Complications (Android 14+):** Minimalist monochrome text complication.
- **Update Strategy:**
  - `GlanceAppWidget.update()` called immediately upon event editing/creation.
  - AlarmManager / WorkManager scheduled daily tick at midnight (00:00:01 local time).

### 2.2 iOS (WidgetKit & SwiftUI)
- **Framework:** Native SwiftUI WidgetKit extension.
- **Supported Widget Families:**
  - `systemSmall`: Compact countdown card with background tint and days counter.
  - `systemMedium`: Event title, date, live breakdown, milestone badge.
  - `accessoryCircular` / `accessoryRectangular` (iOS 16+ Lock Screen): Monochrome countdown for lock screen and standby mode.
- **Data Sharing:**
  - App Groups shared container (`group.dev.derek.daysthatmatter`).
  - Shared SQLite database or serialized JSON snapshot written by the KMP app.
- **Timeline Management:**
  - `TimelineProvider` pre-computes entries for the next 7 days with daily refresh policies.
  - Midnight timeline reloading (`reloadTimelines(ofKind:)`).

### 2.3 Rules shared by both platforms
- Archived days are not offered when the user picks a day for a widget.
- Widgets ignore the card size (Small, Medium, Large) and show no memo badge.
- Animated backdrops show their key photo only.

---

## 3. Deep Linking from Widgets
- Tapping any widget launches the app directly into the specific event detail view:
  `daysthatmatter://event/{eventId}`
- If multiple events are shown (Medium carousel), each event row acts as an individual deep link button.

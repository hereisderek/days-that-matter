# Feature Specification: Notifications

Normative requirements: the [`notifications`](../../../openspec/changes/design-v2-features/specs/notifications/spec.md) spec of the OpenSpec change [`design-v2-features`](../../../openspec/changes/design-v2-features/) (decisions D6 and D7 in its design.md). Backend side: [`BACKEND.md`](../../architecture/BACKEND.md) section 18.

## 1. Overview & Goals
Notifications remind people of their days and tell them when a shared day changes. Reminders are scheduled on the device, so they work offline. Push notifications come from our backend. Offers and news are sent only to people who turn them on.

---

## 2. Kinds

Kinds are not limited to these; more can be added.

| Kind | Delivered by | Default | Rule |
| :--- | :--- | :--- | :--- |
| Reminders for a day | local notification on the device | on, once the user picks a reminder | On the day, 1 day before, 1 week before; 9:00 local time by default; chosen per day |
| Changes to shared days | push from the backend | on | Someone else edited a day you own or are a member of. At most one per day per hour. Names the editor and the changed field |
| Added to a day | push from the backend | on | Someone added you to a day. No trigger yet: today people join only through invites they open themselves (see [sharing open questions](../sharing/SPEC.md)) |
| Offers and news | push from the backend | **off** | Opt-in only, for example free Premium for a month. At most 2 per month (App Store Review Guideline 4.5.4) |

- Settings › Notifications has one switch per kind. The switches apply to this device.
- The system permission prompt appears when the user first sets a reminder or first shares a day, never at launch.
- Archived days send nothing: no reminders, no change notifications.
- Content never includes notes or memo text.
- Local mode gets local reminders only; push needs an account.

---

## 3. Reminders
- Chosen per day in the event editor: on the day, 1 day before, 1 week before. Delivered at 9:00 device local time by default.
- Reminders apply to the next occurrence of a repeating day. A one-time day that has passed sends none.
- Personal: owners keep them as an owner-only field on the event (`reminders`); members keep them on their membership. They sync to the person's devices, and each device schedules its own.
- iOS keeps at most 64 pending notifications per app. The app schedules the nearest ones and refills on app start and on background refresh (`BGAppRefreshTask`).
- Android: `AlarmManager.setAndAllowWhileIdle`, no exact alarm permission; delivery can be a few minutes late. Android 13 and later need the `POST_NOTIFICATIONS` permission.

---

## 4. Push Notifications
- **Changes to shared days:** after an accepted edit, the backend notifies the owner and members except the author, skipping anyone who archived the day. Text: "Mum changed the date of Grandma's 90th". Several changes to one day within an hour give one notification.
- **Delivery:** APNs for iOS and FCM HTTP v1 for Android, sent by the backend core. Whether Cloudflare Workers can call APNs (HTTP/2) needs a spike; the alternative is FCM for both platforms.
- **China:** no FCM. Open point in [`CHINA.md`](../../architecture/CHINA.md).

### 4.1 Device Registration
- After sign-in, and when a value changes, the app calls `PUT /api/v1/me/devices/{installId}` with `{platform, pushToken, locale, timeZone, kinds}`. On sign-out it calls `DELETE`.
- The backend removes a token on sign-out, when APNs or FCM reports it invalid, or after 90 days unused.

---

## 5. Data Models

```kotlin
package dev.derek.daysthatmatter.features.notifications.domain.model

import kotlinx.serialization.Serializable

// Reminder choices per day: `Reminders` in the events spec, section 3.

@Serializable
enum class NotificationKind { Reminders, Changes, Added, Offers }   // API values for push: changes, added, offers

data class NotificationSettings(            // per device
    val reminders: Boolean = true,
    val changes: Boolean = true,
    val added: Boolean = true,
    val offers: Boolean = false             // opt-in
)
```

---

## 6. UI/UX Flow

### 6.1 Event Editor
- "Reminders" row: On the day, 1 day before, 1 week before (multiple choice). First use shows the system permission prompt.

### 6.2 Settings › Notifications
- One switch per kind: Reminders, Changes to shared days, Added to a day, Offers and news (off by default).
- When the system permission is denied, a line explains it and opens the system settings.

---

## 7. Privacy
- The backend stores per device: platform, push token, locale, time zone, enabled kinds and the last contact time. Removed on sign-out, on an invalid-token answer, or after 90 days unused.
- Push payloads carry the editor's display name, the day's title and the changed field name. Never notes, memo text or email addresses.
- Privacy policy and terms items: [`docs/legal/README.md`](../../legal/README.md).

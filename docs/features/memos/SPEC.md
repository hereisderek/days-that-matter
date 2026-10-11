# Feature Specification: Memos & Memory Notes

## 1. Overview & Goals
Transforms simple countdown timers into rich digital keepsakes. Users can log memories, thoughts, reflections, or preparation checklists directly under any event.

---

## 2. Capabilities & Functionality

### 2.1 Memo Attributes
- **Content:** Markdown or formatted text notes.
- **Timestamp:** Precise creation instant (`kotlinx-datetime.Instant`).
- **Author Identity:** Display name, avatar, and user ID (enabling shared family/couple collaboration).
- **Milestone Pins:** Ability to pin a memo to a specific milestone (e.g., "Note added on 100th Day").

### 2.2 Collaboration & Permissions
- Event owners can add, edit, and delete any memo.
- Memos stay on the device in this phase. They are not synced across the owner's devices, not visible to people with access and never appear on link pages. Memo sync is a separate change.
- Later: editors of a shared event (see the `event-sharing` spec) may add their own memos. Comments from link visitors, optionally anonymous and visible only to the owner, are a separate planned feature (design D12 of the change [`pluggable-backend-live-sharing`](../../../openspec/changes/pluggable-backend-live-sharing/design.md)).

---

## 3. Data Models

```kotlin
package dev.derek.daysthatmatter.features.memos.domain.model

import kotlinx.datetime.Instant
import kotlinx.serialization.Serializable

@Serializable
data class Memo(
    val id: String,
    val eventId: String,
    val authorId: String,
    val authorName: String,
    val authorPhotoUrl: String? = null,
    val content: String,
    val milestoneTag: String? = null, // e.g. "Day 100", "1 Year Milestone"
    val createdAt: Instant,
    val updatedAt: Instant
)
```

---

## 4. UI/UX Flow & Screen Elements

### 4.1 Event Detail Timeline Section
- Located underneath the countdown header and milestone progress bar.
- Interactive timeline cards showing date stamp, author avatar, and memo text.
- "Add Memo" floating chip or quick-entry bottom sheet.
- Swipe-to-delete with undo snackbar for author's own memos.

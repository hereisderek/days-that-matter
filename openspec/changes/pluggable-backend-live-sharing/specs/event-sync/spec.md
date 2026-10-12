# Delta for Event Sync

## Purpose

Keeps a signed-in user's events and memos the same on all their devices and with the people they share with, while every edit works offline first.

## ADDED Requirements

### Requirement: Everything syncs for signed-in users
For a signed-in user, all their events and memos SHALL sync to the backend and to their other signed-in devices, and events shared with them SHALL sync to their devices. Comments SHALL sync the same way when comments are added. Guests SHALL NOT sync.

#### Scenario: Second device
- **WHEN** a user signs in on a second device
- **THEN** all events and memos from their first device appear on the second device

### Requirement: Automatic sync after edits
The app SHALL sync automatically within 2 seconds of each saved edit when online, when the app starts and when it returns to the foreground. Pending edits SHALL be sent in order and SHALL survive app restarts.

#### Scenario: Edit offline
- **WHEN** a user edits an event in airplane mode and restarts the app
- **THEN** the edit is still shown, marked as pending, and is sent within 2 seconds of the network returning

### Requirement: Sync button
The app SHALL offer a Sync button that syncs at once and shows the time of the last successful sync. After a manual sync, the app SHALL tell the user that edits sync automatically after editing.

#### Scenario: User taps Sync
- **WHEN** a signed-in user taps Sync
- **THEN** the app syncs, shows "Synced just now" and the message "Changes sync automatically after each edit"

#### Scenario: Sync while offline
- **WHEN** a signed-in user taps Sync with no network
- **THEN** the app says it is offline and keeps the edits pending

### Requirement: Field-level merge
The backend SHALL merge concurrent edits field by field. Edits to different fields SHALL all be kept. For the same field, the edit the backend receives last SHALL win and the replaced value SHALL stay in history. The response SHALL list the fields where the edit replaced a newer change by someone else.

#### Scenario: Different fields
- **WHEN** the owner changes the title offline while an editor changes the date
- **THEN** after both sync, the event has the owner's title and the editor's date

#### Scenario: Same field
- **WHEN** an editor sets the time to 18:00 and later the owner's older offline edit setting 17:00 reaches the backend
- **THEN** the event shows 17:00, history shows both changes, and the owner's app says it replaced the editor's change

### Requirement: Owner-only fields and memos
Notes, pin state (`pinnedAt`), category, archive state (`archivedAt`) and memos SHALL be visible to and editable by the owner only. Editors, viewers and link visitors SHALL NOT receive them. A non-owner write that contains an owner-only field SHALL be rejected with `403` and error code `field_not_allowed`.

#### Scenario: Editor syncs an event with notes and memos
- **WHEN** an editor's app syncs a shared event whose owner wrote notes and memos
- **THEN** the event arrives without notes and without memos

### Requirement: Memo sync
Memos SHALL sync with the same rules as events: offline first, sent automatically after saving, merged field by field. A deleted memo SHALL disappear from all the owner's devices. A device that was offline for more than 30 days SHALL still end up with the correct memos.

#### Scenario: Memo deleted on another device
- **WHEN** the owner deletes a memo on their phone
- **THEN** the memo disappears from their tablet on the tablet's next sync

#### Scenario: Device offline for two months
- **WHEN** a device that last synced 60 days ago syncs again
- **THEN** its memos match the backend, including memos deleted in the meantime

### Requirement: Shared validation
The app and the backend SHALL apply the same validation rules, built from one shared definition. A rejected write SHALL return `400 invalid_payload` with the field path. Titles SHALL be 1 to 100 characters, notes at most 4,000 characters, memo text at most 10,000 characters, and an event SHALL have at most 500 memos. The number of owned events follows the plan table (premium spec).

#### Scenario: Title too long
- **WHEN** a user types a 101 character title
- **THEN** the app shows the error before sending, and a client that sends it anyway gets `400 invalid_payload` with field path `title`

### Requirement: Deletion and lost access
When the owner deletes an event, it SHALL disappear from all their devices and from collaborators' apps on their next sync, and its links SHALL show "no longer available". When a person loses access to an event, it SHALL disappear from their app on their next sync.

#### Scenario: Owner deletes a shared event
- **WHEN** the owner deletes an event shared with two editors
- **THEN** the editors' apps remove it on their next sync and its public link page shows "no longer available"

### Requirement: Live updates in the app
While a shared event is open in the app, changes made by others SHALL appear without a manual refresh: within 5 seconds in `ws` mode and within 30 seconds in `poll` mode.

#### Scenario: Owner watches an editor's change
- **WHEN** the owner has an event open and an editor changes its title
- **THEN** the owner's screen shows the new title without leaving the screen

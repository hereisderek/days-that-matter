# Delta for Event Sync

## Purpose

Keeps a user's events the same on all their devices and with the people they share with, while every edit works offline first.

## ADDED Requirements

### Requirement: Which events the backend stores
For a signed-in user with sync on, the default after sign-in, the backend SHALL store all their events. For an anonymous account, the backend SHALL store only the events the user has shared. Events of a guest who has never shared or signed in SHALL stay on the device.

#### Scenario: Guest shares one of five events
- **WHEN** a guest with five events creates a public link for one of them
- **THEN** the backend stores only that event

#### Scenario: Sign in with sync on
- **WHEN** a user signs in on a second device with sync on
- **THEN** all events from their first device appear on the second device

### Requirement: Offline-first edits
Edits SHALL apply on the device at once and never wait for the network. Pending edits SHALL be sent in order when the device is online and SHALL survive app restarts. When online, an edit to a shared event SHALL be sent within 2 seconds of saving.

#### Scenario: Edit offline
- **WHEN** a user edits an event in airplane mode and restarts the app
- **THEN** the edit is still shown, marked as pending, and is sent when the network returns

### Requirement: Field-level merge
The backend SHALL merge concurrent edits field by field. Edits to different fields SHALL all be kept. For the same field, the edit the backend receives last SHALL win and the replaced value SHALL stay in history. The response SHALL list the fields where the edit replaced a newer change by someone else.

#### Scenario: Different fields
- **WHEN** the owner changes the title offline while an editor changes the date
- **THEN** after both sync, the event has the owner's title and the editor's date

#### Scenario: Same field
- **WHEN** an editor sets the time to 18:00 and later the owner's older offline edit setting 17:00 reaches the backend
- **THEN** the event shows 17:00, history shows both changes, and the owner's app says it replaced the editor's change

### Requirement: Owner-only fields
Notes, pin state and category SHALL be visible to and editable by the owner only. Editors, viewers and link visitors SHALL NOT receive them. An edit by a non-owner that contains an owner-only field SHALL be rejected with `403` and error code `field_not_allowed`.

#### Scenario: Editor syncs an event with notes
- **WHEN** an editor's app syncs a shared event whose owner wrote notes
- **THEN** the event arrives without notes

#### Scenario: Editor sends notes
- **WHEN** an editor's client sends an edit that sets notes
- **THEN** the response is `403 field_not_allowed` and the event is unchanged

### Requirement: Shared validation
The app and the backend SHALL apply the same validation rules to events, built from one shared definition. A rejected write SHALL return `400 invalid_payload` with the field path. Titles SHALL be 1 to 100 characters, notes at most 4,000 characters, and an account SHALL own at most 500 events.

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

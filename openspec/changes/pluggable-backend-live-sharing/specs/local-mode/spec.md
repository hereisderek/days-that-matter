# Delta for Local Mode

## Purpose

Defines using the app on one device without an account, how local data and account data stay apart, how local events move into an account without ever being lost, and how events leave or enter a device as a file.

## ADDED Requirements

### Requirement: Local mode
The app SHALL work fully, offline included, without an account (local mode). In local mode every event, memo and setting SHALL stay on the device, and the app SHALL send no event data and no account, device or user identifier. The only request local mode MAY make is the public remote configuration request (remote-config spec). Local mode SHALL follow the Free plan's limits and premium features SHALL stay Premium-only (premium spec), so that signing in later never needs the user to remove anything.

#### Scenario: Local mode sends no event data
- **WHEN** a user with no account creates 5 events and 3 memos
- **THEN** the app sends nothing about them and the only request it makes is the remote configuration request, which carries no identifier

#### Scenario: Local user reaches the Free limit
- **WHEN** a local user with 20 events creates another
- **THEN** the paywall appears and no event is created

### Requirement: Name and greeting
In local mode the user MAY set a name in Settings. Tapping the name on the account card SHALL open a small popup to change it; the name SHALL stay on the device. Home SHALL greet the user by time of day, with the name when there is one (the local name, or the account's display name when signed in) and without a name when there is none. The greeting SHALL have an off switch in Settings. Signing in SHALL NOT copy the local name to the account.

#### Scenario: Set the name
- **WHEN** a local user taps the name on the Settings card, types "Sam" and saves
- **THEN** the card shows "Sam" and Home greets "Good morning, Sam" in the morning

#### Scenario: No name
- **WHEN** a local user has not set a name
- **THEN** Home greets without a name and the Settings card says "Add your name"

#### Scenario: Greeting off
- **WHEN** the user turns the greeting off in Settings
- **THEN** Home shows its normal title

### Requirement: Choice at first launch
On first launch the app SHALL offer, as two equal choices, using the app on this device only or signing in or creating an account. It SHALL say plainly that online features (sharing, sync, history and invites) need an account and that everything else works on this device. It SHALL NOT mention plan limits there.

#### Scenario: Choose this device
- **WHEN** a new user chooses "Use on this device"
- **THEN** the app opens in local mode with no sign-in

#### Scenario: Choose an account
- **WHEN** a new user chooses "Sign in or create an account"
- **THEN** the app shows the enabled sign-in methods

### Requirement: Separate databases
The app SHALL keep local-mode data and each signed-in account's data in separate databases on the device. Events SHALL move between them only through an explicit import. Widgets, reminders and notifications SHALL follow the database they belong to.

#### Scenario: Account events are not local events
- **WHEN** a user with local events signs in and chooses not to import
- **THEN** Home shows only the account's events

### Requirement: Sign-in suggestion after heavy use
In local mode the app SHALL suggest creating an account, calmly, after heavy use, naming the benefits (sharing with people, sync across devices, history and restore, a backup). The rules SHALL come from the remote configuration, and the compiled-in defaults SHALL be: heavy use means at least 12 events and 14 days since first launch, or at least 25 events, or at least 20 memos; at most one suggestion per 30 days; none in the first 7 days; none after the user chose "Not now" twice. It SHALL never appear when signed in.

#### Scenario: Heavy use in local mode
- **WHEN** a local user 20 days after first launch has 15 events and has not been asked before
- **THEN** the app shows the suggestion once

#### Scenario: Not now twice
- **WHEN** a local user has chosen "Not now" twice
- **THEN** the app never shows the suggestion again

#### Scenario: Rules changed remotely
- **WHEN** the remote configuration raises the cool-down from 30 to 60 days
- **THEN** the app uses 60 days from the next time it reads the value

### Requirement: Importing local events
When a user signs in on a device that has local events, the app SHALL ask whether to import them into the account, say how many were found, and say in plain words that importing is permanent: the events move into the account and are no longer kept in local mode on this device. A second confirmation SHALL follow before anything is sent. Signing in SHALL NOT import, upload or merge anything by itself. If the user chooses not to import, nothing SHALL be sent, the local events SHALL stay on the device and SHALL NOT appear in the account, and Settings SHALL offer "Import events from this device" with the same confirmation for as long as local events remain. An import SHALL merge with what the account already has: all events from the account and from the device SHALL be kept, and no event SHALL be dropped to fit a limit, including the plan's event limit.

#### Scenario: Import after signing in
- **WHEN** a local user with four events signs in to an account that already has two, and confirms the import
- **THEN** the account has six events on this device and on every other signed-in device

#### Scenario: Imported events leave local mode
- **WHEN** the user signs out after importing
- **THEN** local mode shows none of the imported events

#### Scenario: Decline the import
- **WHEN** a local user with events signs in and chooses not to import
- **THEN** Home shows only the account's events, nothing was sent, and Settings shows "Import events from this device"

#### Scenario: Local events return after sign-out
- **WHEN** the user who declined the import signs out
- **THEN** the local events are shown again

#### Scenario: Import later from Settings
- **WHEN** the user taps "Import events from this device" and confirms
- **THEN** the import runs as at sign-in, and the action disappears once no local events remain

### Requirement: An import succeeds as a whole or fails as a whole
The app SHALL NOT offer to import only some events and SHALL NOT report a partial result. While an import runs, the app MAY show progress. If any event fails, the whole import SHALL be treated as failed: the app SHALL say it did not work, offer "Try again", and leave every local event unchanged. If retrying cannot help, for example because the service does not accept a field of an event owing to a version difference, the app SHALL say why in plain words, skip the import, keep the events on the device, and the failure SHALL be recorded for diagnostics (see the analytics to-do).

#### Scenario: One event fails
- **WHEN** one of four events is rejected during an import
- **THEN** the app says the import did not work, offers "Try again", and all four events are still local and none is in the account's database on the device

#### Scenario: Service does not know a field
- **WHEN** the backend is older than the app and rejects a field of an event
- **THEN** the import fails as a whole, the app explains in plain words that this version of the service cannot take the events yet, keeps them on the device, and records the failure

### Requirement: Local events are removed only after the import is verified
The app SHALL remove local events only after both of these hold: the backend has answered that every event was stored, listing the id of each imported event and any field it did not store, with no id missing and no field dropped; and every event has been written to the signed-in account's database on the device in one transaction. Any other outcome, including a crash or the app being closed, SHALL leave the local events in place. The app SHALL keep an import record on the device so that an interrupted import can resume or be retried without losing or duplicating events.

#### Scenario: App closed during an import
- **WHEN** the app is killed after the backend stored the events but before the local copy finished
- **THEN** on the next start the import resumes, the events are in the account's database, and only then are the local events removed, with no duplicate

#### Scenario: Backend drops a field
- **WHEN** the backend's answer lists an event field it did not store
- **THEN** the import counts as failed and the local events stay

### Requirement: Export and import events as a file
In local mode and when signed in, Settings SHALL offer "Export events" and "Import events". Export SHALL save one .zip file where the user can find it (on Android, shared external storage such as Downloads), named with the app's name and a timestamp, for example `DaysThatMatter-20261015-153045.zip`. It SHALL contain the events and memos of the active database and the media files they use, in a documented, versioned format. Import SHALL read such a file into the active database, local or the signed-in account, keeping events that already exist unchanged and following the same rules as any import: all or nothing, verified before anything is changed. A file from a newer version of the app SHALL be refused with a plain explanation.

#### Scenario: Export from local mode
- **WHEN** a local user taps "Export events"
- **THEN** a .zip named with the app name and the time is saved to the device's shared storage, and the app shows where

#### Scenario: Import a file into an account
- **WHEN** a signed-in user imports a file of 12 events
- **THEN** all 12 are added to the account through the events import endpoint, or none are

#### Scenario: File from a newer version
- **WHEN** a user imports a file written by a newer app version
- **THEN** the app says the file needs a newer version of the app and changes nothing

### Requirement: Sign out never loses changes
Signing out SHALL first sync pending changes. Every change SHALL be kept in the database with a flag saying whether the server has it, until the server confirms it. When the device is offline or the sync fails, the app SHALL tell the user that not everything has been sent and that the rest will be sent the next time the device is online. After signing out the app SHALL show local mode only; the account's database SHALL stay on the device, hidden, until its pending changes have been sent, and SHALL then be removed. Signing out SHALL otherwise remove the account's events from the device.

#### Scenario: Sign out online
- **WHEN** a signed-in user with no pending changes signs out
- **THEN** the app syncs, returns to local mode, and the account's events are no longer on the device

#### Scenario: Sign out offline with unsynced changes
- **WHEN** a signed-in user with edits made offline signs out while the device is offline
- **THEN** the app says not everything has been sent and the rest will be sent when the device is online, shows local mode, and sends the edits at the next opportunity before removing the account's data

### Requirement: Widgets follow their source
Each widget SHALL remember its source (local mode, or one account) and its event. A widget SHALL show its event normally when that event is available in the database active for its source: a local widget while local mode is active, an account widget while that account is signed in, and the widget of an event that was imported while its account is signed in. Otherwise the widget SHALL show a placeholder that says in plain words that the event is not available, and tapping it SHALL open the app. A widget SHALL NOT show data from another source.

#### Scenario: Account widget while signed out
- **WHEN** a widget shows an event of an account and the user signs out
- **THEN** the widget shows the placeholder

#### Scenario: Local widget after signing in
- **WHEN** a widget shows a local event that was not imported and the user signs in
- **THEN** the widget shows the placeholder

#### Scenario: Widget of an imported event
- **WHEN** a local event with a widget is imported and the account is signed in
- **THEN** the widget keeps showing the event as before

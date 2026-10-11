# Delta for Accounts

## Purpose

Identifies people so that event ownership, people access and edit history can be attributed, while guests can use the app without signing up.

## ADDED Requirements

### Requirement: Use without an account
The app SHALL work fully, offline included, without an account. It SHALL send nothing to the backend until the user shares an event or signs in.

#### Scenario: Guest creates events offline
- **WHEN** a new user skips sign-in and creates events with no network
- **THEN** the events are saved and shown, and the app makes no request to the backend

### Requirement: Anonymous account on first share
When a guest first creates a public link, the app SHALL create an anonymous account bound to a secret kept in the device's secure storage, without asking the user to sign in. Before that first link, the app SHALL warn once that guest links cannot be managed from another device or after the app is deleted.

#### Scenario: Guest creates a public link
- **WHEN** a guest creates their first public link
- **THEN** the app shows the warning, creates an anonymous account and returns a working link

#### Scenario: Device secret lost
- **WHEN** a guest who shared an event deletes and reinstalls the app
- **THEN** the existing link keeps working for visitors and the new install cannot manage it

### Requirement: Sign in with Google or Apple
The app and the share web pages SHALL support Sign in with Google and Sign in with Apple. Web sign-in SHALL redirect to the provider and back, and SHALL NOT load provider scripts on share pages.

#### Scenario: Sign in on iOS
- **WHEN** a user taps "Sign in with Apple" on iOS and confirms
- **THEN** the app is signed in

#### Scenario: Sign in with Apple on Android
- **WHEN** a user taps "Sign in with Apple" on Android
- **THEN** an in-app browser tab opens Apple's sign-in and the app is signed in after the user confirms

#### Scenario: Sign in on the web
- **WHEN** a visitor on a people link page chooses "Continue with Google"
- **THEN** the browser goes to Google and returns to the same page, signed in

### Requirement: Upgrade keeps guest data
Signing in on a device with an anonymous account SHALL keep that account's events, links and history. A new identity SHALL be attached to the anonymous account. If the identity already has an account, the anonymous account's events and links SHALL move to it and the anonymous account SHALL be deleted.

#### Scenario: First sign-in
- **WHEN** a guest with two public links signs in with Google for the first time
- **THEN** both links keep working and are listed under the signed-in account

#### Scenario: Identity already has an account
- **WHEN** a guest signs in with an Apple ID that already has an account with events
- **THEN** the guest's events and links appear in that account next to its existing events

### Requirement: Sessions
A session SHALL stay valid until 90 days after its last use. Signing out SHALL end only the current device's session. On the web, the session SHALL be held in an HttpOnly, Secure cookie that page scripts cannot read.

#### Scenario: Session expired
- **WHEN** the app calls the backend with a session unused for more than 90 days
- **THEN** the response is `401 unauthorized` and the app asks the user to sign in again, keeping local data

#### Scenario: Sign out on one device
- **WHEN** a user signed in on a phone and a tablet signs out on the phone
- **THEN** the tablet stays signed in

### Requirement: Display name
Each account SHALL have a display name that collaborators see in the people list and in history. It SHALL default to the name from the identity provider and SHALL be editable. Anonymous accounts SHALL be shown as "Guest".

#### Scenario: Name in history
- **WHEN** an editor with display name "Mum" changes an event's date
- **THEN** the history entry for that change shows "Mum"

### Requirement: Account deletion
A signed-in user SHALL be able to delete their account from the app. Deletion SHALL remove their owned events, links, invites and backdrops, and remove their access to events shared with them. Their entries in other owners' history SHALL show "Deleted user".

#### Scenario: Owner deletes the account
- **WHEN** an owner with a shared event deletes their account
- **THEN** the event's links show "no longer available" and its editors no longer have the event

#### Scenario: Editor deletes the account
- **WHEN** an editor deletes their account
- **THEN** the owner's event keeps the editor's changes and history shows "Deleted user" as their author

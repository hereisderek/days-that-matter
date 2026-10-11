# Delta for Accounts

## Purpose

Identifies people so that sync, sharing, people access, edit history and purchases belong to an account, while guests can still use the app fully on one device.

## ADDED Requirements

### Requirement: Local use without an account
The app SHALL work fully, offline included, without an account. Without an account, data SHALL stay on the device and the app SHALL send nothing to the backend.

#### Scenario: Guest creates events offline
- **WHEN** a new user skips sign-in and creates events and memos with no network
- **THEN** they are saved and shown, and the app makes no request to the backend

### Requirement: Sign-in prompt for online features
When a guest taps Sync, Share or Invite, or accepts an invite, the app SHALL show a prompt to sign in or create an account, with a "Not now" choice for actions that do not need an account to continue. The app SHALL also show this prompt once after a guest saves their first event.

#### Scenario: Guest taps Sync
- **WHEN** a guest taps the Sync button
- **THEN** the app shows the sign-in or create account prompt and syncs nothing

#### Scenario: Guest dismisses the first-event prompt
- **WHEN** a guest saves their first event and chooses "Not now" in the prompt
- **THEN** the event stays on the device and the prompt does not appear again on later saves

### Requirement: Sign in or create an account with Google or Apple
The app and the share web pages SHALL offer Sign in with Google and Sign in with Apple. The first sign-in with an identity SHALL create the account, so signing in and creating an account are the same step. Web sign-in SHALL redirect to the provider and back, and SHALL NOT load provider scripts on share pages.

#### Scenario: Create an account on iOS
- **WHEN** a user without an account taps "Sign in with Apple" on iOS and confirms
- **THEN** an account is created and the app is signed in

#### Scenario: Sign in with Apple on Android
- **WHEN** a user taps "Sign in with Apple" on Android
- **THEN** an in-app browser tab opens Apple's sign-in and the app is signed in after the user confirms

#### Scenario: Sign in on the web
- **WHEN** a visitor on an invite page chooses "Continue with Google"
- **THEN** the browser goes to Google and returns to the same page, signed in

### Requirement: First sign-in uploads local data
When a guest signs in on a device, their local events and memos SHALL upload to the account. If the account already has data from another device, both sets SHALL be kept.

#### Scenario: Guest with events signs in
- **WHEN** a guest with four local events signs in to an account that already has two events
- **THEN** the account has six events on every signed-in device

### Requirement: Sessions
A session SHALL stay valid until 90 days after its last use. Signing out SHALL end only the current device's session and SHALL keep the device's data until the user removes it. On the web, the session SHALL be held in an HttpOnly, Secure cookie that page scripts cannot read.

#### Scenario: Session expired
- **WHEN** the app calls the backend with a session unused for more than 90 days
- **THEN** the response is `401 unauthorized` and the app asks the user to sign in again, keeping local data and pending changes

#### Scenario: Sign out on one device
- **WHEN** a user signed in on a phone and a tablet signs out on the phone
- **THEN** the tablet stays signed in

### Requirement: Display name
Each account SHALL have a display name that collaborators see in the people list and in history. It SHALL default to the name from the identity provider and SHALL be editable.

#### Scenario: Name in history
- **WHEN** an editor with display name "Mum" changes an event's date
- **THEN** the history entry for that change shows "Mum"

### Requirement: Account deletion
A signed-in user SHALL be able to delete their account from the app. Deletion SHALL remove their owned events, memos, links, invites and backdrops, and remove their access to events shared with them. Their entries in other owners' history SHALL show "Deleted user". The app SHALL tell the user that an active subscription must be cancelled in the App Store or Google Play.

#### Scenario: Owner deletes the account
- **WHEN** an owner with a shared event deletes their account
- **THEN** the event's links show "no longer available" and its editors no longer have the event

#### Scenario: Subscriber deletes the account
- **WHEN** a Premium subscriber starts account deletion
- **THEN** the app explains how to cancel the subscription in the store before confirming

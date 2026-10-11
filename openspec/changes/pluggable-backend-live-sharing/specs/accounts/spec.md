# Delta for Accounts

## Purpose

Identifies people so that sync, sharing, membership, edit history and purchases belong to an account, while guests can still use the app fully on one device.

## ADDED Requirements

### Requirement: Local use without an account
The app SHALL work fully, offline included, without an account, within the free plan's limits. Without an account, data SHALL stay on the device and the app SHALL send nothing to the backend.

#### Scenario: Guest creates events offline
- **WHEN** a new user skips sign-in and creates events and memos with no network
- **THEN** they are saved and shown, and the app makes no request to the backend

### Requirement: Sign-in prompt for online features
When a guest taps Sync, Share or Invite, or opens an invite link, the app SHALL show a prompt to sign in or create an account, with a "Not now" choice for actions that can wait. The app SHALL also show this prompt once after a guest saves their first event.

#### Scenario: Guest taps Sync
- **WHEN** a guest taps the Sync button
- **THEN** the app shows the sign-in or create account prompt and syncs nothing

#### Scenario: Guest dismisses the first-event prompt
- **WHEN** a guest saves their first event and chooses "Not now"
- **THEN** the event stays on the device and the prompt does not appear again on later saves

### Requirement: Sign-in methods
The app and the share web pages SHALL offer the sign-in methods the deployment enables. The global deployment SHALL enable Sign in with Google, Sign in with Apple and email with a one-time code. The first sign-in with a method SHALL create the account. New methods SHALL be addable without changing existing accounts.

#### Scenario: Create an account on iOS
- **WHEN** a user without an account taps "Sign in with Apple" on iOS and confirms
- **THEN** an account is created and the app is signed in

#### Scenario: Sign in with Apple on Android
- **WHEN** a user taps "Sign in with Apple" on Android
- **THEN** an in-app browser tab opens Apple's sign-in and the app is signed in after the user confirms

#### Scenario: Sign in on the web without provider scripts
- **WHEN** a visitor on an invite page chooses "Continue with Google"
- **THEN** the browser goes to Google and returns to the same page signed in, and the page loaded no Google script

### Requirement: Email one-time codes
A user SHALL be able to sign in by entering an email address and the 6-digit code sent to it. A code SHALL be valid for 10 minutes and for 5 attempts. Requesting codes SHALL be limited to 5 per address per hour.

#### Scenario: Sign in with email
- **WHEN** a user enters their email, receives a code and enters it within 10 minutes
- **THEN** the user is signed in, and a new account is created if the address was unknown

#### Scenario: Wrong code five times
- **WHEN** a user enters a wrong code five times
- **THEN** the code stops working and the user must request a new one

### Requirement: One account per verified email
When a user signs in with a method whose verified email matches the verified email of an existing account, the method SHALL join that account. A signed-in user SHALL be able to add more sign-in methods in account settings.

#### Scenario: Email then Google with the same address
- **WHEN** a user who signed up with an email code later signs in with Google using the same verified address
- **THEN** they land in the same account with the same events

### Requirement: Terms of service and privacy policy
Creating an account SHALL require agreeing to the terms of service and the privacy policy, shown as links on the sign-in screen in the app and on the web. The terms SHALL state that users may only upload photos and audio they own or have the rights to use. When the terms change in a way that needs new consent, the app SHALL ask signed-in users to agree again.

#### Scenario: Sign-up
- **WHEN** a user without an account sees the sign-in screen
- **THEN** it says that continuing means agreeing to the terms and privacy policy, with links to both

#### Scenario: Upload without a prompt
- **WHEN** a Premium user uploads a photo or a custom audio file
- **THEN** the app asks no rights question; the terms already cover it

### Requirement: First sign-in uploads local data
When a guest signs in on a device, their local events and memos SHALL upload to the account. If the account already has data from another device, both sets SHALL be kept, even if the total is above the plan's event limit.

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
Each account SHALL have a display name that members see in the member list and in history. It SHALL default to the name from the sign-in method, or the part of the email address before `@`, and SHALL be editable.

#### Scenario: Name in history
- **WHEN** an editor with display name "Mum" changes an event's date
- **THEN** the history entry for that change shows "Mum"

### Requirement: Account deletion
A signed-in user SHALL be able to delete their account from the app. Deletion SHALL remove their owned events, memos, links, invites and uploaded files, and remove their membership in other events. Their entries in other owners' history SHALL show "Deleted user". The app SHALL tell the user that an active subscription must be cancelled in the App Store or Google Play.

#### Scenario: Owner deletes the account
- **WHEN** an owner with a shared event deletes their account
- **THEN** the event's links show "no longer available" and its members no longer have the event

#### Scenario: Subscriber deletes the account
- **WHEN** a Premium subscriber starts account deletion
- **THEN** the app explains how to cancel the subscription in the store before confirming

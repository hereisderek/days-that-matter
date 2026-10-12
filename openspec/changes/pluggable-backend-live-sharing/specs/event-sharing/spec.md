# Delta for Event Sharing

## Purpose

Lets a signed-in owner share an event through public view-only links that anyone can open, and through invite links that let signed-in people add the event to their account as a viewer or an editor.

## ADDED Requirements

### Requirement: Sharing needs an account, viewing a public link does not
Creating links and invites SHALL require the owner to be signed in. Joining through an invite SHALL require the receiver to be signed in. Opening a public link SHALL NOT require an account.

#### Scenario: Guest taps Share
- **WHEN** a guest taps Share on an event
- **THEN** the app asks them to sign in or create an account, and after sign-in continues to the share screen with the event uploaded

### Requirement: Public links
The owner SHALL be able to create up to 10 active public links per event, each with an optional label. Anyone with a public link SHALL be able to view the event without signing in. Public links SHALL be view only and SHALL NOT add the event to the visitor's account.

#### Scenario: Two public links
- **WHEN** the owner creates a link labelled "Instagram" and another labelled "Family chat"
- **THEN** both URLs open the event in a browser without sign-in and neither offers editing

#### Scenario: Eleventh link
- **WHEN** the owner tries to create an eleventh active public link for one event
- **THEN** the response is `429 quota_exceeded` and the app asks the owner to revoke a link first

### Requirement: Link expiry set by the owner
For every public link and invite link, the owner SHALL choose an expiry: 5 days, 30 days, never, or a custom date and time up to 5 years ahead. The owner SHALL be able to change it later. Public links SHALL default to never; invite links SHALL default to 30 days.

#### Scenario: Custom expiry
- **WHEN** the owner sets a public link to expire on the evening of the event
- **THEN** the link works until that time and shows "no longer available" after it

#### Scenario: Extend an invite
- **WHEN** the owner changes an invite's expiry from 5 days to never before it expires
- **THEN** the invite keeps working after the fifth day

### Requirement: Owner sees links on every device
The owner SHALL be able to see and copy the URL of every active link and invite of their event on any device where they are signed in.

#### Scenario: Copy a link on a second device
- **WHEN** an owner who created a link on their phone opens the event's share screen on their tablet
- **THEN** the tablet lists the link and can copy its URL

### Requirement: Revoke a link
The owner SHALL be able to revoke any public link or invite link. A revoked or expired public link SHALL show "no longer available" with no event details. Revocation SHALL be permanent and SHALL NOT affect the event's other links or existing members.

#### Scenario: Revoke one of two links
- **WHEN** the owner revokes the "Instagram" link
- **THEN** that URL shows "no longer available" on its next load and the "Family chat" link keeps working

### Requirement: Invite links with role and use count
The owner SHALL be able to create invite links, each with a role (viewer or editor) and a use count: 1, 5, 10, unlimited, or a custom number from 1 to 100. Each person who joins through the invite SHALL use one; opening it SHALL use none. When all uses are taken, the invite SHALL stop accepting new members.

#### Scenario: Invite for five people
- **WHEN** the owner sends a 5-use editor invite to a family chat and five people join
- **THEN** all five are editors and a sixth person who opens the invite is told it is full

#### Scenario: Opened but not joined
- **WHEN** a receiver opens an invite and closes it without signing in
- **THEN** no use is taken and the invite works when opened again

### Requirement: Joining through an invite
Opening an invite SHALL open the app when it is installed. A receiver who is not signed in SHALL be asked in the app to sign in or create an account, then SHALL see the event name, the owner's name and the role, and join. Joining SHALL add the event to the receiver's account with that role. Joining SHALL happen only in the app; in a browser, an invite SHALL show the generic landing page (share-web spec).

#### Scenario: App installed, not signed in
- **WHEN** a receiver with the app installed but not signed in taps an editor invite
- **THEN** the app opens, asks them to sign in or create an account, shows the invite, and after "Join" lists the event as editable on their home screen

#### Scenario: App not installed
- **WHEN** a receiver without the app opens an invite in a browser, installs the app from the page's store link and opens the invite again
- **THEN** the browser page showed no event details, and the app now shows the invite with the event name, owner and role, and a Join button

#### Scenario: Owner or member opens an invite
- **WHEN** the owner, or a person who is already a member, opens an invite
- **THEN** the event opens and no use is taken

### Requirement: Members
Members SHALL see the event in their app, marked as shared. A member link (`/s/{eventId}`) SHALL open the event in the app for members; in a browser it SHALL show the generic landing page. Viewers SHALL see the event and its live changes. Editors SHALL also edit the shared fields, backdrop and audio, and see history. Only the owner SHALL manage links, invites and members, edit owner-only fields and memos, and delete the event. An event SHALL have at most 100 members.

#### Scenario: Viewer tries to edit
- **WHEN** a viewer's client sends an edit
- **THEN** the response is `403 forbidden` and the event is unchanged

#### Scenario: Editor tries to create a link
- **WHEN** an editor's client calls the endpoint that creates a link
- **THEN** the response is `403 forbidden`

#### Scenario: Member link without membership
- **WHEN** a signed-in person who is not a member opens an event's member link in the app
- **THEN** the app says to ask the owner for an invite and shows no event details

### Requirement: Change or remove members
The owner SHALL be able to change a member's role or remove them, and a member SHALL be able to leave. Each change SHALL apply from the member's next request and SHALL reach their open pages and apps as a live change. A removed member SHALL NOT be able to rejoin through any invite until the owner allows them again.

#### Scenario: Remove an editor who has the event open
- **WHEN** the owner removes an editor who has the event open in the app
- **THEN** the editor's app shows that access was removed within 30 seconds and a save from it is rejected

#### Scenario: Removed member reopens an unlimited invite
- **WHEN** a removed member opens an unlimited invite of the same event
- **THEN** they are told to ask the owner and do not rejoin

#### Scenario: Leave
- **WHEN** a viewer chooses "Leave" on a shared event
- **THEN** the event disappears from their app and the owner's member list no longer shows them

### Requirement: Shared field allow-list
Link visitors and members SHALL receive only these event fields: title, emoji, date, time, time zone, unit mode, recurrence, theme, backdrop and audio. Member responses SHALL also include display names of the owner and members. Public link responses SHALL include no names, emails or account identifiers.

#### Scenario: Public link read through the API
- **WHEN** a client reads a public link through the API
- **THEN** the response contains the shared fields and no notes, memos, names, emails or account identifiers

### Requirement: Unknown links look the same
An unknown, malformed or purged link or invite token SHALL produce the same "not found" response, so a visitor cannot tell these cases apart.

#### Scenario: Malformed token
- **WHEN** someone requests a link with a malformed token
- **THEN** the status, headers and body equal those for an unknown well-formed token, apart from the request id

### Requirement: Links open the app when installed
Public links (`/e/{token}`), invites (`/i/{token}`) and member links (`/s/{eventId}`) SHALL open the app on Android and iOS when it is installed. Otherwise a public link SHALL open the event's web page, and invites and member links SHALL open the generic landing page.

#### Scenario: App installed
- **WHEN** a user with the app installed taps a public link in a chat
- **THEN** the app opens the event without a browser step

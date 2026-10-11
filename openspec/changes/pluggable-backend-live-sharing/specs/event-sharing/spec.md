# Delta for Event Sharing

## Purpose

Lets an owner share an event through public read-only links and through one people link that gives named, signed-in people view or edit access.

## ADDED Requirements

### Requirement: Public links
The owner SHALL be able to create up to 10 active public links per event, each with an optional label and an optional expiry of 1 to 365 days. Anyone with a public link SHALL be able to view the event without signing in. Public links SHALL be view only.

#### Scenario: Two public links
- **WHEN** the owner creates a link labelled "Instagram" and another labelled "Family chat"
- **THEN** both URLs open the event in a browser without sign-in and neither offers editing

#### Scenario: Eleventh link
- **WHEN** the owner tries to create an eleventh active public link for one event
- **THEN** the response is `429 quota_exceeded` and the app asks the owner to revoke a link first

### Requirement: Owner sees links on every device
The owner SHALL be able to see and copy the URL of every active link of their event on any device where they are signed in.

#### Scenario: Copy a link on a second device
- **WHEN** an owner who created a link on their phone opens the event's share screen on their tablet
- **THEN** the tablet lists the link and can copy its URL

### Requirement: Revoke a public link
The owner SHALL be able to revoke any public link. A revoked or expired link SHALL show "no longer available" with no event details. Revocation SHALL be permanent and SHALL NOT affect the event's other links.

#### Scenario: Revoke one of two links
- **WHEN** the owner revokes the "Instagram" link
- **THEN** that URL shows "no longer available" on its next load and the "Family chat" link keeps working

### Requirement: People link
Each event SHALL have at most one people link. Only signed-in people with access SHALL see the event through it. A visitor without a session SHALL be asked to sign in. A signed-in visitor without access SHALL be told to ask the owner for an invite. Neither SHALL see event details.

#### Scenario: Not signed in
- **WHEN** someone opens a people link in a browser without a session
- **THEN** the page shows sign-in options and no title, date or backdrop

#### Scenario: Signed in without access
- **WHEN** a signed-in person without access opens the people link
- **THEN** the page says to ask the owner for an invite and shows no event details

### Requirement: Invites
The owner SHALL be able to create an invite with the role viewer or editor. An invite SHALL be single use and SHALL expire 7 days after creation. The first signed-in person who opens and accepts it SHALL get its role. The owner SHALL see who accepted each invite and SHALL be able to cancel unused invites.

#### Scenario: Accept an invite
- **WHEN** a person opens an editor invite, signs in with Apple and accepts
- **THEN** they get editor access, land on the event, and the owner sees their name in the people list

#### Scenario: Invite already used
- **WHEN** a second person opens an invite that was already accepted
- **THEN** the page says the invite was already used and grants nothing

#### Scenario: Invite expired
- **WHEN** someone opens an invite 8 days after it was created
- **THEN** the page says the invite expired and grants nothing

### Requirement: Owner signs in before inviting people
Creating a people link or an invite SHALL require the owner to be signed in with Google or Apple. A guest SHALL be asked to sign in first, which keeps their data as the accounts capability describes.

#### Scenario: Guest taps Invite
- **WHEN** a guest taps "Invite people"
- **THEN** the app asks them to sign in and then continues to the invite

### Requirement: Roles
Viewers SHALL see the event and its live changes. Editors SHALL also edit the shared fields and the backdrop and see history. Only the owner SHALL manage links, invites and people, edit owner-only fields and delete the event. At most 50 people SHALL have access to one event.

#### Scenario: Editor tries to create a link
- **WHEN** an editor's client calls the endpoint that creates a link
- **THEN** the response is `403 forbidden`

#### Scenario: Viewer tries to edit
- **WHEN** a viewer's client sends an edit
- **THEN** the response is `403 forbidden` and the event is unchanged

### Requirement: Change or remove access
The owner SHALL be able to change a person's role or remove them, and a person SHALL be able to leave a shared event. Each change SHALL apply from the person's next request, and their open pages and apps SHALL reflect it as a live change.

#### Scenario: Remove an editor whose page is open
- **WHEN** the owner removes an editor who has the event open on the web
- **THEN** the editor's page shows that access was removed within 30 seconds and a save from it is rejected

#### Scenario: Leave
- **WHEN** a viewer chooses "Leave" on a shared event
- **THEN** the event disappears from their app and the owner's people list no longer shows them

### Requirement: Shared field allow-list
Link visitors and people other than the owner SHALL receive only these event fields: title, emoji, date, time, time zone, unit mode, recurrence, theme and backdrop. People link responses SHALL also include display names of the owner and people with access. Public link responses SHALL include no names, emails or account identifiers.

#### Scenario: Public link read through the API
- **WHEN** a client reads a public link through the API
- **THEN** the response contains the shared fields and no notes, names, emails or account identifiers

### Requirement: Unknown links look the same
An unknown, malformed or purged link or invite token SHALL produce the same "not found" response, so a visitor cannot tell these cases apart.

#### Scenario: Malformed token
- **WHEN** someone requests a link with a malformed token
- **THEN** the status, headers and body equal those for an unknown well-formed token, apart from the request id

### Requirement: Links open the app when installed
Link URLs (`/e/{token}`) and invite URLs (`/i/{token}`) SHALL open the app on Android and iOS when it is installed, and the web page otherwise.

#### Scenario: App installed
- **WHEN** a user with the app installed taps a link in a chat
- **THEN** the app opens the event without a browser step

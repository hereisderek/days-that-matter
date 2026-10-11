# Delta for Share Web

## Purpose

Shows a shared event in any browser with a live countdown and live changes, and lets signed-in editors change it and see its history without the app.

## ADDED Requirements

### Requirement: Page states
The link page SHALL respond with `200` and the event when the visitor may see it, `401` with sign-in options for a people link without a session, `403` with an "ask the owner" message for a signed-in visitor without access, `410` "no longer available" for a revoked, expired or deleted link, and `404` "link not found" otherwise. Only `200` responses SHALL contain event details.

#### Scenario: Expired public link
- **WHEN** a visitor opens a public link that expired yesterday
- **THEN** the response is `410` and the page shows "no longer available" without the title

#### Scenario: Deleted event
- **WHEN** a visitor opens a public link of an event its owner deleted
- **THEN** the response is `410` and the page shows "no longer available"

### Requirement: Countdown matches the app
The page SHALL compute the countdown with the same rules as the app: units, past and future, day of event, recurrence, time zone and floating time. The page and the app SHALL pass the same set of test vectors, generated from the app's countdown engine.

#### Scenario: Yearly event on a daylight saving change
- **WHEN** the page and the app compute a yearly event in `Europe/Paris` on the day clocks change
- **THEN** both show the same target instant and the same breakdown

### Requirement: Live changes without reload
An open page SHALL show changes to the event and loss of access without a reload: within 5 seconds in `ws` mode and within 30 seconds in `poll` mode. A hidden page SHALL stop listening and SHALL catch up when it becomes visible again.

#### Scenario: Owner edits the title
- **WHEN** a visitor has a public link page open and the owner changes the title
- **THEN** the page shows the new title without a reload

#### Scenario: Link revoked while open
- **WHEN** the owner revokes a link while a visitor has its page open
- **THEN** the page switches to "no longer available"

#### Scenario: Tab in the background
- **WHEN** a page has been hidden for an hour and the event changed meanwhile
- **THEN** it made no requests while hidden and shows the current event as soon as it is visible

### Requirement: Web sign-in for people links and invites
People link and invite pages SHALL offer Sign in with Google and Sign in with Apple and SHALL return the visitor to the same page after sign-in. A signed-in visitor SHALL be able to sign out from the page.

#### Scenario: Accept an invite on the web
- **WHEN** a visitor opens an invite link, signs in with Google and accepts
- **THEN** the browser shows the event through the people link with the invited role

### Requirement: Editing on the web
Editors SHALL be able to edit the shared fields and set, replace or remove the backdrop from the page. Invalid input SHALL show an error next to the field. Saved changes SHALL reach other open pages and apps as live changes.

#### Scenario: Editor changes the date
- **WHEN** an editor changes the date on the web and saves
- **THEN** the countdown on the page updates and the owner's app shows the new date

### Requirement: History on the web
Owners and editors SHALL be able to open the event's history from the page, see the author, time and changed fields of each revision, and restore one.

#### Scenario: Restore from the web
- **WHEN** an editor restores an earlier revision from the page
- **THEN** the page and every other open page show the restored values

### Requirement: Link previews
Public link pages SHALL carry preview tags with the title, a countdown summary and the backdrop's still image, or a default image when there is no backdrop. People link and invite pages SHALL carry only generic preview tags with no event details.

#### Scenario: People link pasted in a chat
- **WHEN** a people link is pasted into a messaging app
- **THEN** the preview shows the app name and the default image, not the event title

#### Scenario: Public link with a photo
- **WHEN** a public link of an event with a photo backdrop is pasted into a messaging app
- **THEN** the preview shows the title, the countdown summary and the photo

### Requirement: Page privacy and security
Share pages SHALL NOT be indexed by search engines, SHALL NOT load third-party scripts, fonts or analytics, SHALL send no referrer, and SHALL use a strict content security policy. User text SHALL never run as code.

#### Scenario: Script in a title
- **WHEN** an event title contains `</title><script>alert(1)</script>`
- **THEN** the page shows the text literally and no script runs

### Requirement: Open in app
On iOS and Android the page SHALL offer to open the event in the app, or to install the app. On desktop the page SHALL show the event without app banners.

#### Scenario: Android visitor without the app
- **WHEN** an Android visitor without the app opens a public link
- **THEN** the page shows the event and a banner linking to Google Play

### Requirement: Accessible page
The page SHALL work with screen readers, keyboard navigation and 200% zoom, keep text contrast at 4.5:1 or more over backdrops, and honour reduced motion.

#### Scenario: Screen reader
- **WHEN** a screen reader user opens the page
- **THEN** it reads the title and a countdown summary that updates at most once a minute

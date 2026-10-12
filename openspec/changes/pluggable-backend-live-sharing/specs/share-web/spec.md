# Delta for Share Web

## Purpose

Shows an event shared through a public link in any browser, with a live countdown and live changes. Invite and member links lead to the app. The web is read-only: no sign-in, editing, history or joining.

## ADDED Requirements

### Requirement: Page states
The public link page SHALL respond with `200` and the event when the link is active, `410` "no longer available" for a revoked, expired or deleted link or event, and `404` "link not found" otherwise. Only `200` responses of the public link page SHALL contain event details. Invite and member pages SHALL always respond with `200` and the generic landing page (requirement "Invite and member landing pages").

#### Scenario: Expired public link
- **WHEN** a visitor opens a public link that expired yesterday
- **THEN** the response is `410` and the page shows "no longer available" without the title

#### Scenario: Member link in a browser
- **WHEN** someone opens a member link in a browser
- **THEN** the response is `200` with the generic "Open in the app" page and no event details

### Requirement: Countdown matches the app
The page SHALL compute the countdown with the same rules as the app: units, past and future, day of event, recurrence, time zone and floating time. The page and the app SHALL pass the same set of test vectors, generated from the app's countdown engine.

#### Scenario: Yearly event on a daylight saving change
- **WHEN** the page and the app compute a yearly event in `Europe/Paris` on the day clocks change
- **THEN** both show the same target instant and the same breakdown

### Requirement: Live changes without reload
An open page SHALL show changes to the event, and loss of access, without a reload: within 5 seconds in `ws` mode and within 30 seconds in `poll` mode. A hidden page SHALL stop listening and SHALL catch up when it becomes visible again.

#### Scenario: Owner edits the title
- **WHEN** a visitor has a public link page open and the owner changes the title
- **THEN** the page shows the new title without a reload

#### Scenario: Link revoked while open
- **WHEN** the owner revokes a public link while a visitor has its page open
- **THEN** the page switches to "no longer available"

#### Scenario: Tab in the background
- **WHEN** a page has been hidden for an hour and the event changed meanwhile
- **THEN** it made no requests while hidden and shows the current event as soon as it is visible

### Requirement: Web pages are read-only
Share web pages SHALL NOT offer sign-in, joining, editing or history, and SHALL NOT set cookies. Sign-in, joining, editing and history SHALL happen in the app.

#### Scenario: No cookies
- **WHEN** a visitor opens a public link page, an invite page or a member page
- **THEN** no response sets a cookie and no page shows a sign-in option

### Requirement: Invite and member landing pages
In a browser, an invite link SHALL show a generic page that says "You're invited to a day in Days That Matter. Open it in the app to join.", with a button that opens the app and links to the app stores of the deployment's region. A member link SHALL show a generic "Open in the app" page with the same buttons. These pages SHALL show no event details and SHALL be identical for every token or event id, valid or not, apart from the request id.

#### Scenario: Invite opened on a desktop browser
- **WHEN** someone opens a valid invite link in a desktop browser
- **THEN** the page shows the generic invite text and store links, and no event name, owner name or role

#### Scenario: Unknown invite token
- **WHEN** someone opens an invite link with an unknown token in a browser
- **THEN** the response equals the response for a valid invite, apart from the request id

### Requirement: Audio on the page
When the event has a built-in track, the page SHALL show a play button and SHALL NOT start audio on its own. When the event has a Spotify link, the page SHALL show its name and a "Listen on Spotify" link and SHALL NOT load Spotify content. A custom audio file SHALL NOT be offered on any web page.

#### Scenario: Built-in Premium track on a public link
- **WHEN** a visitor without an account opens a public link of an event with a Premium built-in track and taps play
- **THEN** the track plays

#### Scenario: Custom audio on a public link
- **WHEN** a visitor opens a public link of an event with a custom audio file
- **THEN** the page shows no audio player

### Requirement: Link previews
Public link pages SHALL carry preview tags with the title, a countdown summary and the backdrop's still image, or a default image when there is no backdrop. Invite and member pages SHALL carry only generic preview tags with no event details.

#### Scenario: Invite pasted in a chat
- **WHEN** an invite link is pasted into a messaging app
- **THEN** the preview shows the app name and the default image, not the event title

#### Scenario: Public link with a photo
- **WHEN** a public link of an event with a photo backdrop is pasted into a messaging app
- **THEN** the preview shows the title, the countdown summary and the photo

### Requirement: Page privacy and security
Share pages SHALL NOT be indexed by search engines, SHALL NOT load third-party scripts, fonts, frames or analytics, SHALL send no referrer, and SHALL use a strict content security policy. User text SHALL never run as code.

#### Scenario: Script in a title
- **WHEN** an event title contains `</title><script>alert(1)</script>`
- **THEN** the page shows the text literally and no script runs

### Requirement: Open in app
On iOS and Android the public link page SHALL offer to open the event in the app, or to install the app. On desktop it SHALL show the event without app banners.

#### Scenario: Android visitor without the app
- **WHEN** an Android visitor without the app opens a public link
- **THEN** the page shows the event and a banner linking to the app store of the deployment's region

### Requirement: Accessible page
The page SHALL work with screen readers, keyboard navigation and 200% zoom, keep text contrast at 4.5:1 or more over backdrops, and honour reduced motion.

#### Scenario: Screen reader
- **WHEN** a screen reader user opens the page
- **THEN** it reads the title and a countdown summary that updates at most once a minute

# Delta for Notifications

## Purpose

Tells people about their days: reminders scheduled on the device, push notifications about shared days, and offers and news only for people who opt in.

## ADDED Requirements

### Requirement: Notification kinds and switches
The app SHALL support these kinds: reminders for a day, changes to shared days, added to a day, and offers and news. More kinds MAY be added later. Settings SHALL have one switch per kind, per device. A device SHALL get no notification of a kind that is switched off on it.

#### Scenario: Changes switched off
- **WHEN** a user turns off "Changes to shared days" on their phone and an editor changes a day they own
- **THEN** the phone shows no notification, and their tablet, where the switch is on, shows one

### Requirement: Reminders
For each day, the user SHALL be able to choose reminders on the day, 1 day before and 1 week before, delivered at 9:00 local time by default. Reminders SHALL be scheduled on the device as local notifications, so they work offline. They SHALL apply to the next occurrence of a repeating day; a one-time day that has passed SHALL send none. Reminder choices SHALL be personal and SHALL sync to the person's devices.

#### Scenario: Reminder without a network
- **WHEN** a user set a reminder 1 day before a day and their phone is offline the day before
- **THEN** the reminder appears at 9:00 local time

#### Scenario: Yearly day
- **WHEN** a yearly birthday has a reminder on the day and this year's birthday has passed
- **THEN** the next reminder is on next year's birthday at 9:00

#### Scenario: Member's reminder
- **WHEN** a member sets a reminder on a day shared with them
- **THEN** the owner and the other members get no reminder from that choice

### Requirement: Reminders on iOS stay within 64 pending
On iOS the app SHALL keep at most 64 pending local notifications, scheduling the nearest reminders first, and SHALL refill them on app start and on background refresh.

#### Scenario: Many reminders
- **WHEN** a user has 40 days with 3 reminders each on iOS
- **THEN** the nearest 64 reminders are scheduled, and later ones are scheduled as earlier ones pass

### Requirement: Changes to shared days
When someone else changes a day the user owns or is a member of, the backend SHALL send the user a push notification that names the editor and the changed field. It SHALL send at most one notification per day per user per hour. The author of the change SHALL get none.

#### Scenario: Editor changes the date
- **WHEN** Mum, an editor, changes the date of "Grandma's 90th"
- **THEN** the owner and the other members get a notification naming Mum and the date, and Mum gets none

#### Scenario: Several changes in an hour
- **WHEN** an editor makes three changes to the same day within 10 minutes
- **THEN** each other person gets one notification for that day in that hour

### Requirement: Added to a day
When another person adds the user to a day, the backend SHALL send the user a push notification that names the person and the day.

#### Scenario: Added to a day
- **WHEN** another person adds the user to a day
- **THEN** the user gets a notification naming that person and the day

### Requirement: Offers and news
Offers and news (for example, free Premium for a month) SHALL be sent only to devices whose user turned them on. The switch SHALL be off by default. A device SHALL get at most 2 offers and news notifications per month.

#### Scenario: Default
- **WHEN** a user installs the app and never opens notification settings
- **THEN** they get no offers or news

#### Scenario: Monthly cap
- **WHEN** the operator sends a third offer in one month
- **THEN** devices that already got 2 that month do not get it

### Requirement: Permission prompt
The system notification permission prompt SHALL appear when the user first sets a reminder or first shares a day, and SHALL NOT appear at launch.

#### Scenario: First launch
- **WHEN** a user opens the app for the first time
- **THEN** no notification permission prompt appears

#### Scenario: First reminder
- **WHEN** a user sets their first reminder
- **THEN** the system permission prompt appears

### Requirement: Quiet archived days and private content
Archived days SHALL send no reminders and no change notifications to the person who archived them. Notification content SHALL never include notes or memo text.

#### Scenario: Archived shared day
- **WHEN** a member archived a shared day and an editor changes it
- **THEN** that member gets no notification

#### Scenario: Day with notes and memos
- **WHEN** a notification is sent about a day with notes and memos
- **THEN** its text contains neither the notes nor any memo text

### Requirement: Device registration
A signed-in app SHALL register its device with the backend (`PUT /me/devices/{installId}`) with the platform, push token, locale, time zone and enabled kinds, and SHALL unregister on sign-out. The backend SHALL remove a device's push token on sign-out, when the push service reports the token invalid, or after 90 days unused. Guests SHALL register nothing and SHALL get local reminders only.

#### Scenario: Sign out
- **WHEN** a user signs out on their phone
- **THEN** the phone gets no more push notifications for that account

#### Scenario: Unused device
- **WHEN** a registered device has not contacted the backend for 90 days
- **THEN** its token is removed and nothing more is sent to it

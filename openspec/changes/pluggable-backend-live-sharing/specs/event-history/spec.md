# Delta for Event History

## Purpose

Shows owners and editors who changed what in an event and when, and lets them go back to an earlier version.

## ADDED Requirements

### Requirement: Every change is a revision
Every accepted change to an event stored on the backend SHALL create a revision with a revision number, the author, the time, and for each changed field the old and the new value.

#### Scenario: Two fields in one save
- **WHEN** an editor saves a new date and a new theme in one save
- **THEN** one new revision lists both fields with old and new values and names the editor as author

### Requirement: Who can see history
The owner and editors SHALL be able to see an event's history in the app and on the web. Viewers and link visitors SHALL NOT see history. Changes to owner-only fields SHALL appear only in the owner's view of history.

#### Scenario: Viewer
- **WHEN** a viewer opens a shared event
- **THEN** no history option is shown, and a direct request for history returns `403 forbidden`

#### Scenario: Owner edits notes
- **WHEN** the owner changes the notes of a shared event
- **THEN** the owner sees that change in history and editors see no entry for it

### Requirement: Restore a revision
The owner or an editor SHALL be able to restore the shared fields of an event to their values at a chosen revision. A restore SHALL create a new revision and SHALL keep all existing revisions.

#### Scenario: Restore an earlier revision
- **WHEN** an editor restores revision 4 of an event that is at revision 9
- **THEN** the shared fields equal those of revision 4, revision 10 records the restore, and revisions 5 to 9 stay in history

### Requirement: Retention
The backend SHALL keep at least the 200 most recent revisions of each event and SHALL delete an event's history together with the event. Revisions older than the latest 200 can be removed.

#### Scenario: Event with 250 revisions
- **WHEN** an event reaches revision 250
- **THEN** revisions 51 to 250 are available in history

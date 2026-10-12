# Delta for Event Audio

## Purpose

Lets an event have background music: a built-in track served by the backend, a custom audio file from the account's library on a paid plan, or a link to Spotify, with a few free choices and the rest on paid plans.

## ADDED Requirements

### Requirement: Audio choices
An event SHALL have at most one audio choice: a built-in track, a custom audio file, or a Spotify link. Spotify links SHALL be offered only where the deployment enables them.

#### Scenario: Replace a track with a Spotify link
- **WHEN** an owner with a built-in track on an event links a Spotify playlist instead
- **THEN** the event has only the Spotify link

### Requirement: Built-in track catalog
The app SHALL list the built-in tracks from the backend with title, artist, duration and whether each is free or Premium. Every user SHALL be able to preview any track. The catalog SHALL be updated without an app release.

#### Scenario: Browse the catalog
- **WHEN** a free user opens the audio picker
- **THEN** free tracks are selectable and Premium tracks show a Premium badge and can be previewed

### Requirement: Premium tracks
Saving a Premium track SHALL require the plan of the user saving it to include Premium tracks. Otherwise the app SHALL show the paywall and the backend SHALL reject the change with `402 premium_required`. Anyone who can see an event SHALL be able to play its built-in track, whatever their plan.

#### Scenario: Free editor picks a Premium track
- **WHEN** a free editor selects a Premium track on a Premium owner's event and taps Save
- **THEN** the paywall appears and the event keeps its previous audio

#### Scenario: Viewer plays a Premium track
- **WHEN** a free viewer opens an event whose Premium owner set a Premium track
- **THEN** the track plays

#### Scenario: Track file requested directly
- **WHEN** a client without Premium requests a Premium track file without naming an event it can see
- **THEN** the response is `402 premium_required`

### Requirement: Custom audio files
A user SHALL be able to pick an audio file from the device in the audio picker's "My library" tab. The app SHALL convert it to AAC of at most 4 MB; for a longer file, the user SHALL pick the section to keep. Saving a custom audio file on a day SHALL require the plan of the user saving it to include custom audio (premium), also when the file is already in their library. Free users and users whose plan ended SHALL be able to pick and preview, and SHALL see the paywall on save.

#### Scenario: Premium user adds a song
- **WHEN** a Premium user picks a 9 MB MP3 of 7 minutes
- **THEN** the app asks which part to keep and uploads an AAC file of at most 4 MB

#### Scenario: Free user picks a file
- **WHEN** a free user picks an audio file and taps Save
- **THEN** the paywall appears and the event keeps its previous audio

#### Scenario: Lapsed user reuses a library file
- **WHEN** a user whose Premium ended picks a file already in their library for another day and taps Save
- **THEN** the paywall appears, the other day keeps its previous audio, and days that already use the file keep playing it

### Requirement: Custom audio library
Each account SHALL have a library of the custom audio files it added. Under "Pick an audio file", the "My library" tab SHALL list them newest first, each with title, duration, the number of days using it ("used on N days"), a preview button and a remove button (×). Tapping a file SHALL use it on the day being edited. The library SHALL belong to the uploading account, SHALL be the same on all its signed-in devices, and SHALL NOT be shown to anyone else.

#### Scenario: Reuse a file on another day
- **WHEN** a Premium user who added a song for one day opens "My library" while editing another day and taps the song
- **THEN** the second day uses the same file, nothing is uploaded, and the library shows "used on 2 days"

#### Scenario: Library on a second device
- **WHEN** a user who added a file on their phone opens "My library" on their tablet
- **THEN** the tablet lists the file

#### Scenario: Member's view
- **WHEN** an editor opens "My library" on a day shared with them
- **THEN** the list shows only the editor's own files, never the owner's or another member's

### Requirement: Removing a file from the library
Removing a file SHALL only hide it from the library: every day that uses it SHALL keep playing it for its owner and members. A file SHALL be deleted 24 hours after it is both out of the library and used by no day. For the plan table, a custom audio file SHALL count while it is in the uploader's library or used by a day, so removing it SHALL free its slot only when no day uses it. The app SHALL say so.

#### Scenario: Remove a file that days still use
- **WHEN** a Premium user removes a file from the library while 2 days use it
- **THEN** the file leaves the library, both days keep playing it, the app says the slot stays taken while days use it, and the file still counts toward the limit

#### Scenario: Remove an unused file
- **WHEN** a Premium user at 20 files in use removes a file that no day uses
- **THEN** the slot is free at once, a new file can be added, and the removed file is deleted within 24 hours

### Requirement: Reporting custom audio
Everyone who can play a custom audio file SHALL be able to report it. After the operator removes a reported file, it SHALL stop playing for everyone within 24 hours, and the event SHALL show no audio. An account that the operator blocked for repeated copyright reports SHALL get `403 forbidden` on audio uploads. Uploads SHALL NOT ask for a rights confirmation; the terms of service cover it (accounts spec).

#### Scenario: Takedown
- **WHEN** the operator removes a custom audio file after a valid copyright notice
- **THEN** within 24 hours the file no longer plays in any app or page, and the event shows no audio

#### Scenario: Blocked uploader
- **WHEN** an account blocked for repeated copyright reports uploads an audio file
- **THEN** the response is `403 forbidden` and the app says audio uploads are disabled for the account

### Requirement: Who hears custom audio
A custom audio file SHALL play in the app for the owner and the members of each day that uses it, and for the uploader in their library. It SHALL NOT be offered on any web page.

#### Scenario: Member hears it
- **WHEN** a viewer member opens an event with a custom audio file
- **THEN** the file plays in their app

### Requirement: Spotify links
A user SHALL be able to link a Spotify track, album or playlist by sharing it from Spotify to the app or pasting its link. The app SHALL show its name and artist without asking the user to sign in to Spotify. "Open in Spotify" SHALL play the full item in Spotify, in the Spotify app when installed and on the Spotify website otherwise. Spotify links SHALL NOT be added to the custom audio library.

#### Scenario: Share from Spotify
- **WHEN** a user shares a playlist from the Spotify app to Days That Matter and picks an event
- **THEN** the event shows the playlist name, and "Open in Spotify" opens the playlist in Spotify

#### Scenario: Not a Spotify link
- **WHEN** a user pastes a link that is not a Spotify track, album or playlist
- **THEN** the app says the link is not supported and saves nothing

### Requirement: Spotify previews
Where Spotify offers a supported way to do so, the app SHALL play a short preview (about 30 seconds) of a linked Spotify item inside the app: the track, or the first track of an album or playlist. Where no supported preview exists, playing SHALL open Spotify.

#### Scenario: Preview in the app
- **WHEN** a user taps play on a day linked to a Spotify track and Spotify allows a preview of it
- **THEN** about 30 seconds of the track play inside the app without a Spotify sign-in

#### Scenario: No preview available
- **WHEN** a user taps play on a day whose Spotify item has no supported preview
- **THEN** the app opens the item in Spotify

### Requirement: Spotify limit on the free plan
A free user SHALL be able to set Spotify links on at most 3 events, counting the events where that user set the link. Premium SHALL have no separate Spotify limit. Adding a fourth SHALL show the paywall, and the backend SHALL reject it with `402 premium_required`.

#### Scenario: Fourth Spotify event
- **WHEN** a free user who set Spotify links on 3 events links Spotify on a fourth
- **THEN** the paywall appears and the fourth event keeps its previous audio

### Requirement: Playback in the app
The app SHALL play built-in tracks and custom audio with loop, fade and volume controls from the media spec, and SHALL cache downloaded files so they play offline afterwards.

#### Scenario: Offline replay
- **WHEN** a user opens an event offline whose track played once before
- **THEN** the track plays from the cache

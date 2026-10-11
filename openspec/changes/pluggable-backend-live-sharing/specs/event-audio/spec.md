# Delta for Event Audio

## Purpose

Lets an event have background music: a built-in track served by the backend, a custom audio file on a paid plan, or a link to Spotify, with a few free choices and the rest on paid plans.

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
A user whose plan includes custom audio SHALL be able to pick an audio file from the device. The app SHALL convert it to AAC of at most 4 MB; for a longer file, the user SHALL pick the section to keep. The number of custom audio files in use SHALL follow the plan table. Free users SHALL see the paywall on save.

#### Scenario: Premium user adds a song
- **WHEN** a Premium user picks a 9 MB MP3 of 7 minutes
- **THEN** the app asks which part to keep and uploads an AAC file of at most 4 MB

#### Scenario: Free user picks a file
- **WHEN** a free user picks an audio file and taps Save
- **THEN** the paywall appears and the event keeps its previous audio

### Requirement: Reporting custom audio
Everyone who can play a custom audio file SHALL be able to report it. After the operator removes a reported file, it SHALL stop playing for everyone within 24 hours, and the event SHALL show no audio. An account that the operator blocked for repeated copyright reports SHALL get `403 forbidden` on audio uploads. Uploads SHALL NOT ask for a rights confirmation; the terms of service cover it (accounts spec).

#### Scenario: Takedown
- **WHEN** the operator removes a custom audio file after a valid copyright notice
- **THEN** within 24 hours the file no longer plays in any app or page, and the event shows no audio

#### Scenario: Blocked uploader
- **WHEN** an account blocked for repeated copyright reports uploads an audio file
- **THEN** the response is `403 forbidden` and the app says audio uploads are disabled for the account

### Requirement: Who hears custom audio
A custom audio file SHALL play for the owner and the event's members. It SHALL NOT be offered to public link visitors.

#### Scenario: Member hears it
- **WHEN** a viewer member opens an event with a custom audio file
- **THEN** the file plays in their app

### Requirement: Spotify links
A user SHALL be able to link a Spotify track, album or playlist by sharing it from Spotify to the app or pasting its link. The app SHALL show its name and artist without asking the user to sign in to Spotify. Playing it SHALL open Spotify, in the Spotify app when installed and on the Spotify website otherwise.

#### Scenario: Share from Spotify
- **WHEN** a user shares a playlist from the Spotify app to Days That Matter and picks an event
- **THEN** the event shows the playlist name, and tapping play opens the playlist in Spotify

#### Scenario: Not a Spotify link
- **WHEN** a user pastes a link that is not a Spotify track, album or playlist
- **THEN** the app says the link is not supported and saves nothing

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

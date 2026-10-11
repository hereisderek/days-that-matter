# Delta for Event Audio

## Purpose

Lets an event have background music, either a built-in track served by the backend or a link to Spotify, with a few free choices and the rest on Premium.

## ADDED Requirements

### Requirement: Audio choices
An event SHALL have at most one audio choice: a built-in track or a Spotify link. Picking audio files from the device SHALL NOT be offered.

#### Scenario: Replace a track with a Spotify link
- **WHEN** an owner with a built-in track on an event links a Spotify playlist instead
- **THEN** the event has only the Spotify link

### Requirement: Built-in track catalog
The app SHALL list the built-in tracks from the backend with title, artist, duration and whether each is free or Premium. Every user SHALL be able to listen to a preview of any track. The catalog SHALL be the same for every provider and SHALL be updated without an app release.

#### Scenario: Browse the catalog
- **WHEN** a free user opens the audio picker
- **THEN** free tracks are selectable and Premium tracks show a Premium badge and can be previewed

### Requirement: Premium tracks
Saving a Premium track on an event SHALL require the event owner's plan to include Premium tracks. Otherwise the app SHALL show the paywall, and the backend SHALL reject the change with `402 premium_required`. Anyone who can see an event SHALL be able to play its track, whatever their plan.

#### Scenario: Free owner picks a Premium track
- **WHEN** a free owner selects a Premium track and taps Save
- **THEN** the paywall appears and the event keeps its previous audio

#### Scenario: Viewer plays a Premium track
- **WHEN** a free viewer opens an event whose Premium owner set a Premium track
- **THEN** the track plays

#### Scenario: Track file requested directly
- **WHEN** a client without Premium requests a Premium track file without naming an event it can see
- **THEN** the response is `402 premium_required`

### Requirement: Spotify links
A user SHALL be able to link a Spotify track, album or playlist by sharing it from Spotify to the app or pasting its link. The app SHALL show its name and artist without asking the user to sign in to Spotify. Playing it SHALL open Spotify, in the Spotify app when installed and on the Spotify website otherwise.

#### Scenario: Share from Spotify
- **WHEN** a user shares a playlist from the Spotify app to Days That Matter and picks an event
- **THEN** the event shows the playlist name, and tapping play opens the playlist in Spotify

#### Scenario: Not a Spotify link
- **WHEN** a user pastes a link that is not a Spotify track, album or playlist
- **THEN** the app says the link is not supported and saves nothing

### Requirement: Spotify limit on the free plan
An owner on the free plan SHALL be able to have Spotify links on at most 3 of their events. Premium SHALL have no limit. Adding a fourth SHALL show the paywall, and the backend SHALL reject it with `402 premium_required`.

#### Scenario: Fourth Spotify event
- **WHEN** a free owner with Spotify links on 3 events links Spotify on a fourth
- **THEN** the paywall appears and the fourth event keeps its previous audio

### Requirement: Playback in the app
The app SHALL play built-in tracks with loop, fade and volume controls from the media spec, and SHALL cache downloaded tracks so they play offline afterwards.

#### Scenario: Offline replay
- **WHEN** a user opens an event offline whose track played once before
- **THEN** the track plays from the cache

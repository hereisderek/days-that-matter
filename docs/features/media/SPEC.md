# Feature Specification: Media & Background Audio

Normative requirements: the [`event-audio`](../../../openspec/changes/pluggable-backend-live-sharing/specs/event-audio/spec.md) spec. Plans: [`premium/SPEC.md`](../premium/SPEC.md).

## 1. Overview & Goals
Events can have background music for emotional depth: a built-in track served by our backend, a custom audio file from the account's library (Premium), or a link to Spotify. Audio is a shared field, so members and link visitors can play it too, except custom audio, which plays in the app for the owner and members only.

---

## 2. Audio Sources

### 2.1 Built-in Tracks
- Catalog served by the backend (`GET /api/v1/audio/catalog`): id, title, artist, duration, tier. The catalog changes with a backend deploy, not an app release.
- A handful of tracks are free (initial catalog: 5); the rest need Premium on the plan of the person saving them. Any track can be previewed.
- Files: AAC (`.m4a`), at most 4 MB. Downloaded through `GET /api/v1/audio/{trackId}`, which checks access, then cached on the device for offline playback.
- Anyone who can see an event can play its track, whatever their own plan.
- Tracks are public domain recordings.

### 2.2 Spotify Links
- The user shares a Spotify track, album or playlist from the Spotify app to Days That Matter (Android share intent, iOS share extension), or pastes its `open.spotify.com` link.
- The app reads the title and artist from Spotify's public oEmbed endpoint. No Spotify sign-in.
- **Preview (assumption, must be checked during implementation, task 7.9):** the app plays a short preview (about 30 seconds) of the linked track inside the app where Spotify allows it. For albums and playlists the preview is the first track (also an assumption). "Open in Spotify" plays the full item: the Spotify app when installed, the Spotify website otherwise.
  - Known facts for the check: Spotify's Web API stopped returning `preview_url` for new apps in November 2024. Spotify's embed player (iFrame) plays previews to listeners who are not logged in.
  - If no supported way exists, playing only opens Spotify.
- No full-track playback in the app: Spotify's Web API and SDK access is limited to a few allowlisted users unless an app has 250,000 monthly users, and on-demand playback needs Spotify Premium.
- The share web page shows "Listen on Spotify" and loads no Spotify content.
- Spotify links are never added to the custom audio library.
- Free plan: Spotify links on up to 5 events (counted for the person who set them). Premium: no separate limit.
- Hidden in regions where Spotify is unavailable (China).

### 2.3 Custom Audio Files (Premium)
- Picked from the device with `FileKit` (MP3, M4A, AAC, WAV and other formats the platform decodes).
- Converted on the device to AAC (`.m4a`) of at most 4 MB: about 5.5 minutes at 96 kbps. For a longer file the user picks the section to keep.
- Uploaded to the account's library through `POST /api/v1/me/library`, not to one event. A day then uses a library file. Served only through the access-checked audio route: to the uploader, and to the owner and members of days that use it. Never on any web page (copyright risk of publishing user-uploaded music).
- **Library ("My library" tab):** "Pick an audio file" at the top; below it the account's files, newest first, each with title, duration, "used on N days", a preview button, tap to use on this day, and an × at the right that removes it from the library.
  - Removing only hides the file from the list. It stays on the backend and keeps playing on every day that uses it, for the owner and members of those days. It is deleted 24 hours after it is both out of the library and used by no day.
  - The library belongs to the uploading account and syncs across its devices (`GET /api/v1/me/library`). Members never see another person's library.
- Premium: up to 20 custom audio files in use. A file counts while it is in the library or used by a day, so removing it frees the slot only when no day uses it; the app says so. Free users, and users whose plan ended, can pick and preview; saving a custom file on a day shows the paywall, also for a file already in their library. Limits: [`premium/SPEC.md`](../premium/SPEC.md).
- Copyright: the terms of service, accepted at sign-up, say users may only upload audio and photos they own or have the rights to use; there is no prompt on each upload. Every custom audio file has a Report button; removed files stop playing within 24 hours; repeat offenders lose audio uploads (design D15, [`docs/legal/`](../../legal/README.md)).

---

## 3. Playback Engine (built-in tracks and custom audio)

### 3.1 Features
- **Looping:** Seamless infinite looping option.
- **Fade Transitions:** Smooth 1.5-second fade-in on start and fade-out on pause/exit to avoid abrupt audio cuts.
- **App Lifecycle Awareness:** Automatically pauses audio when the app is placed in the background (or provides toggle for background audio continuation).
- **Mute / Volume Control:** Global mute toggle and per-event volume slider. Loop, volume and mute are local settings, not synced.

### 3.2 Common Interface
```kotlin
package dev.derek.daysthatmatter.features.media.domain.service

interface AudioPlayer {
    val isPlaying: StateFlow<Boolean>
    val playbackPosition: StateFlow<Long>
    val duration: StateFlow<Long>

    suspend fun load(sourceUri: String): Result<Unit>
    fun play()
    fun pause()
    fun seekTo(positionMs: Long)
    fun setVolume(volume: Float) // 0.0 to 1.0
    fun release()
}
```

### 3.3 Platform Implementations
- **Android:** AndroidX Media3 / `ExoPlayer`.
- **iOS:** `AVAudioPlayer` / `AVPlayer` with audio session category management.
- **Web share page:** HTML5 `<audio>`, started only by a tap.

---

## 4. UI/UX Flow & Screen Elements

### 4.1 Audio Controller Overlay (`EventDetailScreen`)
- Subtle circular music disc / vinyl icon at the top right of the event detail view.
- Built-in track: spinning animation during playback with visual audio wave bars; tap toggles play/pause with a quick volume slider.
- Spotify link: shows the title, a play button for the in-app preview where Spotify allows it, and "Open in Spotify".

### 4.2 Audio Selection Sheet
- Tab "Built-in": the catalog with preview buttons; Premium tracks carry a Premium badge. Saving one without Premium shows the paywall.
- Tab "My library": "Pick an audio file" (preview, trim to a section if it is long), then the library list (section 2.3). Saving without Premium shows the paywall.
- Tab "Spotify": paste a link, or instructions to share from Spotify. A fourth Spotify event on the free plan shows the paywall.
- Remove / detach audio option.

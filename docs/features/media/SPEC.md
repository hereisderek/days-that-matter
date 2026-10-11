# Feature Specification: Media & Background Audio

Normative requirements: the [`event-audio`](../../../openspec/changes/pluggable-backend-live-sharing/specs/event-audio/spec.md) spec. Plans: [`premium/SPEC.md`](../premium/SPEC.md).

## 1. Overview & Goals
Events can have background music for emotional depth: a built-in track served by our backend, a custom audio file (Premium), or a link to Spotify. Audio is a shared field, so members and link visitors can play it too, except custom audio, which plays for the owner and members only.

---

## 2. Audio Sources

### 2.1 Built-in Tracks
- Catalog served by the backend (`GET /api/v1/audio/catalog`): id, title, artist, duration, tier. The catalog changes with a backend deploy, not an app release.
- A handful of tracks are free (initial catalog: 5); the rest need Premium on the plan of the person saving them. Any track can be previewed.
- Files: AAC (`.m4a`), at most 4 MB. Downloaded through `GET /api/v1/audio/{trackId}`, which checks access, then cached on the device for offline playback.
- Anyone who can see an event can play its track, whatever their own plan.
- Every track must be free to use worldwide: a CC0 or public domain **recording** (a public domain composition is not enough, the recording can still be protected) or a royalty-free licence for app use. `catalog.json` records `license` and `source` per track.

### 2.2 Spotify Links
- The user shares a Spotify track, album or playlist from the Spotify app to Days That Matter (Android share intent, iOS share extension), or pastes its `open.spotify.com` link.
- The app reads the title and artist from Spotify's public oEmbed endpoint. No Spotify sign-in.
- Playing opens Spotify: the Spotify app when installed, the Spotify website otherwise. There is no in-app Spotify playback: Spotify's Web API and SDK access is limited to a few allowlisted users unless an app has 250,000 monthly users, and on-demand playback needs Spotify Premium.
- Free plan: Spotify links on up to 3 events (counted for the person who set them). Premium: no separate limit.
- Hidden in regions where Spotify is unavailable (China).

### 2.3 Custom Audio Files (Premium)
- Picked from the device with `FileKit` (MP3, M4A, AAC, WAV and other formats the platform decodes).
- Converted on the device to AAC (`.m4a`) of at most 4 MB: about 5.5 minutes at 96 kbps. For a longer file the user picks the section to keep.
- Uploaded through `POST /api/v1/events/{id}/media` (kind `audio`) and served only through the access-checked audio route, to the owner and members. Never on public link pages (copyright risk of publishing user-uploaded music).
- Premium: up to 20 custom audio files in use. Free: preview only, paywall on save. Limits: [`premium/SPEC.md`](../premium/SPEC.md).
- Copyright: before the first upload the user confirms they have the rights. Every custom audio file has a Report button; removed files stop playing within 24 hours; repeat offenders lose audio uploads (design D15).

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
- Spotify link: shows the title and a Spotify button that opens Spotify.

### 4.2 Audio Selection Sheet
- Tab "Built-in": the catalog with preview buttons; Premium tracks carry a Premium badge. Saving one without Premium shows the paywall.
- Tab "My files": pick a file, preview, trim to a section if it is long. Saving without Premium shows the paywall.
- Tab "Spotify": paste a link, or instructions to share from Spotify. A fourth Spotify event on the free plan shows the paywall.
- Remove / detach audio option.

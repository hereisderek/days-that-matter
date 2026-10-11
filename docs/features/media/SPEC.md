# Feature Specification: Media & Background Audio

## 1. Overview & Goals
Enables users to attach ambient music or nostalgic sound clips to their milestone events. When viewing an event, the music provides emotional depth and immersion.

---

## 2. Capabilities & Constraints

### 2.1 Supported Formats & File Limits
- **Formats:** `.mp3`, `.m4a`, `.aac`, `.ogg`.
- **Max File Size:** 10 MB per audio track.
- **Audio Picking:** Handled via multiplatform `FileKit` with platform-native file choosers.

### 2.2 Storage & Upload Pipeline
- Selected audio files are copied to app cache directory.
- Audio stays on the device in this phase. It is not synced and never shared. Syncing audio through the backend needs a larger upload path than the 4 MB backend limit (see [`BACKEND.md`](../../architecture/BACKEND.md) section 11) and is planned separately.
- Offline playback uses the cached local copy.

### 2.3 Playback Engine Features
- **Looping:** Seamless infinite looping option.
- **Fade Transitions:** Smooth 1.5-second fade-in on start and fade-out on pause/exit to avoid abrupt audio cuts.
- **App Lifecycle Awareness:** Automatically pauses audio when the app is placed in the background (or provides toggle for background audio continuation).
- **Mute / Volume Control:** Global mute toggle and per-event volume slider.

---

## 3. Platform Implementations

### Common Interface
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

### Platform Implementations
- **Android:** AndroidX Media3 / `ExoPlayer` for reliable streaming and caching.
- **iOS:** `AVAudioPlayer` / `AVPlayer` with audio session category management.
- **Desktop (JVM):** JavaFX `MediaPlayer` or LWJGL OpenAL.
- **Web:** HTML5 `Audio` API.

---

## 4. UI/UX Flow & Screen Elements

### 4.1 Audio Controller Overlay (`EventDetailScreen`)
- Subtle circular music disc / vinyl icon at the top right of the event detail view.
- Spinning animation during playback with visual audio wave bars.
- Tapping toggles play/pause with quick volume slider popup.

### 4.2 Audio Selection Sheet
- "Pick Local Audio File" button (via `FileKit`).
- Bundled preset tracks (e.g., "Calm Lo-Fi", "Gentle Acoustic", "Celebration Chimes", "Nature Rain").
- Track previewer with play/pause test button before attaching.
- Remove / detach audio option.

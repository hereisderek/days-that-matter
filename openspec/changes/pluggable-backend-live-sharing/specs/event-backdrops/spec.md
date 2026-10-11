# Delta for Event Backdrops

## Purpose

Lets owners and editors use a photo or a short animation as an event's backdrop, compressed automatically so it loads fast in the app and on the web.

## ADDED Requirements

### Requirement: Backdrop types
An event SHALL have at most one backdrop: a still photo, or an animation with a still poster. Animations SHALL be accepted from short videos, iOS Live Photos, GIFs and animated WebP images.

#### Scenario: Live Photo
- **WHEN** a user picks a Live Photo as the backdrop
- **THEN** the backdrop plays the Live Photo's motion as a silent loop, with its key photo as the poster

### Requirement: Compression on the device
The app and the web editor SHALL compress a backdrop before upload so that it fits the limits without the user resizing anything. Stills SHALL be at most 1.5 MB and 2560 px on the long edge. Animations SHALL be at most 4 MB, 10 seconds and 1280 px on the long edge, with no sound. Posters SHALL be at most 300 KB.

#### Scenario: Large phone photo
- **WHEN** a user picks a 12 megapixel, 6 MB photo
- **THEN** the app uploads a still of at most 1.5 MB without asking the user to do anything

#### Scenario: Long video
- **WHEN** a user picks a 30 second video
- **THEN** the app asks which 10 seconds to use and uploads a silent clip of at most 4 MB

#### Scenario: Large GIF
- **WHEN** a user picks a 9 MB GIF
- **THEN** the app explains that GIFs over 4 MB are not supported yet and suggests a video instead

### Requirement: Backend enforces types and limits
The backend SHALL accept only JPEG and WebP stills and posters, and MP4 (H.264, no audio track), GIF and animated WebP animations, identified from the file content. It SHALL reject files over the limits with `413 payload_too_large` and wrong or mismatched types with `415 unsupported_media_type`.

#### Scenario: Mislabelled file
- **WHEN** a client uploads a PNG file with content type `image/jpeg`
- **THEN** the response is `415 unsupported_media_type`

#### Scenario: Video with sound
- **WHEN** a client uploads an MP4 that has an audio track
- **THEN** the response is `415 unsupported_media_type`

### Requirement: No location or camera metadata
Served backdrop files SHALL NOT contain location, camera or other EXIF or XMP metadata, even when the uploaded file did.

#### Scenario: Photo with GPS data
- **WHEN** a client uploads a JPEG that contains GPS coordinates
- **THEN** the served file contains no GPS coordinates

### Requirement: Motion and data preferences
An animated backdrop SHALL show its poster instead of the animation when the device or browser asks for reduced motion. On the web, when the browser asks to save data, the page SHALL show the poster and play the animation only after a tap. Link previews and widgets SHALL use the poster.

#### Scenario: Reduced motion
- **WHEN** a visitor with reduced motion turned on opens an event with an animated backdrop
- **THEN** only the poster is shown

### Requirement: Readable text over backdrops
Each backdrop SHALL have a dim level from 0 to 0.8, stored as a shared field. Text over a backdrop SHALL keep a contrast ratio of at least 4.5:1, using the auto-contrast rules of the customization spec.

#### Scenario: Bright photo without dimming
- **WHEN** a user sets a bright beach photo with dim level 0
- **THEN** the countdown text changes colour or gains a shadow so its contrast stays at 4.5:1 or more

### Requirement: Backdrop lifecycle
When a backdrop is replaced or removed, or its event or owner account is deleted, its files SHALL stop being served within 24 hours. Uploads that no event uses SHALL be deleted within 24 hours.

#### Scenario: Backdrop replaced
- **WHEN** an editor replaces a backdrop
- **THEN** the old file's URL stops working within 24 hours

### Requirement: Upload quota
Each owner account SHALL be able to store up to 100 MB of backdrop files. Each account SHALL be able to upload up to 20 files per hour. Uploads by an editor SHALL count against the event owner's storage. Over a limit, the backend SHALL return `429 quota_exceeded` and the app SHALL explain why.

#### Scenario: Storage full
- **WHEN** an owner with 100 MB of backdrops uploads another one
- **THEN** the upload fails with `429 quota_exceeded` and the app suggests removing old backdrops

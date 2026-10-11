# Delta for Event Backdrops

## Purpose

Lets owners and editors use a still photo, or with Premium an animated photo from an iPhone Live Photo or a Google Motion Photo, as an event's backdrop, sized automatically so it loads fast in the app and on the web.

## ADDED Requirements

### Requirement: Backdrop types
An event SHALL have at most one backdrop: a still photo, or an animated photo with a still key photo. Animated photos SHALL come from iPhone Live Photos and from Motion Photos in Google's format. A Motion Photo in another vendor's format SHALL be used as a still photo without an error.

#### Scenario: Live Photo
- **WHEN** a user picks a Live Photo as the backdrop
- **THEN** the app offers it as an animated photo with its key photo as the still

#### Scenario: Unsupported motion format
- **WHEN** a user picks a motion photo whose format the app cannot read
- **THEN** the app uses its still image as the backdrop

### Requirement: Conversion on the device
The app SHALL convert a backdrop before upload so it fits the limits without the user doing anything. Stills SHALL be JPEG or WebP, at most 1.5 MB and 2560 px on the long edge. The motion part SHALL be an H.264 MP4 without sound, at most 4 MB, 5 seconds and 1280 px on the long edge. The key photo SHALL follow the still limits. The web editor SHALL accept still photos only.

#### Scenario: Large phone photo
- **WHEN** a user picks a 12 megapixel, 6 MB photo
- **THEN** the app uploads a still of at most 1.5 MB without asking the user to do anything

#### Scenario: Live Photo with sound
- **WHEN** a Premium owner saves a Live Photo backdrop
- **THEN** the uploaded motion part is a silent H.264 MP4 of at most 5 seconds and 4 MB

### Requirement: Animated photos are Premium on save
Any user SHALL be able to pick an animated photo and preview it moving. Saving it SHALL require the event owner's plan to include animated backdrops. Otherwise the app SHALL show the paywall with an option to upgrade and an option to use the still photo instead. The backend SHALL reject an animated backdrop for such an event with `402 premium_required`.

#### Scenario: Free owner saves an animated photo
- **WHEN** a free user previews a Live Photo backdrop and taps Save
- **THEN** the paywall appears, and choosing "Use still photo" saves the key photo as a still backdrop

#### Scenario: Editor on a Premium owner's event
- **WHEN** a free editor saves an animated photo on an event whose owner has Premium
- **THEN** the backdrop is saved without a paywall

### Requirement: Viewers always see animated photos
People with access and link visitors SHALL see an animated backdrop as animated, whatever their own plan, as long as the event has one.

#### Scenario: Free viewer
- **WHEN** a viewer without Premium opens an event with an animated backdrop
- **THEN** the backdrop plays like it does for the owner

### Requirement: How animated photos play
An animated backdrop SHALL play once when the event opens and again when the user touches it, and SHALL then rest on the key photo. Lists, widgets and link previews SHALL show the key photo only. When the device or browser asks for reduced motion, the backdrop SHALL show the key photo only.

#### Scenario: Open an event
- **WHEN** a user opens an event with an animated backdrop
- **THEN** the motion plays once and stops on the key photo

#### Scenario: Reduced motion
- **WHEN** a visitor with reduced motion turned on opens the event
- **THEN** only the key photo is shown

### Requirement: Backend enforces types and limits
The backend SHALL accept only JPEG and WebP stills and key photos, and H.264 MP4 files without an audio track for motion, identified from the file content. It SHALL reject files over the limits with `413 payload_too_large` and wrong or mismatched types with `415 unsupported_media_type`.

#### Scenario: Mislabelled file
- **WHEN** a client uploads a PNG file with content type `image/jpeg`
- **THEN** the response is `415 unsupported_media_type`

#### Scenario: Motion with sound
- **WHEN** a client uploads an MP4 that has an audio track
- **THEN** the response is `415 unsupported_media_type`

### Requirement: No location or camera metadata
Served backdrop files SHALL NOT contain location, camera or other EXIF or XMP metadata, even when the uploaded file did.

#### Scenario: Photo with GPS data
- **WHEN** a client uploads a JPEG that contains GPS coordinates
- **THEN** the served file contains no GPS coordinates

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

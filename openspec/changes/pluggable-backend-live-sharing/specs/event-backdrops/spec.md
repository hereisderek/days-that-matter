# Delta for Event Backdrops

## Purpose

Lets owners and editors use a still photo, or with a paid plan an animated photo from an iPhone Live Photo or a Google Motion Photo, as an event's backdrop, sized automatically so it loads fast in the app and on the web.

## ADDED Requirements

### Requirement: Backdrop types
An event SHALL have at most one backdrop: a still photo, or an animated photo with a still key photo. Animated photos SHALL come from iPhone Live Photos and from Motion Photos in Google's format. A motion photo in another vendor's format SHALL be used as a still photo without an error.

#### Scenario: Live Photo
- **WHEN** a user picks a Live Photo as the backdrop
- **THEN** the app offers it as an animated photo with its key photo as the still

#### Scenario: Unsupported motion format
- **WHEN** a user picks a motion photo whose format the app cannot read
- **THEN** the app uses its still image as the backdrop

### Requirement: Conversion on the device
The app SHALL convert a backdrop before upload so it fits the limits without the user doing anything. Stills and key photos SHALL be JPEG or WebP, at most 1.5 MB and 2560 px on the long edge. The motion part SHALL be an H.264 MP4 without sound, at most 4 MB, 5 seconds and 1280 px on the long edge.

#### Scenario: Large phone photo
- **WHEN** a user picks a 12 megapixel, 6 MB photo
- **THEN** the app uploads a still of at most 1.5 MB without asking the user to do anything

#### Scenario: Live Photo with sound
- **WHEN** a Premium user saves a Live Photo backdrop
- **THEN** the uploaded motion part is a silent H.264 MP4 of at most 5 seconds and 4 MB

### Requirement: Photo limits per plan
The number of photo backdrops and of animated photo backdrops an account has in use SHALL follow the plan table, counting the backdrops that account added on any event. Removing or replacing a backdrop SHALL free its slot. Over a limit, the app SHALL show the paywall and the backend SHALL reject the upload with `402 premium_required`, or `429 quota_exceeded` when no plan raises the limit.

#### Scenario: Free user adds a sixth photo
- **WHEN** a free user with 5 photo backdrops in use adds a photo to another event
- **THEN** the paywall appears and the event keeps its previous background

#### Scenario: Premium user at the animated limit
- **WHEN** a Premium user with 30 animated photos in use saves another one
- **THEN** the app says the limit is reached and offers to save it as a still

### Requirement: Animated photos need a paid plan to save
Any user SHALL be able to pick an animated photo and preview it moving. Saving it SHALL require the plan of the user saving it to include animated photos, on their own events and as an editor of someone else's. Otherwise the app SHALL show the paywall with an upgrade option and a "Use still photo" option.

#### Scenario: Free owner saves an animated photo
- **WHEN** a free user previews a Live Photo backdrop and taps Save
- **THEN** the paywall appears, and choosing "Use still photo" saves the key photo as a still backdrop

#### Scenario: Free editor on a Premium owner's event
- **WHEN** a free editor saves an animated photo on an event whose owner has Premium
- **THEN** the paywall appears for the editor, and the backend would reject the upload with `402 premium_required`

### Requirement: Viewers see animated photos animated
An animated photo that a paid user saved SHALL appear animated to the owner, members and link visitors, whatever their own plan, and SHALL keep doing so after the uploader's plan ends.

#### Scenario: Free viewer
- **WHEN** a viewer without Premium opens an event whose Premium editor added an animated photo
- **THEN** the backdrop plays like it does for the editor

### Requirement: How animated photos play
An animated backdrop SHALL play once when the event opens and again when the user touches it, and SHALL then rest on the key photo. Lists, widgets and link previews SHALL show the key photo only. When the device or browser asks for reduced motion, the backdrop SHALL show the key photo only.

#### Scenario: Open an event
- **WHEN** a user opens an event with an animated backdrop
- **THEN** the motion plays once and stops on the key photo

#### Scenario: Reduced motion
- **WHEN** a visitor with reduced motion turned on opens the event
- **THEN** only the key photo is shown

### Requirement: Backend enforces types and limits
The backend SHALL accept only JPEG and WebP stills and key photos, and H.264 MP4 files without an audio track for motion, identified from the file content. It SHALL reject files over the size limits with `413 payload_too_large` and wrong or mismatched types with `415 unsupported_media_type`. It SHALL accept at most 20 uploads per account per hour.

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
Each backdrop SHALL have a dim level from 0 to 0.8, stored as a shared field (`backdrop.dim`). Text over a backdrop SHALL keep a contrast ratio of at least 4.5:1, using the auto-contrast rules of the customization spec.

#### Scenario: Bright photo without dimming
- **WHEN** a user sets a bright beach photo with dim level 0
- **THEN** the countdown text changes colour or gains a shadow so its contrast stays at 4.5:1 or more

### Requirement: Backdrop blur
Photo and art backdrops SHALL have a blur radius from 0 to 16, default 0, stored as a shared field (`backdrop.blur`). The radius SHALL be given in points at a card width of 390 pt and SHALL scale with the card's width. The app and the public link page SHALL render it the same way.

#### Scenario: Blurred photo on a smaller card
- **WHEN** an owner sets blur 8 on a photo backdrop and the day is shown on a 195 pt wide card
- **THEN** the photo is drawn with a blur radius of 4 pt, in the app and on the public link page alike

#### Scenario: Viewer cannot change blur
- **WHEN** a viewer's client sends a change to `backdrop.blur`
- **THEN** the response is `403 forbidden` and the blur is unchanged

### Requirement: Backdrop lifecycle
When a backdrop is replaced or removed, or its event or uploader account is deleted, its files SHALL stop being served within 24 hours. Uploads that no event uses SHALL be deleted within 24 hours.

#### Scenario: Backdrop replaced
- **WHEN** an editor replaces a backdrop
- **THEN** the old file's URL stops working within 24 hours

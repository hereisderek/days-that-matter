# Feature Specification: Data Files (Export & Import)

Normative requirements: `local-mode` spec ("Export events and memos to a file", "Import events from a file"), task 12.10.

---

## 1. Overview & Goals
Users can export their complete event collection (events, memos, and attached media) to a portable `.zip` archive, and import events from such archives back into the app. This provides full data portability for local mode and signed-in accounts without requiring network access or server reliance.

---

## 2. Archive Format (.zip)

### 2.1 File Naming Convention
Export archives are named with the app name and an ISO-like local timestamp:
```
DaysThatMatter-YYYYMMDD-HHMMSS.zip
```
Example: `DaysThatMatter-20261015-153045.zip`.

### 2.2 Directory Layout
Inside the root of the `.zip` archive:
```
/
├── manifest.json
├── events.json
├── memos.json
└── media/
    ├── <mediaId>.jpg
    ├── <mediaId>.mp4
    └── <mediaId>.m4a
```

### 2.3 Manifest (`manifest.json`)
The manifest identifies the package version and export metadata:
```json
{
  "format": 1,
  "app": "Days That Matter",
  "exportedAt": "2026-10-15T15:30:45Z",
  "eventCount": 12,
  "memoCount": 34,
  "mediaCount": 5
}
```

### 2.4 Data Models & Serialization
- `events.json`: JSON array of event documents conforming to `:core:model` field names (`id`, `title`, `emoji`, `targetDate`, `targetTime`, `timeZone`, `unitMode`, `recurrence`, `theme`, `backdrop`, `audio`, `notes`, `pinnedAt`, `categoryId`, `archivedAt`, `reminders`, `updatedAt`).
- `memos.json`: JSON array of memo documents conforming to `:core:model` field names (`id`, `eventId`, `content`, `milestoneTag`, `createdAt`, `updatedAt`).
- `media/`: contains binary assets referenced by `backdrop.stillId`, `backdrop.motionId`, or `audio.mediaId`. Files are stored with their content extension (`.jpg`, `.webp`, `.mp4`, `.m4a`).

### 2.5 What is NOT Included
To preserve privacy and prevent identity confusion across devices:
- Account identifiers (`owner_id`, `uploader_id`, `author_id`) are excluded or cleared.
- Session tokens, auth secrets, and credentials are never included.
- Server sync state (`server_rev`, sync cursors, `child_seq`, `pending_patch`) is omitted; imported events start with clean local state.

---

## 3. Versioning & Compatibility
- The `format` property in `manifest.json` indicates schema version (currently `1`).
- **Forward Compatibility:** If the app encounters an archive with `format` greater than supported, it refuses the import with a plain-words message:
  *"This file was made by a newer version of Days That Matter. Update the app to open it."*
- **Corrupted Archives:** Missing `manifest.json`, missing media files referenced in events, or malformed JSON halts the import with an informative message; no partial import is committed.

---

## 4. Platform Storage & UX

### 4.1 Android
- **Export Destination:** Saved to the user's shared Downloads directory via Android MediaStore (`MediaStore.Downloads`) or through the Storage Access Framework (SAF) document creation intent. Broad storage permissions are not requested.
- **Import Source:** Selected via the SAF document picker (`ACTION_OPEN_DOCUMENT` with MIME type `application/zip`).

### 4.2 iOS
- **Export Destination:** Presented via the standard system share sheet (`UIActivityViewController`), allowing the user to save to the Files app, AirDrop, or send to other apps.
- **Import Source:** Selected via `UIDocumentPickerViewController` for `public.zip-archive` / `.zip`.

### 4.3 Import Behavior in App
- Settings offers "Export events" and "Import events" in both local mode and signed-in accounts.
- Importing checks for duplicates by event UUID: existing events with matching IDs are preserved or prompt confirmation if content differs; new events are added to the active database.

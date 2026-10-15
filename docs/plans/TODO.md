# Open Items & Future Planning (TODO)

Open design decisions, planned structural chores, and exploration items for the project owner.

---

## 1. Make the App AI-Friendly
Meaning and concrete scope are not yet defined; candidate directions under consideration (no decision taken yet):
- **Android AppFunctions and iOS App Intents**: expose structured app functions so on-device assistants can create and inspect events.
- **Machine-readable export and API for agents**: provide a documented export format and client API accessible to user-authorized agent tools.
- **Stable accessibility labels for UI agents**: maintain consistent semantics and accessibility trees for vision and UI automation agents.
- **Structured docs for coding agents**: keep operational architecture and domain specifications optimized for agent workflows.

---

## 2. Analytics & Diagnostics Tool
Purpose: record critical operational failures (such as unrecoverable event import errors) and crash diagnostics to aid troubleshooting.
- **Data collected**: strictly diagnostic payloads (e.g. error codes, schema version mismatches, failure causes); never personal notes, event titles, or identifiable content.
- **Consent and privacy constraints**: local mode must respect zero-tracking promises; diagnostics must require explicit opt-in, especially in local mode, without telemetry or persistent hardware identifiers.
- **Tool selection**: open; vendor/tool not yet chosen.

---

## 3. Dedicated `mobile/` Directory Move (Done)
Completed: all mobile application code moved into a top-level `mobile/` folder (`mobile/composeApp`, `mobile/androidApp`, `mobile/core`, `mobile/feature`, `mobile/gradle`, `mobile/gradlew`, `mobile/settings.gradle.kts`, `mobile/build.gradle.kts`, `mobile/gradle.properties`). `design/`, `backend/`, `docs/`, `openspec/`, `scripts/`, `services/`, `.github/`, `AGENTS.md` and `README.md` stay at the repository root. Paths and references updated across `:core:model` generators, `androidApp` debug keystore, CI workflows, and documentation.

---

## 4. User-Facing Vocabulary: Days vs. Events
Decision open for user-facing copy:
- The domain and backend use "event" (`EventDoc`, `events` table).
- User-facing text historically mixed "days" (from the app title "Days That Matter") and "events".
- Needs an owner decision to standardize user-facing strings on one primary term (see [`docs/standards/USER_COPY.md`](../standards/USER_COPY.md)).

---

## 5. Android Storage Details for Export
Exporting `.zip` packages on Android uses scoped storage:
- Export files must be written to shared storage via MediaStore (Downloads collection) or the Storage Access Framework (SAF) document picker without broad external storage permissions.
- Needs verification of MIME type handling (`application/zip`), duplicate name handling (appending numbering if needed), and URI permissions across Android 10+ (API 29+).

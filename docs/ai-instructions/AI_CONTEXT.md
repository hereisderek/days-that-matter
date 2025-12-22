# AI Project Context: Days that matter## Communication Protocol
- **Verify & Rephrase:** For every new instruction, the AI must rephrase its understanding and ask clarifying questions before writing code.
- **Update Cycle:** This folder (`docs/`) must be updated whenever a significant project decision is made or a task is completed.

## Project Overview
- **Name:** Days that matter
- **Type:** Kotlin Multiplatform (KMP)
- **Targets:** Android, iOS (SwiftUI), Web (Wasm/JS), Desktop (JVM)
- **UI Framework:** Compose Multiplatform (shared in `/composeApp`)
- **Description:** A utility app to track days until or since a specific date (events).
- **Key Features:**
  - **Event Tracking:** Count days for past/future events.
  - **User Accounts:** Login/Sign-up to sync data.
  - **Customization:** Fonts, styles, colors, background images (Premium).
  - **Media:** Background music (with size limits).
  - **Sharing:** Generate shared links for view-only access; Import shared links.
  - **Widgets:** Home screen widgets for Android, iOS, and Wearables.
  - **Memos:** Add notes to events (owner and shared users).

## Tech Stack
- **Language:** Kotlin 2.x
- **Build System:** Gradle (Kotlin DSL)
- **Backend:** Firebase (Auth, Firestore, Storage) - *Selected for low cost & KMP support.*
- **Entry Points:**
  - Android: `composeApp`
  - iOS: `iosApp` (SwiftUI)
  - Desktop: `composeApp` (JVM)
  - Web: `composeApp` (Wasm/JS)

## Architecture
- **Pattern:** MVVM (Model-View-ViewModel) with Clean Architecture principles.
- **DI:** Koin for dependency injection across all platforms.
- **Data Layer:** Repository pattern. `EventRepository` abstracts data access.
- **Backend:** Firebase (Auth, Firestore) accessed via `gitlive-firebase` KMP library.

## Naming Conventions
- Standard Kotlin coding conventions.
- Instruction files in `docs/` use uppercase `SNAKE_CASE.md`.

## Design Decisions
- **Widget Styling:** Initial implementation will use native customization (font, color, image). HTML/CSS styling is deferred to a future phase.
- **CI/CD:** Follows the workflow defined in `docs/ai-instructions/CICD_WORKFLOW.md`.

## Change-Log
- 2025-12-22: Updated Project Overview, Key Features, and Tech Stack with app requirements (Firebase, Customization, Sharing).
- 2025-12-22: Implemented Core Features: Auth (Login/Signup), Event Management (List, Create, Edit, Detail, Delete), and Navigation. Updated JVM target to 17.
- 2025-12-22: Added Google Sign-In support for Android using Credential Manager. Configured debug keystore for local development.
- 2025-12-22: Implemented Background Music feature: File picking (FileKit), Firebase Storage upload, and Audio Playback (Android/iOS).
- 2025-12-22: Added Time support for events (includeTime field, TimePicker, precise difference display).
- 2025-12-23: Implemented Sharing & Deep Linking: Android App Links, Custom Scheme, Web Fallback (Firebase Hosting), and Firestore Rules.

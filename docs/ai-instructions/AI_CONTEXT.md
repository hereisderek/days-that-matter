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
- **Backend (Proposed):** Firebase (Auth, Database, Storage) - *Selected for low cost & KMP support.*
- **Entry Points:**
  - Android: `composeApp`
  - iOS: `iosApp` (SwiftUI)
  - Desktop: `composeApp` (JVM)
  - Web: `composeApp` (Wasm/JS)

## Naming Conventions
- Standard Kotlin coding conventions.
- Instruction files in `docs/` use uppercase `SNAKE_CASE.md`.

## Design Decisions
- **Widget Styling:** Initial implementation will use native customization (font, color, image). HTML/CSS styling is deferred to a future phase.

## Change-Log
- 2025-12-22: Updated Project Overview, Key Features, and Tech Stack with app requirements (Supabase, Customization, Sharing).

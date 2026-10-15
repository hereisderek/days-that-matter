# Days That Matter

Days That Matter is a milestone and countdown app: it tracks the days that count up from past events and down to future ones, with recurring dates, unit modes, card styles and memos. It is built with Kotlin Multiplatform and Compose Multiplatform. Android comes first and iOS next; Desktop (JVM) and Web (Kotlin/Wasm) apps are planned for later. A TypeScript backend in `backend/` will provide accounts, sync and sharing, with its rules generated from the Kotlin model shared with the app.

## Status

Works today:

- Android app (`dev.derek.daysthatmatter`, debug builds use the `.debug` suffix) with the Home screen, the Day page, the Archived screen and the event editor. Days are stored on the device in Room.
- Shared model `:core:model`: event types, validation, patch merge, role projections, the plan table and the countdown engine (six unit modes). It compiles for Android, JVM, JS and iOS.
- Backend core (`backend/core/`): HTTP layer, ports, SQLite store, accounts, sync, history, public links, invites and link resolution, covered by tests.
- Design prototype for the next UI in [`design/v2/`](design/v2/).

Not there yet:

- In the app: sign-in, sync with the backend, sharing, history, backdrops, audio, purchases, notifications, widgets and the pinned carousel.
- iOS app shell, Desktop and Web targets.
- Backend provider variants (Cloudflare, self-host, Vercel, Firebase), so the backend cannot be deployed yet, and the share web page.

Progress is tracked in the OpenSpec task lists under [`openspec/changes/`](openspec/changes/).

## Repository layout

```text
mobile/             Mobile multiplatform application (Android, iOS)
  androidApp/       Android application (Application, MainActivity, manifest, signing)
  composeApp/       Shared Compose UI and app wiring; builds the ComposeApp framework for iOS
  core/model/       Shared domain model and rules, also compiled for the backend (JVM, JS)
  core/common/      Shared utilities
  core/designsystem/ Theme, tokens and shared UI components
  core/database/    Room KMP database, DAOs and exported schemas
  core/network/     Ktor API client
  feature/events/   Home, Day and Archived screens
  feature/eventeditor/ Event editor
  gradle/           Version catalog (libs.versions.toml) and wrapper
backend/            TypeScript backend (npm workspaces): core now, provider variants later
services/share/     Old TypeScript share service, frozen reference
design/             Design system notes and UI prototypes (v1, v2)
docs/               Specification, architecture, feature specs, standards, CI/CD, legal
openspec/           OpenSpec specs and active changes
scripts/            Figma and design token scripts
```

## Prerequisites

- JDK 21 (Temurin).
- Android SDK with `platforms;android-37.2` and `build-tools;37.0.0`. Builds do not download SDK components (`android.builder.sdkDownload=false`), so install them first.
- Node.js 22.18 or newer, for the backend.
- Gradle: use the wrapper inside `mobile/` (`mobile/gradlew`, Gradle 9.8.1). No separate install is needed.

All versions come from [`mobile/gradle/libs.versions.toml`](mobile/gradle/libs.versions.toml); the reasons are in [`docs/ci-cd/TOOLCHAIN_GUIDELINES.md`](docs/ci-cd/TOOLCHAIN_GUIDELINES.md).

## Build, test and run

| What | Command |
| :--- | :--- |
| All multiplatform tests (every target the host can run) | `cd mobile && ./gradlew allTests` |
| Shared model tests | `cd mobile && ./gradlew :core:model:allTests` |
| Android app unit tests | `cd mobile && ./gradlew testDebugUnitTest` |
| Lint (app and its modules) | `cd mobile && ./gradlew lintDebug` |
| Debug APK | `cd mobile && ./gradlew :androidApp:assembleDebug` |
| Release bundle | `cd mobile && ./gradlew :androidApp:bundleRelease` |
| Stop the Gradle daemon | `cd mobile && ./gradlew --stop` |

The debug APK is written to `mobile/androidApp/build/outputs/apk/debug/`. `testDebugUnitTest` covers only `:androidApp`; tests in the multiplatform modules run with `allTests`. iOS targets compile only on macOS and are skipped on Linux and Windows. Release signing is not configured yet. The build is sized for a host with about 8 GB of RAM: run one Gradle build at a time.

## Backend

```sh
cd backend
npm ci
npm run typecheck
npm run lint
npm test
```

After a change to `:core:model`, regenerate the backend contract as described in [`backend/README.md`](backend/README.md). Architecture, ports, data model and API: [`docs/architecture/BACKEND.md`](docs/architecture/BACKEND.md). The old share service in [`services/share/`](services/share/) is kept only as a frozen reference and is superseded by `backend/`.

## Specs and design

- Product and technical specification: [`docs/SPEC.md`](docs/SPEC.md); feature specs in [`docs/features/`](docs/features/).
- Architecture: [`docs/architecture/`](docs/architecture/).
- Specs and planned changes: [`openspec/`](openspec/). Behavior changes are planned as OpenSpec changes (proposal, delta specs, design, tasks) before they are built.
- Design prototype: run `python3 -m http.server 8766 --directory design/v2` and open http://localhost:8766, or open `design/v2/index.html` directly. See [`design/v2/README.md`](design/v2/README.md).
- Instructions for AI agents live only in [`AGENTS.md`](AGENTS.md).

## Contributing

Work on a feature branch and open a pull request. Before you push, run the checks above (`cd mobile && ./gradlew allTests testDebugUnitTest lintDebug`, `cd mobile && ./gradlew :androidApp:assembleDebug`, and the backend scripts when you touch `backend/`); CI runs the same checks plus the generated contract check. Keep the matching OpenSpec `tasks.md` and the docs in `docs/` in step with the code in the same pull request. Coding and testing standards are in [`docs/standards/`](docs/standards/); the full contributor rules are in [`AGENTS.md`](AGENTS.md).

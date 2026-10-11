# AGENTS.md

> Single source of truth for AI agents working on **Days That Matter**.

---

## 1. Project Overview & Mission

**Days That Matter** is a high-precision milestone and countdown application built with **Kotlin Multiplatform (KMP)** and **Compose Multiplatform (CMP)**. Android and iOS come first; Desktop (JVM) and Web (Kotlin/Wasm) apps come later. A Kotlin backend shares the `:core:model` module with the app and runs on Cloudflare, a self-hosted server, Vercel or Firebase.

- **Primary Specification:** [`docs/SPEC.md`](docs/SPEC.md)
- **User Documentation:** [`README.md`](README.md)

---

## 2. Agent Operational Rules & Protocols

1. **Verify & Align:** Before generating code or modifying architectural boundaries, rephrase requirements and verify alignment against the feature specification.
2. **Specification Adherence:** Never invent ad-hoc data schemas or business logic that diverge from the specifications in [`openspec/specs/`](openspec/specs/), the active changes in [`openspec/changes/`](openspec/changes/), and [`docs/features/`](docs/features/). Where they disagree, the active OpenSpec change wins.
3. **Documentation Sync:** When a significant architectural choice, schema modification, or feature is added, update the corresponding documentation immediately.
4. **Toolchain Discipline:** Do not hardcode dependency versions in `build.gradle.kts`. Always use the Gradle Version Catalog (`gradle/libs.versions.toml`).
5. **No Platform Code in Domain:** Keep domain entities and use cases strictly pure Kotlin. `:core:model` is also compiled for the server (JS, JVM), so it may depend only on Kotlin stdlib, kotlinx-serialization and kotlinx-datetime.
6. **No Vendor SDK in the Server Core:** `:server:core` talks to providers only through its ports (`Store`, `BlobStore`, `LiveHub`). Vendor code belongs in the adapter modules (`server/cloudflare`, `server/selfhost`, `server/vercel`, `server/firebase`).

---

## 3. Spec-Driven Changes (OpenSpec)

Behavior changes are planned with [OpenSpec](https://github.com/Fission-AI/OpenSpec) (CLI `openspec`, schema `spec-driven`, project rules in [`openspec/config.yaml`](openspec/config.yaml)).

- `openspec/specs/<capability>/spec.md`: current behavior as requirements and scenarios. Filled when changes are archived.
- `openspec/changes/<change>/`: a proposed change: `proposal.md` (why, what), `specs/` (delta specs), `design.md` (decisions), `tasks.md` (checklist).
- Before working on a feature, run `openspec list` and follow the matching change's `tasks.md`. Mark tasks `- [x]` when done and verified.
- New behavior: `openspec new change <kebab-name>`, then write proposal, delta specs, design and tasks. Run `openspec validate <change> --strict` before opening a PR.
- After the change ships: `openspec archive <change>` merges its deltas into `openspec/specs/`.
- `docs/` keeps architecture and reference material. When a change alters something described there, update the doc in the same PR.

Active change: [`pluggable-backend-live-sharing`](openspec/changes/pluggable-backend-live-sharing/) (Kotlin backend on four providers, accounts, sync, live links, people access, history, photo backdrops).

---

## 4. Specifications Index

### 4.1 Architectural & Technical Guidelines
- **Master Specification:** [`docs/SPEC.md`](docs/SPEC.md)
- **System Architecture & Modularization:** [`docs/architecture/SYSTEM_ARCHITECTURE.md`](docs/architecture/SYSTEM_ARCHITECTURE.md)
- **Backend (ports, adapters, data model, API contract, limits):** [`docs/architecture/BACKEND.md`](docs/architecture/BACKEND.md)
- **Persistence, Room KMP & Sync:** [`docs/architecture/PERSISTENCE_AND_SYNC.md`](docs/architecture/PERSISTENCE_AND_SYNC.md)
- **Coding Standards & Kotlin Idioms:** [`docs/standards/CODING_STANDARDS.md`](docs/standards/CODING_STANDARDS.md)
- **Testing Pyramid & QA Strategy:** [`docs/standards/TESTING_STRATEGY.md`](docs/standards/TESTING_STRATEGY.md)
- **CI/CD Pipeline & GitHub Workflows:** [`docs/ci-cd/WORKFLOW_PIPELINE.md`](docs/ci-cd/WORKFLOW_PIPELINE.md)
- **Toolchain & Build Guidelines (JDK 21, Gradle 8.13+):** [`docs/ci-cd/TOOLCHAIN_GUIDELINES.md`](docs/ci-cd/TOOLCHAIN_GUIDELINES.md)
- **Superseded, kept as reference until removed:** the TypeScript share service in `services/share/`: [`SHARE_SERVICE.md`](docs/architecture/SHARE_SERVICE.md), [`SHARE_SERVICE_IMPLEMENTATION_PLAN.md`](docs/plans/SHARE_SERVICE_IMPLEMENTATION_PLAN.md), [`SHARE_SERVICE_STATUS.md`](docs/plans/SHARE_SERVICE_STATUS.md).

### 4.2 Feature Specifications
- **Authentication & Accounts:** [`docs/features/auth/SPEC.md`](docs/features/auth/SPEC.md)
  - Guest mode, anonymous accounts, Sign in with Google and Apple, sessions, account deletion.
- **Event Tracking & Countdown Engine:** [`docs/features/events/SPEC.md`](docs/features/events/SPEC.md)
  - Time calculation algorithms, time zones, recurrence schedules, categorization, filtering, and sorting.
- **Customization & Visual Theming:** [`docs/features/customization/SPEC.md`](docs/features/customization/SPEC.md)
  - Card styles, color palettes, gradients, photo and animated backdrops, typography presets, auto-contrast.
- **Media & Background Audio:** [`docs/features/media/SPEC.md`](docs/features/media/SPEC.md)
  - Multiplatform audio playback engine, file selection via FileKit, loop and fade controls.
- **Sharing, Deep Linking & Export:** [`docs/features/sharing/SPEC.md`](docs/features/sharing/SPEC.md)
  - Public links, people link and invites, live updates, history, web page, App Links / Universal Links, card image export, QR codes.
- **Home & Lock Screen Widgets:** [`docs/features/widgets/SPEC.md`](docs/features/widgets/SPEC.md)
  - Jetpack Glance (Android) and WidgetKit (iOS) specifications, data synchronization.
- **Memos & Memory Notes:** [`docs/features/memos/SPEC.md`](docs/features/memos/SPEC.md)
  - Milestone reflections, timeline entries, author attribution.

---

## 5. Quick Commands Reference

| Operation | Command |
| :--- | :--- |
| **Run Android Unit Tests** | `./gradlew testDebugUnitTest` |
| **Run Lint Check** | `./gradlew lintDebug` |
| **Build Android Debug APK** | `./gradlew :composeApp:assembleDebug` |
| **Build Android Release Bundle** | `./gradlew :composeApp:bundleRelease` |
| **Run Desktop (JVM)** | `./gradlew :composeApp:run` |
| **Run Web (Wasm)** | `./gradlew :composeApp:wasmJsBrowserDevelopmentRun` |
| **List OpenSpec changes / specs** | `openspec list` / `openspec list --specs` |
| **Validate OpenSpec** | `openspec validate --all --strict` |

# AGENTS.md

> Single source of truth for AI agents working on **Days That Matter**.

---

## 1. Project Overview & Mission

**Days That Matter** is a high-precision milestone and countdown application built with **Kotlin Multiplatform (KMP)** and **Compose Multiplatform (CMP)**. Android and iOS come first; Desktop (JVM) and Web (Kotlin/Wasm) apps come later. The backend has one core (`backend/core/`) and one variant per provider (Cloudflare, self-host, Vercel, Firebase). Its rules come from `:core:model`, the Kotlin module shared with the app.

- **Primary Specification:** [`docs/SPEC.md`](docs/SPEC.md)
- **User Documentation:** [`README.md`](README.md)

---

## 2. Agent Operational Rules & Protocols

1. **Verify & Align:** Before generating code or modifying architectural boundaries, rephrase requirements and verify alignment against the feature specification.
2. **Specification Adherence:** Never invent ad-hoc data schemas or business logic that diverge from the specifications in [`openspec/specs/`](openspec/specs/), the active changes in [`openspec/changes/`](openspec/changes/), and [`docs/features/`](docs/features/). Where they disagree, the active OpenSpec change wins.
3. **Documentation Sync:** When a significant architectural choice, schema modification, or feature is added, update the corresponding documentation immediately.
4. **Toolchain Discipline:** Do not hardcode dependency versions in `build.gradle.kts`. Always use the Gradle Version Catalog (`gradle/libs.versions.toml`).
5. **No Platform Code in Domain:** Keep domain entities and use cases strictly pure Kotlin. `:core:model` is also compiled for the backend (JS, JVM), so it may depend only on Kotlin stdlib, kotlinx-serialization and kotlinx-datetime.
6. **Backend Core and Variants:** all backend behavior lives in `backend/core/`. A variant directory (`backend/cloudflare`, `backend/selfhost`, `backend/vercel`, `backend/firebase`) holds only port implementations (`Store`, `BlobStore`, `LiveHub`), an entry file and deploy config. Performance and low running cost come first.
7. **Premium Features:** any change to what a plan includes updates the plan table in `:core:model` and [`docs/features/premium/SPEC.md`](docs/features/premium/SPEC.md) in the same PR. Gating uses the plan of the person saving; viewing is never gated.
8. **Legal Documents:** a change that touches what users upload or share, what data is collected or stored and where, third-party services, plans or prices, or retention updates the terms of service, privacy policy or disclaimer in [`docs/legal/`](docs/legal/README.md) in the same PR, following its checklist and update process.

---

## 3. Spec-Driven Changes (OpenSpec)

Behavior changes are planned with [OpenSpec](https://github.com/Fission-AI/OpenSpec) (CLI `openspec`, schema `spec-driven`, project rules in [`openspec/config.yaml`](openspec/config.yaml)).

- `openspec/specs/<capability>/spec.md`: current behavior as requirements and scenarios. Filled when changes are archived.
- `openspec/changes/<change>/`: a proposed change: `proposal.md` (why, what), `specs/` (delta specs), `design.md` (decisions), `tasks.md` (checklist).
- Before working on a feature, run `openspec list` and follow the matching change's `tasks.md`. Mark tasks `- [x]` when done and verified.
- New behavior: `openspec new change <kebab-name>`, then write proposal, delta specs, design and tasks. Run `openspec validate <change> --strict` before opening a PR.
- After the change ships: `openspec archive <change>` merges its deltas into `openspec/specs/`.
- `docs/` keeps architecture and reference material. When a change alters something described there, update the doc in the same PR.

Active change: [`pluggable-backend-live-sharing`](openspec/changes/pluggable-backend-live-sharing/) (backend core with four provider variants, accounts, sync of everything, live links, people access and invites, history, Live Photo and Motion Photo backdrops, audio catalog, custom audio and Spotify links, plans and native purchases, regions).

---

## 4. Specifications Index

### 4.1 Architectural & Technical Guidelines
- **Master Specification:** [`docs/SPEC.md`](docs/SPEC.md)
- **System Architecture & Modularization:** [`docs/architecture/SYSTEM_ARCHITECTURE.md`](docs/architecture/SYSTEM_ARCHITECTURE.md)
- **Backend (core, variants, ports, data model, API contract, limits):** [`docs/architecture/BACKEND.md`](docs/architecture/BACKEND.md)
- **China region (research, plan, open points):** [`docs/architecture/CHINA.md`](docs/architecture/CHINA.md)
- **Legal documents (terms, privacy policy, disclaimer: coverage checklist and update triggers):** [`docs/legal/README.md`](docs/legal/README.md)
- **Persistence, Room KMP & Sync:** [`docs/architecture/PERSISTENCE_AND_SYNC.md`](docs/architecture/PERSISTENCE_AND_SYNC.md)
- **Coding Standards & Kotlin Idioms:** [`docs/standards/CODING_STANDARDS.md`](docs/standards/CODING_STANDARDS.md)
- **Testing Pyramid & QA Strategy:** [`docs/standards/TESTING_STRATEGY.md`](docs/standards/TESTING_STRATEGY.md)
- **CI/CD Pipeline & GitHub Workflows:** [`docs/ci-cd/WORKFLOW_PIPELINE.md`](docs/ci-cd/WORKFLOW_PIPELINE.md)
- **Toolchain & Build Guidelines (JDK 21, Gradle 8.13+):** [`docs/ci-cd/TOOLCHAIN_GUIDELINES.md`](docs/ci-cd/TOOLCHAIN_GUIDELINES.md)
- **Superseded, kept as reference until removed:** the TypeScript share service in `services/share/`: [`SHARE_SERVICE.md`](docs/architecture/SHARE_SERVICE.md), [`SHARE_SERVICE_IMPLEMENTATION_PLAN.md`](docs/plans/SHARE_SERVICE_IMPLEMENTATION_PLAN.md), [`SHARE_SERVICE_STATUS.md`](docs/plans/SHARE_SERVICE_STATUS.md).

### 4.2 Feature Specifications
- **Authentication & Accounts:** [`docs/features/auth/SPEC.md`](docs/features/auth/SPEC.md)
  - Guest mode, sign-in prompt, Google, Apple and email code sign-in (also creates the account), sessions, account deletion.
- **Event Tracking & Countdown Engine:** [`docs/features/events/SPEC.md`](docs/features/events/SPEC.md)
  - Time calculation algorithms, time zones, recurrence schedules, categorization, filtering, and sorting.
- **Customization & Visual Theming:** [`docs/features/customization/SPEC.md`](docs/features/customization/SPEC.md)
  - Card styles, color palettes, gradients, photo and animated backdrops, typography presets, auto-contrast.
- **Media & Background Audio:** [`docs/features/media/SPEC.md`](docs/features/media/SPEC.md)
  - Built-in audio catalog (free and Premium tracks), custom audio files (Premium), Spotify links, playback engine.
- **Sharing, Deep Linking & Export:** [`docs/features/sharing/SPEC.md`](docs/features/sharing/SPEC.md)
  - Public links, invite links with role, use count and expiry, members, live updates, history, web page, App Links / Universal Links, card image export, QR codes.
- **Home & Lock Screen Widgets:** [`docs/features/widgets/SPEC.md`](docs/features/widgets/SPEC.md)
  - Jetpack Glance (Android) and WidgetKit (iOS) specifications, data synchronization.
- **Memos & Memory Notes:** [`docs/features/memos/SPEC.md`](docs/features/memos/SPEC.md)
  - Milestone reflections, timeline entries, author attribution, synced across the owner's devices.
- **Plans & Premium Features:** [`docs/features/premium/SPEC.md`](docs/features/premium/SPEC.md)
  - Free, Premium and reserved Premium Plus; the limit table; paywall, gating and native store purchases.

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
| **Validate OpenSpec** | `openspec validate --all --strict` (CI: `.github/workflows/openspec.yml`) |

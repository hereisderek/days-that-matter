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
4. **Toolchain Discipline:** Do not hardcode dependency versions in `build.gradle.kts`. Always use the Gradle Version Catalog (`gradle/libs.versions.toml`). Use the latest stable release of every dependency, SDK, compileSdk, targetSdk and Gradle unless the owner explicitly pins a version.
5. **No Platform Code in Domain:** Keep domain entities and use cases strictly pure Kotlin. `:core:model` is also compiled for the backend (JS, JVM), so it may depend only on Kotlin stdlib, kotlinx-serialization and kotlinx-datetime.
6. **Backend Core and Variants:** all backend behavior lives in `backend/core/`. A variant directory (`backend/cloudflare`, `backend/selfhost`, `backend/vercel`, `backend/firebase`) holds only port implementations (`Store`, `BlobStore`, `LiveHub`), an entry file and deploy config. Performance and low running cost come first.
7. **Premium Features:** any change to what a plan includes updates the plan table in `:core:model` and [`docs/features/premium/SPEC.md`](docs/features/premium/SPEC.md) in the same PR. Gating uses the plan of the person saving; viewing is never gated.
8. **Legal Documents:** a change that touches what users upload or share, what data is collected or stored and where, third-party services, plans or prices, or retention updates the terms of service, privacy policy or disclaimer in [`docs/legal/`](docs/legal/README.md) in the same PR, following its checklist and update process.
9. **Worker Lifecycle and Cleanup (automatic):** every parallel worker gets its own worktree and branch, created with `wt` from the integration branch, and the coordinator alone installs on the test device and merges. When a worker reports done, the coordinator runs one uninterrupted sequence without asking: validate (build, tests, lint, device check when the UI changed), merge into the integration branch, post-merge smoke test, cleanup, then report. Cleanup is part of finishing a worker, not a follow-up: it happens in the same turn as the merge, before the report, and an unfinished cleanup is a defect. The owner gave standing authorization (2026-10-15) for this cleanup of workers the coordinator dispatched, so it needs no prompt and no `yes`: (a) record anything a later reader needs that the diff does not show (decisions, deviations, known gaps, host or tooling limits) in the OpenSpec `tasks.md` notes, the matching `docs/` file, or AgentMemory, because worker reports in scratch directories are not kept; (b) release the worker's Orca dispatch and acknowledge its delivery, then close its terminal (`orca terminal close`, because Orca keeps terminals in worktrees made with `wt` as `retained`) and stop every process left in its worktree, including its MCP servers and background sub-sessions; (c) remove the worktree and delete its branch once `git merge-base --is-ancestor <branch> <integration-branch>` succeeds and `git status` in the worktree is clean (build output is ignored), with `wt remove` and `git branch -d`, never `--force`, `-D` or `--reap` without the owner's explicit yes; (d) verify with `git worktree list`, `orca terminal list`, `orca orchestration worker-list --run <run> --terminal-state reclaimable` and `ps` by working directory that no worktree, terminal or process remains for finished work, and put one line in the report saying so ("Cleanup verified: ..."). Check the Orca inbox (`orca orchestration check`, acknowledging each batch of heartbeats to reach the next) at the start of every turn and after every long wait, because worker reports are only seen when asked for; never leave a finished worker waiting for the owner to point it out. Failed or abandoned attempts get the same automatic cleanup once their useful findings are recorded. Only terminals or sessions the coordinator did not dispatch (an interactive Claude Code session someone opened in a worker worktree) need the owner: once the work is done and merged, prompt the owner to close it (list the terminal handles, what each shows, and that closing loses nothing) and close it only after a yes. Never remove a worktree of a worker that is still running, whose branch is not merged, or that still has a live session the coordinator did not dispatch.
10. **Build Host Limits:** run every Gradle invocation through the shared lock, `flock /tmp/dtm-gradle.lock ./gradlew ...`, so only one build runs at a time across all workers, and run `./gradlew --stop` after a build session. Check `free -m` before a heavy build. Parallel workers on one small host have been OOM-killed (the whole Orca terminal scope dies and workers vanish with only an `exited` status; the cause is in `journalctl --user | grep -i oom`). Keep the memory settings in `gradle.properties` (see [`TOOLCHAIN_GUIDELINES.md`](docs/ci-cd/TOOLCHAIN_GUIDELINES.md)). Size the number of parallel workers to the host, not to the plan.
11. **Agent Routing:** the owner has Claude Code and Antigravity subscriptions, so spread the work across both and route by difficulty. Claude Opus for architecture, security, concurrency, schema and cross-cutting design. Claude Sonnet, or Antigravity with `claude-sonnet-5-5-medium` or `gemini-3.8-flash-high`, for standard feature and test work. Antigravity with `gemini-3.8-flash-medium` (`-low` for trivial edits, `-high` when the task needs more care) for simpler, well-specified tasks by default: README and documentation updates, status notes, boilerplate, fixtures, configuration, mechanical refactors, OpenSpec archiving, UI token extraction. Start workers with `orca orchestration worker-start --agent antigravity --model <id>` or `--agent claude --model <opus|sonnet|haiku>` and give every worker the same self-contained task spec. Antigravity needs exact model ids from `agy models` (today `gemini-3.8-flash-{low,medium,high}`, `claude-opus-5-5-*`, `claude-sonnet-5-5-*`, `gpt-oss-120b`; there is no Gemini Pro). It does NOT recognize the aliases `flash` or `pro`: it silently falls back to its default, Claude Opus 5.5 medium, while Orca's `launch.effective` still echoes the alias. So after every Antigravity start, check the real model in the process arguments (`ps -eo args | grep 'agy '`) and in the terminal footer, and restart the worker if it is wrong. Review code with the opposite family from its author where it matters. Fall back to Claude and say so only when Antigravity is unavailable, rejects the model, or lacks a tool the task needs. Claude usage limits are shared with the coordinator's own session, so prefer Antigravity for simple work and keep Claude for the work that needs it.

---

## 3. Spec-Driven Changes (OpenSpec)

Behavior changes are planned with [OpenSpec](https://github.com/Fission-AI/OpenSpec) (CLI `openspec`, schema `spec-driven`, project rules in [`openspec/config.yaml`](openspec/config.yaml)).

- `openspec/specs/<capability>/spec.md`: current behavior as requirements and scenarios. Filled when changes are archived.
- `openspec/changes/<change>/`: a proposed change: `proposal.md` (why, what), `specs/` (delta specs), `design.md` (decisions), `tasks.md` (checklist).
- Before working on a feature, run `openspec list` and follow the matching change's `tasks.md`. Mark tasks `- [x]` when done and verified.
- New behavior: `openspec new change <kebab-name>`, then write proposal, delta specs, design and tasks. Run `openspec validate <change> --strict` before opening a PR.
- After the change ships: `openspec archive <change>` merges its deltas into `openspec/specs/`.
- `docs/` keeps architecture and reference material. When a change alters something described there, update the doc in the same PR.

Active changes:
- [`pluggable-backend-live-sharing`](openspec/changes/pluggable-backend-live-sharing/) (backend core with four provider variants, accounts, sync of everything, live links, people access and invites, history, read-only web pages, Live Photo and Motion Photo backdrops, audio catalog, custom audio library and Spotify links, plans, promotions and native purchases, data export and inactive accounts, regions).
- [`design-v2-features`](openspec/changes/design-v2-features/) (unit modes, card sizes, memo badge, archive, pinned carousel, notifications, smart days as a draft). Builds on the change above.

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
- **Toolchain & Build Guidelines (JDK 21, Gradle 9.8.1 and the other latest stable versions):** [`docs/ci-cd/TOOLCHAIN_GUIDELINES.md`](docs/ci-cd/TOOLCHAIN_GUIDELINES.md)
- **Superseded, kept as reference until removed:** the TypeScript share service in `services/share/`: [`SHARE_SERVICE.md`](docs/architecture/SHARE_SERVICE.md), [`SHARE_SERVICE_IMPLEMENTATION_PLAN.md`](docs/plans/SHARE_SERVICE_IMPLEMENTATION_PLAN.md), [`SHARE_SERVICE_STATUS.md`](docs/plans/SHARE_SERVICE_STATUS.md).

### 4.2 Feature Specifications
- **Authentication & Accounts:** [`docs/features/auth/SPEC.md`](docs/features/auth/SPEC.md)
  - Guest mode, sign-in prompt, Google, Apple and email code sign-in in the app (also creates the account), sessions, account deletion, data export, inactive accounts.
- **Event Tracking & Countdown Engine:** [`docs/features/events/SPEC.md`](docs/features/events/SPEC.md)
  - Time calculation algorithms, six unit modes, time zones, recurrence schedules, categorization, filtering, sorting, pinned carousel, archive, smart days (draft).
- **Customization & Visual Theming:** [`docs/features/customization/SPEC.md`](docs/features/customization/SPEC.md)
  - Card styles and sizes, color palettes, gradients, photo and animated backdrops with dim and blur, typography presets, auto-contrast.
- **Media & Background Audio:** [`docs/features/media/SPEC.md`](docs/features/media/SPEC.md)
  - Built-in audio catalog (free and Premium tracks), custom audio library (Premium), Spotify links and previews, playback engine.
- **Sharing, Deep Linking & Export:** [`docs/features/sharing/SPEC.md`](docs/features/sharing/SPEC.md)
  - Public links, invite links with role, use count and expiry, members, live updates, history, read-only web page, App Links / Universal Links, card image export, QR codes.
- **Home & Lock Screen Widgets:** [`docs/features/widgets/SPEC.md`](docs/features/widgets/SPEC.md)
  - Jetpack Glance (Android) and WidgetKit (iOS) specifications, data synchronization.
- **Memos & Memory Notes:** [`docs/features/memos/SPEC.md`](docs/features/memos/SPEC.md)
  - Milestone reflections, timeline entries, author attribution, synced across the owner's devices, memo badge on Home cards.
- **Notifications:** [`docs/features/notifications/SPEC.md`](docs/features/notifications/SPEC.md)
  - Local reminders, push notifications for changes to shared days and being added to a day, opt-in offers and news, device registration.
- **Plans & Premium Features:** [`docs/features/premium/SPEC.md`](docs/features/premium/SPEC.md)
  - Free, Premium and reserved Premium Plus; the limit table; paywall, gating, native store purchases and promotional grants.

---

## 5. Quick Commands Reference

| Operation | Command |
| :--- | :--- |
| **Run multiplatform tests (every target the host can run)** | `./gradlew allTests` |
| **Run shared model tests (android, jvm, js; iOS on macOS)** | `./gradlew :core:model:allTests` |
| **Run Android app unit tests** | `./gradlew testDebugUnitTest` |
| **Run Lint Check (app and its modules)** | `./gradlew lintDebug` |
| **Build Android Debug APK** | `./gradlew :androidApp:assembleDebug` |
| **Build Android Release Bundle** | `./gradlew :androidApp:bundleRelease` |
| **Stop the Gradle daemon after a build session** | `./gradlew --stop` |
| **Run Desktop (JVM)** | Later: no Desktop target yet |
| **Run Web (Wasm)** | Later: no Wasm target yet |
| **List OpenSpec changes / specs** | `openspec list` / `openspec list --specs` |
| **Validate OpenSpec** | `openspec validate --all --strict` (CI: `.github/workflows/openspec.yml`) |

`testDebugUnitTest` covers only `:androidApp`. Tests in the multiplatform modules, including their Android host tests (`testAndroidHostTest`), run with `allTests`. Apple targets are skipped on Linux and Windows. Run one Gradle build at a time on small hosts; memory settings and toolchain versions are in [`docs/ci-cd/TOOLCHAIN_GUIDELINES.md`](docs/ci-cd/TOOLCHAIN_GUIDELINES.md).

### Project skills

Android skills live in `.agents/skills/` (symlinked from `.claude/skills/`): `android-cli` (device install, UI inspection, screenshots), `edge-to-edge`, `adaptive`, `navigation-3`, `android-intent-security`, `r8-analyzer` and `android-profiler`, plus the OpenSpec skills and `days-that-matter-orchestrator`. Use `android-cli` for on-device checks, with `--device <serial>`.

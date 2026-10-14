---
name: days-that-matter-orchestrator
description: Orchestrate end-to-end implementation of the Days That Matter Android app and validation of services/share through Orca workers, OpenSpec changes and live-device ADB testing. Use when asked to implement the app, run the orchestration plan, or fan out feature work across agents.
---

# Local overrides (win over the text below)

- The single test device is a Pixel 4 (Android 13). It shows in `adb devices` twice: USB serial `99251FFAZ002D2` and wireless `172.16.30.1:5555`. It is one device. Wherever the text says `172.16.30.1:5555`, use whichever serial `adb devices` lists as `device`; prefer the wireless one when present, else USB.
- Workspace is the current git worktree, not `/workspace/myapp/days-that-matter`.
- Do not create extra worktrees for the Coordinator itself. Child workers use Orca `--worktree new-child`.
- If the AgentMemory daemon (port 3111) is not running and cannot be started, skip AgentMemory steps and say so. Use OpenSpec `tasks.md` as the shared record.
- Model names below are targets. If a model flag is rejected, use the nearest available model of the same tier.

# Master Orchestrator Instructions: `days-that-matter` (Android App + `services/share`)

You are the **Chief Orchestrator Agent** running in **Orca** ([stablyai/orca](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Fstablyai%2Forca)) inside `/workspace/myapp/days-that-matter`. You are responsible for end-to-end implementation, validation, live-device testing over wireless ADB (`172.16.30.1:5555`), documentation synchronization, and merge approval across a parallel fleet of **Claude Code** (`--agent claude`) and **Google Antigravity** (`--agent antigravity`, [Antigravity Subagents Docs](https://www.google.com/search?q=https%3A%2F%2Fantigravity.google%2Fdocs%2Fsubagents%2F)) sub-agents, governed by **OpenSpec** ([Fission-AI/OpenSpec](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2FFission-AI%2FOpenSpec%2Fblob%2Fmain%2Fdocs%2Fcli.md)) and **AgentMemory** ([rohitg00/agentmemory](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frohitg00%2Fagentmemory%2Fblob%2Fmain%2FINSTALL_FOR_AGENTS.md)).

## 1. Phase 0: Pre-Flight Environment, Memory & Wireless ADB Check

Execute these verification steps immediately before planning or spawning any sub-agent. Do not proceed until every check passes:

1. **Resolve the Orca CLI Executable**:

   * Check `$ORCA_CLI_COMMAND` first; otherwise use `orca-dev` (if `$ORCA_DEV_REPO_ROOT` is set), `orca-ide` (on Linux outside an Orca terminal), or `orca`. Reuse that exact binary (referred to below as `ORCA`) for the entire run.

   * Verify runtime health and load the current orchestration specification:

     ```
     ORCA status --json
     ORCA skills get orchestration --full
     ORCA skills get orchestration --reference references/coordinator-loop.md
     
     ```

2. **Check & Verify `@agentmemory/agentmemory@latest` Availability**:

   * `@agentmemory/agentmemory@latest` is already installed. Verify the daemon and REST/MCP endpoints on port `3111` (streams on `3112`, viewer on `3113`, `iii-engine` on `49134`):

     ```
     npx -y @agentmemory/agentmemory@latest status
     curl -fsS http://localhost:3111/agentmemory/livez
     curl -fsS http://localhost:3111/agentmemory/health
     
     ```

   * If the server is not currently running, start it in a dedicated background terminal (`npx -y @agentmemory/agentmemory@latest`) and wait until `/agentmemory/health` returns `200 OK`.

   * Confirm MCP and skills are wired for both harnesses (`npx -y @agentmemory/agentmemory@latest connect claude-code` and `npx -y @agentmemory/agentmemory@latest connect antigravity`).

   * Run an initial recall sweep (`memory_smart_search` / `memory_recall`) for `"days-that-matter"`, `"pluggable-backend-live-sharing"`, and `"share-service"`.

3. **Verify Wireless Android Device Connection (`172.16.30.1:5555`)**:

   * Connect to and verify the attached wireless Android target:

     ```
     adb connect 172.16.30.1:5555
     adb -s 172.16.30.1:5555 wait-for-device
     adb -s 172.16.30.1:5555 devices -l
     adb -s 172.16.30.1:5555 shell getprop ro.build.version.release
     
     ```

   * **Single-Device Serialization Rule**: Because `172.16.30.1:5555` is a shared physical wireless target, parallel sub-agents in separate worktrees must **never** run `adb install` or `connectedDebugAndroidTest` concurrently. Sub-agents run JVM unit tests (`./gradlew testDebugUnitTest`), Robolectric/Compose JVM tests, and static analysis (`./gradlew lintDebug`) inside their isolated worktrees; **you (the Orchestrator)**—or a single serialized Device-QA worker holding the device lock—execute live on-device APK installs, UI inspections, and instrumentation tests on `172.16.30.1:5555`.

4. **Verify OpenSpec & Seed Architectural Memory**:

   * Check OpenSpec health and active changes:

     ```
     openspec doctor --json
     openspec list --json
     openspec list --specs --json
     openspec status --change pluggable-backend-live-sharing --json
     
     ```

   * Read the repository's authoritative docs once (`AGENTS.md`, `README.md`, `docs/SPEC.md`, `docs/architecture/{SYSTEM_ARCHITECTURE.md,BACKEND.md,CHINA.md,PERSISTENCE_AND_SYNC.md,SHARE_SERVICE.md}`, `docs/plans/{SHARE_SERVICE_IMPLEMENTATION_PLAN.md,SHARE_SERVICE_STATUS.md}`, `docs/standards/{CODING_STANDARDS.md,TESTING_STRATEGY.md}`, `docs/ci-cd/{TOOLCHAIN_GUIDELINES.md,WORKFLOW_PIPELINE.md}`, and `design/DESIGN_SYSTEM.md` + `design/v2/{index.html,styles.css,app.js}`).

   * Save a structured architectural digest into AgentMemory (`memory_save` with concepts `["architecture", "days-that-matter", "design-system", "testing-strategy"]`) so sub-agents can query `memory_smart_search` without re-reading all 34 files from scratch.

   * Discover and load any installed Android, Compose,ADB, or testing skills in the workspace (`AGENTS.md`, `.claude/skills/`, `.agents/`).

## 2. Dynamic Model & Effort Routing Matrix (Claude + Antigravity)

Route every task (`ORCA orchestration worker-start --agent <agent> --model <model> --effort <level>`) according to task difficulty and quota efficiency ([Orca Orchestration Skill Guide](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Fstablyai%2Forca%2Fblob%2Fmain%2Fskill-guides%2Forchestration.md), [Antigravity vs Claude Comparison](https://www.google.com/search?q=https%3A%2F%2Fwww.eigent.ai%2Fblog%2Fantigravity-vs-claude-cowork)):

| Complexity Tier | Target Workloads in `days-that-matter` | Agent & Model Flag | Effort Flag | Worktree & Isolation Mode | 
| ----- | ----- | ----- | ----- | ----- | 
| **Tier 1: Architecture & High-Complexity Engineering** | Android Gradle/module foundation (`Wave 0`), offline-first Room + sync engine (`PERSISTENCE_AND_SYNC.md`), pluggable Global/China backend adapters (`BACKEND.md`, `CHINA.md`), live-sharing client (`pluggable-backend-live-sharing`), complex concurrency/auth bugs | `--agent claude --model claude-opus-4-6` (or Antigravity `/boost` with `--model pro`) | `--effort high` | Isolated child worktree (`--worktree new-child --name <slug>`) | 
| **Tier 2: Standard Feature & Test Implementation** | Feature modules under `docs/features/{events,memos,media,premium}`, `services/share` Vitest unit/integration test expansion, Jetpack Compose screens & Glance AppWidgets (`docs/features/widgets`) | `--agent claude --model claude-sonnet-4-6` or `--agent antigravity --model pro` | `--effort medium` | Isolated child worktree (`--worktree new-child --name <slug>`) | 
| **Tier 3: Cross-Model QA, Coverage & UI Parity Audit** | Independent `git diff` review, `/opsx:verify` validation, test-coverage auditing, live-device ADB UI comparison against `design/v2/` and `design/DESIGN_SYSTEM.md` | Opposite model family from author (e.g., `--agent antigravity --model pro` auditing Claude's code, or `--agent claude --model claude-opus-4-6` auditing Antigravity's code) | `--effort high` | Read-only sandbox or orchestrator verification worktree | 
| **Tier 4: Low-Effort / High-Throughput Tasks** | UI token/style extraction from `design/v2/styles.css`, boilerplate data classes, mock fixtures, updating `SHARE_SERVICE_STATUS.md`, `README.md`, and archiving OpenSpec changes | `--agent antigravity --model flash` (Gemini 3 Flash) or `--agent claude --model claude-haiku-4-5` | `--effort low` | `--worktree new-child` for doc/file edits; `--worktree current` for read-only research | 

## 3. Non-Blocking Parallel Wave Plan (DAG)

Decompose the repository work into non-blocking waves so no two concurrent workers ever edit the same file or block each other:

### Track A (Runs Immediately in Parallel with Wave 0): Validate & Test `services/share`

* **Scope**: `services/share/` (`src/`, `test/`, `migrations/`, `schema/`, `public/`, `vitest.config.ts`, `wrangler.jsonc`, `eslint.config.js`), `openspec/changes/pluggable-backend-live-sharing`, `docs/architecture/SHARE_SERVICE.md`, `docs/plans/SHARE_SERVICE_IMPLEMENTATION_PLAN.md`, and `docs/plans/SHARE_SERVICE_STATUS.md`.

* **Why Non-Blocking**: `services/share/` is a self-contained TypeScript/Cloudflare Worker directory. It has zero file overlap with the root Android Gradle setup.

* **Tasks**:

  1. Run `npx tsc --noEmit`, `npx eslint .`, and `npx vitest run` inside `services/share/`.

  2. Audit D1 SQL migrations (`services/share/migrations/`) against `services/share/schema/` and `openspec/changes/pluggable-backend-live-sharing/specs/`.

  3. Identify all untested endpoints, auth/token edge cases, rate limits, expiration rules, and `services/share/public/` web-preview states; write missing Vitest unit and integration tests in `services/share/test/` until coverage and spec completeness reach 100%.

### Track B — Wave 0 (Sequential Gate): Android Project Foundation & Shared Contracts

* **Scope**: Root Android Gradle configuration (`settings.gradle.kts`, `build.gradle.kts`, `gradle/libs.versions.toml`, debug signing with `docs/keystore/debug.keystore`), core architecture packages (`core:model`, `core:database`, `core:network`, `core:sync`, `core:designsystem`), and OpenSpec change proposals (`/opsx:propose`).

* **Tasks**:

  1. Translate `design/DESIGN_SYSTEM.md` and `design/v2/{styles.css,index.html,app.js}` into Jetpack Compose Material3 theme tokens (color palettes, typography, shapes, spacing, elevation, card components).

  2. Implement the Room database schema and offline-first sync interfaces defined in `docs/architecture/PERSISTENCE_AND_SYNC.md`.

  3. Define the pluggable backend interfaces for Global vs. China regions (`docs/architecture/BACKEND.md`, `docs/architecture/CHINA.md`) and shared navigation routes (`docs/SPEC.md`).

  4. Verify `./gradlew assembleDebug testDebugUnitTest lintDebug` passes, install the base shell on `172.16.30.1:5555` via ADB to confirm clean launch, and **merge Wave 0 into the base branch before launching Wave 1**.

### Track B — Wave 1 (Concurrent Feature Fan-Out — Cap at 4 Parallel Workers)

Once Wave 0 is merged, fan out these four isolated feature workers concurrently (`--worktree new-child`) BEFORE entering `ORCA orchestration check --wait`:

1. **Worker `feature-events` (`--agent claude --model claude-sonnet-4-6 --effort medium`)**:

   * **Scope**: `docs/features/events`, `docs/SPEC.md`.

   * **Deliverables**: Countdown/count-up calculation engine, lunar/solar & recurring date logic, category filtering, pinned events, Event List & Event Detail Compose screens, plus comprehensive unit and Compose UI tests.

2. **Worker `feature-auth-sharing` (`--agent claude --model claude-opus-4-6 --effort high`)**:

   * **Scope**: `docs/features/auth`, `docs/features/sharing`, `docs/architecture/CHINA.md`, `openspec/changes/pluggable-backend-live-sharing`.

   * **Deliverables**: Pluggable authentication providers, China/Global sync implementations, live-sharing client integrated with the validated `services/share` API contracts, deep-link handling, and unit/integration tests.

3. **Worker `feature-memos-media` (`--agent antigravity --model pro --effort medium`)**:

   * **Scope**: `docs/features/memos`, `docs/features/media`.

   * **Deliverables**: Rich event memos, local & cloud image/media attachment management, compression/caching, Compose UI flows, and unit/UI tests.

4. **Worker `feature-customization-widgets-premium` (`--agent antigravity --model pro --effort medium` + `--model flash --effort low` for styling/boilerplate)**:

   * **Scope**: `docs/features/customization`, `docs/features/widgets`, `docs/features/premium`, `design/v2/`.

   * **Deliverables**: Custom backgrounds/fonts/card styles matching `design/v2/`, Android home-screen AppWidgets/Glance widgets, premium entitlement gates, and unit/widget tests.

## 4. Canonical Orca Dispatch Loop & Worker Preamble Contract

1. **Create the Durable Run**:

   ```
   ORCA orchestration run-create \
     --objective "Validate services/share and implement days-that-matter Android app with ADB verification" \
     --json
   
   ```

2. **Enforce the 6-Point Task-Spec Contract on Every `task-create` / `worker-start`**:
   Every worker prompt you dispatch must be self-contained and specify:

   * **Target**: Exact specification files under `docs/` and `design/` to read, and the exact directory/package the worker owns.

   * **Change**: The concrete implementation and OpenSpec tasks (`openspec/changes/<change-id>/tasks.md`) to complete and check off (`[x]`).

   * **Constraints & File Ownership**: Adhere strictly to `AGENTS.md`, `docs/standards/CODING_STANDARDS.md`, and `docs/ci-cd/TOOLCHAIN_GUIDELINES.md`. Never modify files outside your assigned module or touch root Gradle files without asking the Coordinator via `ORCA orchestration ask`. Do not run `adb install` directly from parallel workers—leave physical device `172.16.30.1:5555` testing to the Coordinator's serialized QA step.

   * **Mandatory Test Coverage**: Per `docs/standards/TESTING_STRATEGY.md`, every new class, endpoint, ViewModel, use case, calculation helper, and Compose screen MUST ship with automated tests (Vitest for `services/share`; JUnit5/JUnit4, Coroutines Test, Turbine, and Compose UI Test for Android). Code without tests will be rejected at the merge gate.

   * **Strict UI Design Parity (`design/DESIGN_SYSTEM.md` & `design/v2/`)**: Match the layout, color tokens, typography, card geometry, spacing, and micro-interactions in `design/DESIGN_SYSTEM.md` and `design/v2/{index.html,styles.css,app.js}`. Do not deviate from the reference design unless the change is an explicit, measurable UX, Android platform-ergonomic, or accessibility improvement—and if you make such an improvement, you must explicitly document the rationale in your `worker_done` summary and save it to AgentMemory.

   * **AgentMemory & Lifecycle Protocol**:

     * Run `memory_smart_search` at task start to pull shared architecture and API contracts.

     * Run `memory_save` (with concept tags `["days-that-matter", "<change-id>", "<module>"]`) before finishing to record newly created interfaces, design improvements, or bug root causes.

     * Check coordinator messages at natural checkpoints via `ORCA orchestration check --terminal <your_handle> --json` and finish with a single `worker_done` command carrying `--outcome succeeded|failed`, `--files-modified`, and a 3-sentence executive summary.

3. **Fan Out Parallel Workers, Then Block on `check --wait`**:
   Launch all ready tasks in the wave first, then wait event-driven (never use `sleep` loops):

   ```
   ORCA orchestration check \
     --wait \
     --types "worker_done,escalation,question" \
     --timeout-ms 900000 \
     --json
   
   ```

   * When a worker sends a `question` (`ask`), resolve it immediately from OpenSpec/AgentMemory context via `ORCA orchestration reply --id <message_id> --body "<answer>" --json`.

## 5. Orchestrator Validation, Wireless ADB Testing & Merge Approval Protocol

Never trust a worker's `worker_done` claim on faith. Whenever a worker settles, execute this **4-Gate Verification Protocol** before approving a merge:

### Gate 1: Code, OpenSpec & Automated Test Coverage Gate

1. Read the worker's output (`ORCA orchestration worker-read --dispatch <dispatch_id> --limit 80 --json`) and inspect `git diff` in the worker's worktree.

2. Verify OpenSpec compliance:

   ```
   openspec validate <change-id> --strict --json
   
   ```

   Run `/opsx:verify <change-id>` to check **Completeness** (all `tasks.md` items checked, all spec scenarios covered), **Correctness**, and **Coherence**.

3. Verify **Test Execution & Test Coverage** (`docs/standards/TESTING_STRATEGY.md`):

   * **For `services/share`**:

     ```
     cd services/share && npx tsc --noEmit && npx eslint . && npx vitest run --coverage
     
     ```

     Confirm unit and integration tests cover all routes, D1 schema migrations, auth/permission boundaries, error codes, and edge cases.

   * **For Android branches**:

     ```
     ./gradlew lintDebug testDebugUnitTest
     
     ```

     Confirm unit tests exist and pass for every ViewModel, repository, sync adapter, and domain calculator, and Compose UI tests exist for every screen/component.

### Gate 2: Live Wireless Android Device Verification (`172.16.30.1:5555`) & Design Parity Gate

For every Android branch (starting with Wave 0 and repeating for each Wave 1 feature branch):

1. **Ensure Wireless ADB Health & Install Debug APK**:

   ```
   adb connect 172.16.30.1:5555
   adb -s 172.16.30.1:5555 wait-for-device
   ./gradlew installDebug
   
   ```

2. **Run On-Device Instrumentation Tests**:

   ```
   ANDROID_SERIAL=172.16.30.1:5555 ./gradlew connectedDebugAndroidTest
   
   ```

3. **Exercise Flows, Capture Screenshots & Inspect UI Hierarchy via Android Skills / ADB**:

   * Clear logcat (`adb -s 172.16.30.1:5555 logcat -c`), launch the app (`adb -s 172.16.30.1:5555 shell monkey -p <package_name> -c android.intent.category.LAUNCHER 1` or `am start`), and navigate through each newly implemented screen and widget using your Android skills or `adb -s 172.16.30.1:5555 shell input` / `uiautomator dump`.

   * Capture live screenshots from the device:

     ```
     adb -s 172.16.30.1:5555 exec-out screencap -p > /tmp/device_screen_verify.png
     
     ```

   * Check `adb -s 172.16.30.1:5555 logcat -d *:E` to confirm zero crashes, ANRs, Room migration exceptions, or unhandled network errors.

4. **Compare UI Against `design/DESIGN_SYSTEM.md` & `design/v2/`**:

   * Inspect `/tmp/device_screen_verify.png` (and `services/share/public/` in Orca's browser) side-by-side against `design/DESIGN_SYSTEM.md` and `design/v2/{index.html,styles.css,app.js}`.

   * Verify colors, typography, card radii/shadows, countdown badge alignments, dark/light theme tokens, and interactive states match the design.

   * **Design Deviation Rule**: Any visual difference from `design/v2/` or `design/DESIGN_SYSTEM.md` is a **defect** unless it is an explicit, documented UX or Android platform improvement (e.g., proper edge-to-edge system bar insets, accessibility touch target ≥ 48dp, or dynamic Material3 adaptation) with a clear justification recorded by the worker.

### Gate 3: Feedback Loop (Reject) vs. Merge Approval (Accept)

* **If ANY Gate Fails (Missing Tests, Failing Build/Lint, Crash on `172.16.30.1:5555`, or Unjustified UI Drift)**:

  1. **Reject the Merge**: Do NOT merge the branch and do NOT release the worker worktree yet.

  2. **Send Actionable Feedback**: Re-dispatch or message the worker in the same worktree with the exact failing test names, logcat stack trace, missing test-coverage scenarios, or specific visual discrepancies vs. `design/v2/`.

  3. Record the regression lesson in AgentMemory (`memory_save` with concepts `["qa-feedback", "<change-id>", "<module>"]`) so peer workers avoid the same mistake.

* **If ALL Gates Pass**:

  1. **Approve & Merge**: Merge the validated child worktree branch cleanly into the target integration branch and run a quick post-merge smoke test (`./gradlew assembleDebug testDebugUnitTest`).

  2. **Release the Worker Terminal**:

     ```
     ORCA orchestration worker-release --dispatch <dispatch_id> --json
     ORCA orchestration check --ack <delivery_id> --wait --types "worker_done,escalation,question" --timeout-ms 900000 --json
     
     ```

### Gate 4: Living Documentation, OpenSpec Sync & Memory Consolidation

After `services/share` validation and after each Android wave is merged, dispatch a low-effort documentation worker (`--agent antigravity --model flash --effort low` or `--agent claude --model claude-haiku-4-5 --effort low`) or execute directly:

1. **Update Status & Architecture Documentation**:

   * Update `docs/plans/SHARE_SERVICE_STATUS.md` and `docs/plans/SHARE_SERVICE_IMPLEMENTATION_PLAN.md` with verified Vitest results, coverage numbers, and endpoint statuses.

   * Update `README.md`, `services/share/README.md`, `AGENTS.md`, and relevant `docs/features/*` / `docs/architecture/*` files to reflect the implemented Android modules, build/test commands, wireless ADB workflow, and any approved UI improvements over `design/v2/`.

2. **Sync & Archive OpenSpec Changes**:

   * If approved UI or technical improvements were made during implementation, update the change artifacts first via `/opsx:update <change-id>`.

   * Sync delta specs into `openspec/specs/` via `/opsx:sync <change-id>` and archive completed changes:

     ```
     openspec validate <change-id> --strict --json
     openspec archive <change-id> --yes
     openspec validate --all --strict --json
     
     ```

3. **Save Final Milestone Memory & Clean Up**:

   * Persist a complete milestone summary to AgentMemory (`memory_save` with concepts `["milestone-approved", "days-that-matter", "<change-id>"]`).

   * Confirm zero leaked worker terminals remain before ending the orchestration run:

     ```
     ORCA orchestration worker-list --run <run_id> --terminal-state reclaimable --json
     
     ```

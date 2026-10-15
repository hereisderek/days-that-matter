# Coordinator handoff

Everything a new coordinator (a person, or an agent such as Antigravity) needs to continue the work. Written 2026-10-15 when the coordinator role moved away from Claude Code. Read `AGENTS.md` first; this file adds the state and the practical details that are not in it.

## 1. Where progress is tracked

| What | Where | Command |
| :--- | :--- | :--- |
| Implementation progress (source of truth) | `openspec/changes/<change>/tasks.md` checkboxes and the notes under each task | `openspec list`, `openspec validate --all --strict` |
| Behavior and decisions | `openspec/changes/pluggable-backend-live-sharing/` (`proposal.md`, `design.md` D1 to D22, `specs/`), and `design-v2-features/` | |
| Open items without a task yet | `docs/plans/TODO.md` | |
| Who is working on what | the Orca run `run_b3f9302d8987` (workers and their dispatches) | `orca orchestration run-use --id run_b3f9302d8987`, `orca orchestration worker-list --run run_b3f9302d8987 --json` |
| Branches and worktrees | git and Worktrunk | `wt list`, `git worktree list` |
| Short decisions and lessons for agents | AgentMemory (REST, port 3111, secret in `~/.agentmemory/secret`), plus this file | `curl -X POST http://localhost:3111/agentmemory/smart-search` |
| Rules | `AGENTS.md` (rules 1 to 14) and `.agents/skills/days-that-matter-orchestrator/SKILL.md` | |

Claude Code also kept notes in its own memory folder (`/opt/config/claude/projects/-workspace-myapp-days-that-matter/memory/`). Other agents cannot see it, so its contents are copied into section 6.

Worker reports live only in scratch directories and are lost. A worker's findings must end up in `tasks.md` notes, `docs/` or AgentMemory before its branch is merged (AGENTS.md rule 9).

## 2. The coordinator loop

1. Start of every turn and after every long wait: check the inbox, acknowledging each batch (heartbeats hide the real `worker_done` behind them): `orca orchestration check --types "worker_done,escalation,question" --json`, then `... check --ack <delivery_id> ...`.
2. Dispatch workers with a self-contained brief (target files, change, constraints and ownership, observable acceptance, memory and lifecycle).
3. Answer questions fast, from the specs. Decisions that belong to the owner are asked once, with a recommendation.
4. When a worker reports done: validate yourself (ownership of changed files, build, tests, lint, device check for UI), merge, smoke test, clean up, report. Cleanup is automatic and in the same turn (AGENTS.md rule 9): release and acknowledge, `orca terminal close`, stop leftover processes in the worktree, `wt remove` and `git branch -d` (never `--force`, `-D`, `--reap` without the owner's yes), then verify with `git worktree list`, `orca terminal list`, `orca orchestration worker-list --run <run> --terminal-state reclaimable`, `ps`.
5. Merging into `master` and pushing need the owner's explicit yes each time. No force-push, no tags.
6. Specs first: a behavior change starts in OpenSpec (`/opsx:update`), then code.

## 3. Environment

- Host: the agent LXC (`172.16.2.26`), 10 GB RAM, 6 GB swap. Run every Gradle command as `cd mobile && flock /tmp/dtm-gradle.lock ./gradlew ... --console=plain` (one build at a time across all workers), and `./gradlew --stop` afterwards. Workers were OOM-killed on a smaller host: `journalctl --user | grep -i oom` explains a worker that vanishes.
- Test device: a Pixel 4 (Android 13) over wireless ADB, `172.16.30.1:5555` (it also shows by USB serial `99251FFAZ002D2`; one device). Only the coordinator installs on it. Use `adb -s 172.16.30.1:5555 ...`.
- Container host for Docker or Podman work: `podman-lxc` (`172.16.2.29`), SSH key trusted. Nothing of the project runs there now.
- Browser for design review: no browser on the host. The owner's Mac runs Chrome with a throwaway profile and an SSH tunnel; the capture script `design/v2/offline-accounts/capture-cdp.mjs` drives it over the DevTools protocol with Node 22's built-in WebSocket (instructions in its header and in `design/v2/README.md` 9.10). Disable the browser cache when capturing, or a stale `app.js` is captured.
- Tools: JDK 21, Gradle wrapper 9.8.1 (in `mobile/`), Node 22, `openspec`, `wt` (Worktrunk), `orca`, `adb`, Android SDK platforms 34, 36, 37.0, 37.2 under `/opt/tools/android-sdk`. Ask before installing anything else (machine notes).
- Worktrees: create with `wt switch --create <branch> --base <ref> --no-cd`, then pass `--worktree path:<absolute path>` to Orca. A brand-new worktree can give `selector_not_found` for a few seconds: retry.
- A coordinator terminal must be bound to the run: `orca orchestration run-use --id run_b3f9302d8987`; `consumer_fenced` means it is not.

## 4. Models and agents

- Claude Code: `--agent claude --model opus|sonnet|haiku` (Opus for architecture, security, schema; Sonnet for standard work). Claude usage is limited and shared with the coordinator session.
- Antigravity: `--agent antigravity --model <exact id>`. Exact ids from `agy models`: `gemini-3.8-flash-low|medium|high`, `claude-opus-5-5-*`, `claude-sonnet-5-5-*`, `gpt-oss-120b`. The aliases `flash` and `pro` are NOT recognized and silently fall back to Claude Opus 5.5; Orca's receipt still echoes the alias. After every start, check `ps -eo args | grep 'agy '` and the terminal footer. The Claude models inside Antigravity have their own quota that ran out on 2026-10-15; use Gemini for routine work and, when a worker is cut off, restart it on Gemini in the same worktree telling it to review the uncommitted edits first.
- Routing and cost: AGENTS.md rule 11.

## 5. State on 2026-10-15

Done and on `master`: Kotlin Multiplatform project (AGP 9.4.1, Kotlin 2.4.21, Compose Multiplatform 1.12.1), mobile move to `mobile/` (done; Gradle root is `mobile/`, commands run as `cd mobile && ./gradlew ...`), `:core:model` (types, validation, merge, projections, plan table, countdown engine, vector and contract generators), `:core:designsystem` (v2 theme and components), `:core:database` (Room v2), `:feature:events` (Home, Day, Archived), `:feature:eventeditor` (create and edit), Navigation 3 shell; TypeScript backend core (`backend/`: HTTP layer, ports, SqlStore, accounts, sync, history, sharing, link resolution, `countdown.js`, generated contract), the v2 design prototype for offline use, limits, import, files and widgets, and the specs for local mode, remote config, batch and import.

Not done, in this order:
1. Group 12 of `tasks.md`: backend batch and import (12.1) and remote config (12.2), then the model and `:core:remoteconfig` (12.3, 12.4), then the app work (12.5 to 12.11), then docs (12.12). The code still enforces the old Free limits (10 events, 3 Spotify) and still contains the old first-upload exception until 12.1 and 12.3 land.
2. Earlier backend tasks: media upload and plan gates (3.10, 3.12), purchases (3.11), rate limits and maintenance (3.13), share page rendering (3.14), the conformance suite (group 4), variants (groups 5, 8 to 10), launch work (group 11). App tasks 7.1 to 7.11 (network client, sign-in, sync engine, live updates, share screens, history, backdrops, purchases, audio).
3. Design-v2 tasks still open: pinned carousel and card sizes UI (2.8, the prototype's collapse fix is documented), notifications (group 3), smart days (group 4).

Open owner questions: days versus events vocabulary in user text (`docs/plans/TODO.md`); the AI-friendly app meaning; the analytics tool; the real application id (`dev.derek.daysthatmatter` is provisional).

## 6. Decisions and lessons (also kept in Claude's memory)

- Always use the latest stable release of every dependency, SDK, targetSdk and Gradle unless the owner pins a version; install a missing SDK platform instead of downgrading. One exception on record: TypeScript stays on 6.0 until `typescript-eslint` supports 7 (`backend/README.md`).
- `backend/core` is TypeScript; Kotlin/JS stays an option (design D1 lists when to revisit).
- Finished workers are cleaned up automatically in the same turn; the inbox is checked at the start of every turn.
- Simple, well-specified work goes to Antigravity (Gemini); Claude is kept for the work that needs it.
- Memory limits and Gradle settings that avoid OOM kills are in `docs/ci-cd/TOOLCHAIN_GUIDELINES.md`.
- Sign-out: unsent changes stay in the hidden account database and are sent after the user signs in to that account again (decided 2026-10-15).
- Import is all or nothing; local events are removed only after the backend lists every imported id with no dropped field and they are in the account database on the device.
- Every JSON API lives under `/api/v1/` and is protected by the access token except the listed public endpoints; endpoint suggestions are reviewed against `docs/standards/API_DESIGN.md`; user-facing text follows `docs/standards/USER_COPY.md`.
- Pitfalls met: `pgrep -f` matches its own shell (kill by exact PID); Chrome caches `app.js` through the tunnel; `wt remove` says "Branch unmerged" when the branch is merged only into another branch (use `git branch -d` after checking `git merge-base --is-ancestor`); Orca keeps terminals in `wt` worktrees as `retained`, so close them yourself.

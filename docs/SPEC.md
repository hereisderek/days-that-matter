# Days That Matter — Master Specification

## 1. Product Mission & Vision
**Days That Matter** is a modern, high-precision milestone and countdown application built with **Kotlin Multiplatform (KMP)** and **Compose Multiplatform (CMP)**.

The app helps users track meaningful moments in their lives—past anniversaries, future milestones, recurring celebrations, and daily goals—with elegance, emotion, and deep personalization.

### Core Tenets
1. **Uncompromising User Experience:** Fluid 60/120fps animations, intuitive gesture navigation, instant offline responsiveness, and zero visual clutter.
2. **Precision & Depth:** Multi-unit countdown calculations down to seconds, intelligent recurring events, and time-zone resilience.
3. **Emotional Resonance:** Rich customization including bespoke card aesthetics, typography, full-bleed imagery, and atmospheric background audio.
4. **Universal Accessibility:** Android and iOS first, with native home-screen and lock-screen widgets. Desktop (JVM) and Web (Wasm) apps follow. Shared events open in any browser.
5. **Privacy & Offline-First:** Full offline utility powered by local SQLite/Room. Guests keep everything on the device. Signed-in users sync everything through our own backend, which can run on several providers.

---

## 2. Platform & Toolchain Matrix

| Component | Standard | Target / Requirement |
| :--- | :--- | :--- |
| **Language** | Kotlin 2.1+ | Modern K2 compiler enabled |
| **UI Framework** | Compose Multiplatform 1.8+ | Material 3 Adaptive Design |
| **Build System** | Gradle 8.13+ (Kotlin DSL) | Version catalog (`gradle/libs.versions.toml`) |
| **JDK Runtime** | JDK 21 LTS | Temurin / OpenJDK 21 |
| **Android Targets** | Compile SDK 35/36, Min SDK 26 | 16KB page alignment compliant |
| **iOS Targets** | iOS 16.0+ | Compose Multiplatform UI + native WidgetKit |
| **Desktop Target** (later) | macOS (ARM/x64), Windows, Linux | JVM 21, Skiko GPU-accelerated |
| **Web Target** (later) | Kotlin/Wasm | Canvas-based rendering with JS fallback |
| **Local Persistence**| Room KMP 2.7+ | Multiplatform SQLite with reactive Flow queries |
| **Backend** | `backend/core/` (Kotlin/JS or TypeScript, chosen by measured CPU time and cost) + one variant per provider; rules from `:core:model` | Accounts, sync, sharing, history, backdrops, audio, plans, share web page. Variants: Cloudflare (Workers, D1, R2, Durable Objects; primary), self-host (Node, SQLite), Vercel (Functions, Turso, Blob), Firebase (Functions, Firestore, Storage). See [`architecture/BACKEND.md`](architecture/BACKEND.md) |
| **Purchases** | StoreKit 2 / Play Billing through RevenueCat | Premium subscriptions, verified by the backend. See [`features/premium/SPEC.md`](features/premium/SPEC.md) |
| **Network Client** | Ktor + kotlinx-serialization | One HTTP API on every backend provider |
| **Dependency Inj.** | Koin 4.0+ | Compose ViewModel integration |

---

## 3. System Architecture Specification

The codebase adheres strictly to **Clean Architecture** with unidirectional data flow (MVI / MVVM + StateFlow):

```
┌────────────────────────────────────────────────────────┐
│                   Presentation Layer                   │
│   (Compose Multiplatform UI + ViewModels + Navigation) │
└───────────────────────────┬────────────────────────────┘
                            │ depends on
┌───────────────────────────▼────────────────────────────┐
│                      Domain Layer                      │
│        (Use Cases, Domain Models, Repository Intfs)    │
│              *Pure Kotlin - Zero Platform Dep*         │
└───────────────────────────▲────────────────────────────┘
                            │ implemented by
┌───────────────────────────┴────────────────────────────┐
│                       Data Layer                       │
│   (Local DB: Room KMP, Remote: backend API via Ktor)   │
└────────────────────────────────────────────────────────┘
```

### Architectural Mandates
1. **Pure Domain Layer:** Under no circumstances should domain models or use cases import platform packages (e.g., `android.*`, `java.*`).
2. **Unidirectional Data Flow:** Screens observe immutable `UiState` and emit explicit user `UiIntent` actions. One-off effects (snackbars, navigation) use `SharedFlow<UiEffect>`.
3. **Repository Pattern:** Repositories serve as the single source of truth, managing local caching and remote sync transparently.
4. **Type-Safe Routing:** Navigation must use Compose Multiplatform Navigation 2.8+ with `@Serializable` destination objects.

---

## 4. Reorganized Feature Matrix

All feature-specific requirements, data models, UI flows, and edge cases are isolated in dedicated feature folders:

| Feature Area | Folder Location | Scope & Highlights |
| :--- | :--- | :--- |
| **Authentication** | [`docs/features/auth/SPEC.md`](features/auth/SPEC.md) | Guest mode, sign-in prompt, Google and Apple sign-in, sessions |
| **Event Engine** | [`docs/features/events/SPEC.md`](features/events/SPEC.md) | Countdown engine, recurring cadences, sorting, categorization |
| **Customization** | [`docs/features/customization/SPEC.md`](features/customization/SPEC.md) | Theming, card styles, typography, color palettes, still and animated (Live/Motion) photo backdrops |
| **Media & Audio** | [`docs/features/media/SPEC.md`](features/media/SPEC.md) | Built-in audio catalog, Spotify links, loop/fade controls |
| **Sharing & Links** | [`docs/features/sharing/SPEC.md`](features/sharing/SPEC.md) | Public links, people link and invites, live updates, history, web page, App Links, card export, QR |
| **Widgets** | [`docs/features/widgets/SPEC.md`](features/widgets/SPEC.md) | Android Glance widgets, iOS WidgetKit, Lock-screen complications |
| **Memos** | [`docs/features/memos/SPEC.md`](features/memos/SPEC.md) | Event milestone memories, collaborative notes, timestamps |
| **Premium** | [`docs/features/premium/SPEC.md`](features/premium/SPEC.md) | Plans, feature table, paywall and gating rules |
| **Backend** | [`docs/architecture/BACKEND.md`](architecture/BACKEND.md) | Core and provider variants, ports, data model, REST API contract, limits, free-tier budget |
| **Data & Sync** | [`docs/architecture/PERSISTENCE_AND_SYNC.md`](architecture/PERSISTENCE_AND_SYNC.md) | Room KMP schema, sync protocol with the backend, offline reconciliation |

---

## 5. Spec-Driven Changes

Behavior changes are written as [OpenSpec](https://github.com/Fission-AI/OpenSpec) changes in [`openspec/changes/`](../openspec/changes/). Archived changes form the behavior specs in [`openspec/specs/`](../openspec/specs/). The active change is [`pluggable-backend-live-sharing`](../openspec/changes/pluggable-backend-live-sharing/). See `AGENTS.md` section 3 for the workflow.

---

## 6. Quality & Compliance Standards

1. **Testing:**
   - 100% unit test coverage for mathematical time calculation algorithms and use cases.
   - ViewModel state tests using `kotlinx-coroutines-test` and Turbine.
   - Compose UI testing for core components.
2. **Accessibility & Usability:**
   - Dynamic Type / scalable font support.
   - Contrast ratio of >= 4.5:1 for all text elements over custom backgrounds.
   - Screen reader content descriptions for all icon buttons and counters.
3. **CI/CD Reliability:**
   - Automated pull request verification blocking merges on test or lint failure.
   - Repeatable, automated release tagging and artifact deployment.

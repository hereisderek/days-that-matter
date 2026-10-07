# Days That Matter — Master Specification

## 1. Product Mission & Vision
**Days That Matter** is a modern, high-precision milestone and countdown application built with **Kotlin Multiplatform (KMP)** and **Compose Multiplatform (CMP)**.

The app helps users track meaningful moments in their lives—past anniversaries, future milestones, recurring celebrations, and daily goals—with elegance, emotion, and deep personalization.

### Core Tenets
1. **Uncompromising User Experience:** Fluid 60/120fps animations, intuitive gesture navigation, instant offline responsiveness, and zero visual clutter.
2. **Precision & Depth:** Multi-unit countdown calculations down to seconds, intelligent recurring events, and time-zone resilience.
3. **Emotional Resonance:** Rich customization including bespoke card aesthetics, typography, full-bleed imagery, and atmospheric background audio.
4. **Universal Accessibility:** Seamless operation across Android, iOS, Desktop (JVM), and Web (Wasm), with native home-screen and lock-screen widgets.
5. **Privacy & Offline-First:** Full offline utility powered by local SQLite/Room, optional cloud sync via Firebase with end-to-end security rules.

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
| **Desktop Target** | macOS (ARM/x64), Windows, Linux | JVM 21, Skiko GPU-accelerated |
| **Web Target** | Kotlin/Wasm | Canvas-based rendering with JS fallback |
| **Local Persistence**| Room KMP 2.7+ | Multiplatform SQLite with reactive Flow queries |
| **Cloud Backend** | Firebase (Auth, Firestore, Storage)| Multiplatform SDK with strict security rules |
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
│    (Local DB: Room KMP, Remote: Firebase/Ktor, Cache)  │
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
| **Authentication** | [`docs/features/auth/SPEC.md`](file:///workspace/myapp/days-that-matter/docs/features/auth/SPEC.md) | Guest mode, Email/Password, Google Sign-In, Session sync |
| **Event Engine** | [`docs/features/events/SPEC.md`](file:///workspace/myapp/days-that-matter/docs/features/events/SPEC.md) | Countdown engine, recurring cadences, sorting, categorization |
| **Customization** | [`docs/features/customization/SPEC.md`](file:///workspace/myapp/days-that-matter/docs/features/customization/SPEC.md) | Theming, card styles, typography, color palettes, custom images |
| **Media & Audio** | [`docs/features/media/SPEC.md`](file:///workspace/myapp/days-that-matter/docs/features/media/SPEC.md) | Ambient music playback, audio uploads, loop/fade controls |
| **Sharing & Links** | [`docs/features/sharing/SPEC.md`](file:///workspace/myapp/days-that-matter/docs/features/sharing/SPEC.md) | Universal / App Links, web preview fallback, card image export, QR |
| **Widgets** | [`docs/features/widgets/SPEC.md`](file:///workspace/myapp/days-that-matter/docs/features/widgets/SPEC.md) | Android Glance widgets, iOS WidgetKit, Lock-screen complications |
| **Memos** | [`docs/features/memos/SPEC.md`](file:///workspace/myapp/days-that-matter/docs/features/memos/SPEC.md) | Event milestone memories, collaborative notes, timestamps |
| **Data & Sync** | [`docs/architecture/PERSISTENCE_AND_SYNC.md`](file:///workspace/myapp/days-that-matter/docs/architecture/PERSISTENCE_AND_SYNC.md) | Room KMP schema, Firestore collections, offline reconciliation |

---

## 5. Quality & Compliance Standards

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

# System Architecture & Technical Design

## 1. Clean Architecture & Unidirectional Data Flow

Days That Matter follows Clean Architecture with a strict separation between Presentation, Domain, and Data layers:

```
┌─────────────────────────────────────────────────────────────┐
│                     Presentation Layer                      │
│     Compose Multiplatform (Android, iOS, Desktop, Wasm)     │
│        ViewModels (StateFlow<UiState>, UiIntent, Effect)    │
└──────────────────────────────┬──────────────────────────────┘
                               │ depends on
┌──────────────────────────────▼──────────────────────────────┐
│                        Domain Layer                         │
│           Pure Kotlin — 0 Platform Dependencies             │
│      Use Cases, Business Models, Repository Interfaces      │
└──────────────────────────────▲──────────────────────────────┘
                               │ implemented by
┌──────────────────────────────┴──────────────────────────────┐
│                         Data Layer                          │
│   Repositories, Room KMP local DB, backend API (Ktor)       │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Dependency Injection with Koin

Dependency injection is managed via **Koin 4.0+** using standard multiplatform module definitions:

```kotlin
// commonMain DI modules
val appModule = module {
    // Database & DAOs
    single { get<AppDatabase>().eventDao() }
    single { get<AppDatabase>().memoDao() }

    // Repositories
    single<EventRepository> { EventRepositoryImpl(get(), get(), get()) }
    single<AuthRepository> { AuthRepositoryImpl(get()) }

    // Use Cases
    factory { CalculateTimeRemainingUseCase() }
    factory { ObserveEventsUseCase(get()) }
    factory { UpsertEventUseCase(get(), get()) }

    // ViewModels
    viewModel { HomeViewModel(get(), get()) }
    viewModel { EventDetailViewModel(get(), get(), get(), get()) }
    viewModel { EventEditViewModel(get(), get(), get()) }
}
```

Platform-specific modules (providing native database builders, credential managers, audio players) are resolved via `expect/actual` or platform-specific initialization entry points.

---

## 3. Modularization Strategy

```
days-that-matter/
├── core/
│   ├── model/            # Pure Kotlin, SHARED WITH THE SERVER: EventDoc, field sets, roles, validation,
│   │                     #   patch/merge, projections, countdown engine, API DTOs, error codes
│   │                     #   Targets: android, iosArm64, iosSimulatorArm64, jvm, js
│   ├── common/           # Coroutine dispatchers, date/time utilities, result wrappers
│   ├── database/         # Room KMP entity definitions, migrations, DAOs
│   ├── network/          # Ktor client for the backend API, live updates client (WebSocket or polling)
│   ├── designsystem/     # Material 3 Adaptive theme, typography, color palettes, shared UI
│   └── audio/            # Multiplatform audio playback engine abstraction
├── feature/
│   ├── auth/             # Sign in with Google and Apple, guest onboarding, account settings
│   ├── events/           # Event listing, filtering, search, sorting
│   ├── eventdetail/      # Live countdown view, milestone progress, audio player overlay
│   ├── eventeditor/      # Creation/editing form, recurrence, customization and backdrop picker
│   ├── sharing/          # Public links, people link, invites, people list, history and restore
│   └── memos/            # Milestone reflections and timeline notes
├── platform/
│   ├── android/          # Glance AppWidgets, credentials, media compression (Media3 Transformer)
│   ├── ios/              # iOS entry point, WidgetKit bridge, media compression (AVFoundation)
│   ├── desktop/          # Later: JVM entry point, window lifecycle, menu bar tray
│   └── web/              # Later: Wasm browser canvas entry point
├── composeApp/           # Main application shell and root navigation graph
├── server/               # Backend, see docs/architecture/BACKEND.md
│   ├── core/             # Kotlin (jvm, js): router, handlers, ports, SqlStore, page rendering
│   ├── migrations/       # SQLite migrations shared by D1, self-host and Turso
│   ├── web/              # Share page static assets and scripts
│   ├── conformance/      # HTTP test suite run against every adapter
│   └── cloudflare/ selfhost/ vercel/ firebase/   # one adapter per provider
└── openspec/             # Spec-driven changes and behavior specs
```

Dependency rules:
- `core/model` depends on nothing but kotlinx-serialization and kotlinx-datetime. Both the app and `server/core` depend on it.
- `server/core` never depends on `core/network`, `core/database` or any vendor SDK.
- Adapter modules depend on `server/core` and their vendor SDK only.

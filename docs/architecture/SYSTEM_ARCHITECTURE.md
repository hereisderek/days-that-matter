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
│   ├── auth/             # Google, Apple and email code sign-in, guest onboarding, account settings
│   ├── events/           # Event listing, filtering, search, sorting
│   ├── eventdetail/      # Live countdown view, milestone progress, audio player overlay
│   ├── eventeditor/      # Creation/editing form, recurrence, customization, backdrop and audio pickers
│   ├── sharing/          # Public links, invite links, join flow, members, history and restore
│   ├── premium/          # Paywall, restore purchases, plan state (StoreKit 2 bridge, Play Billing)
│   ├── notifications/    # Local reminders, push registration, notification settings
│   └── memos/            # Milestone reflections and timeline notes
├── platform/
│   ├── android/          # Glance AppWidgets, credentials, Motion Photo extraction and Media3 Transformer
│   ├── ios/              # iOS entry point, WidgetKit bridge, Live Photo conversion (AVFoundation), StoreKit 2 bridge, share extension
│   ├── desktop/          # Later: JVM entry point, window lifecycle, menu bar tray
│   └── web/              # Later: Wasm browser canvas entry point
├── composeApp/           # Main application shell and root navigation graph
├── backend/              # See docs/architecture/BACKEND.md
│   ├── core/             # ALL backend behavior: API, auth, sync, sharing, history, media checks, plans, audio,
│   │                     #   pages, purge; plus migrations/, web/, audio/catalog.json, conformance/
│   ├── cloudflare/       # variant: Workers entry, D1, R2, Durable Object, wrangler config
│   ├── selfhost/         # variant: Node entry, SQLite file, disk storage, WebSocket hub, Docker
│   ├── vercel/           # variant: handler, Turso, Vercel Blob, cron
│   └── firebase/         # variant: function entry, Firestore, Cloud Storage, Hosting config
└── openspec/             # Spec-driven changes and behavior specs
```

Dependency rules:
- `core/model` depends on nothing but kotlinx-serialization and kotlinx-datetime. The app depends on it; the backend core either compiles it in (Kotlin/JS) or uses the contract files generated from it (TypeScript).
- `backend/core` never depends on app modules or any vendor SDK.
- A variant depends on `backend/core` and its own vendor SDK only, and contains no behavior of its own.

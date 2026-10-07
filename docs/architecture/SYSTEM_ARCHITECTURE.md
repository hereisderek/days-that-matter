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
│     Repositories, Room KMP Local DB, Firebase Cloud Sync    │
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
│   ├── model/            # Pure Kotlin domain data models
│   ├── common/           # Coroutine dispatchers, date/time utilities, result wrappers
│   ├── database/         # Room KMP entity definitions, migrations, DAOs
│   ├── network/          # Firebase clients and network data sources
│   ├── designsystem/     # Material 3 Adaptive theme, typography, color palettes, shared UI
│   └── audio/            # Multiplatform audio playback engine abstraction
├── feature/
│   ├── auth/             # Login, Google Sign-in, guest onboarding
│   ├── events/           # Event listing, filtering, search, sorting
│   ├── eventdetail/      # Live countdown view, milestone progress, audio player overlay
│   ├── eventeditor/      # Creation/editing form, recurrence, customization picker
│   └── memos/            # Milestone reflections and timeline notes
├── platform/
│   ├── android/          # Glance AppWidgets, push notifications, credentials
│   ├── ios/              # iOS entry point, WidgetKit SwiftUI extension bridge
│   ├── desktop/          # JVM entry point, window lifecycle, menu bar tray
│   └── web/              # Wasm browser canvas entry point
└── composeApp/           # Main application shell and root navigation graph
```

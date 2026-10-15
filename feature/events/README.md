# :feature:events

Home, the Archived screen and the day page (docs/features/events/SPEC.md, design-v2 `home-screen` and `countdown-units`), built from `design/v2` with the components of `:core:designsystem`.

## Layers

- `domain/`: pure Kotlin. `EventRepository`, `StoredEvent`, `HomeQuery` (search, filter, sort), `Categories`, `Ticker`, and the use cases: `ObserveEventsUseCase` (sections Pinned, Upcoming, Since with the countdown engine of `:core:model`), `ObserveEventUseCase`, `ObserveArchivedUseCase`, `ObserveArchivedCountUseCase`, `ArchiveEventUseCase` (also unpins), `UnarchiveEventUseCase`, `PinEventUseCase` (owner only), `DeleteEventUseCase`, `RestoreEventUseCase`, `SetUnitModeUseCase` (owner and editor).
- `data/RoomEventRepository`: offline first on `:core:database`; every write is local and immediate, no network. Synced rows collect their changes in `pending_patch` for the sync engine.
- `presentation/`: `HomeViewModel`, `EventDetailViewModel`, `ArchivedViewModel` (each a `StateFlow` of UI state, `onIntent`, and a one-shot effect flow), the screens `HomeRoute`/`HomeScreen`, `DayRoute`/`DayScreen`, `ArchivedRoute`/`ArchivedScreen`, and `CountdownText`/`CardLook`, which turn documents into card text and looks.
- `debug/`: DEBUG ONLY sample days (`SampleEvents`, `SeedSampleEventsUseCase`). `:composeApp` seeds them into an empty database only in debuggable builds.
- `di/eventsModule`: Koin. Needs an `AppDatabase` and a `kotlin.time.Clock` from the app shell.

Text is English for now; localized strings come with the app's resources.

## Tests

| Where | What | Command |
| :--- | :--- | :--- |
| `commonTest` | use cases (fake repository), ViewModels (Turbine, `StandardTestDispatcher`), `CountdownText`, `CardLook`, debug seed | runs on the jvm target and as Android host tests |
| `jvmTest` | `RoomEventRepository` on in-memory Room, Compose UI tests (headless, `runComposeUiTest`) for Home, Day and Archived | `./gradlew :feature:events:jvmTest` |

`./gradlew :feature:events:allTests` runs both (jvm and `testAndroidHostTest`). The jvm target exists only for these tests; no app links it.

## Not in this module yet

Event editor, sharing, sync engine, backdrops, audio, memos UI and badge, widgets, notifications, plans, sign-in, the pinned carousel and the card size picker.

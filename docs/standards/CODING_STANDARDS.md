# Engineering & Coding Standards

## 1. General Principles
- **Shared First:** Maximize logic, UI, and data code in `commonMain`. Platform-specific code (`androidMain`, `iosMain`, `jvmMain`, `wasmJsMain`) is reserved exclusively for native platform capabilities (e.g., WidgetKit, Glance, notifications, file pickers).
- **Immutability:** All domain models and UI states must be immutable `data class` structures. Never expose mutable collections or state to external consumers.
- **Explicit Scoping:** Coroutine jobs must be bound to structured scopes (`viewModelScope`, custom managed lifecycle scopes). Never launch in `GlobalScope`.

---

## 2. Architecture & Layer Separation

### 2.1 Domain Layer
- **Purity:** Strictly zero platform imports (`android.*`, `java.*`). Only Kotlin standard library and multiplatform libraries (`kotlinx-datetime`, `kotlinx-coroutines`).
- **Use Cases:** Granular and focused. Each use case encapsulates a single business action with an `operator fun invoke()`.

### 2.2 Data Layer
- **Repositories:** Abstract all data access. Repositories expose reactive Kotlin `Flow` streams for reads and suspending functions for writes.
- **Mappers:** Pure transformation functions mapping between Data Entities, DTOs, and Domain Models. Never leak Database Entities into Presentation.

### 2.3 Presentation Layer
- **Compose Multiplatform:** State hoisting and unidirectional data flow.
- **ViewModels:** ViewModels inherit from standard multiplatform lifecycle `ViewModel`. Expose a single `StateFlow<UiState>` and handle actions via explicit `onAction(UiAction)` or `onIntent(UiIntent)` functions.
- **Side Effects:** Single-event occurrences (navigation, snackbar alerts) use a buffered `SharedFlow<UiEffect>` or event channel.

---

## 3. Kotlin & Compose Idioms
- **Compose Functions:**
  - Must accept a `modifier: Modifier = Modifier` parameter as the first optional argument.
  - Avoid heavy computations directly inside `@Composable` functions; perform them in ViewModels or memoize with `remember(keys)`.
- **Flow & Coroutines:**
  - Use `StateFlow` instead of `LiveData`.
  - In Compose, collect flows using `.collectAsStateWithLifecycle()` from `androidx.lifecycle.runtime.compose`.
- **Error Handling:** Use Kotlin's `Result<T>` or explicit typed sealed classes (`DataError`) rather than throwing raw exceptions across architecture boundaries.

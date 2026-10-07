# Testing Strategy & Quality Assurance

## 1. Testing Pyramid

```
       /  UI Tests (Compose Multiplatform)  \
      /──────────────────────────────────────\
     /   Integration & Repository Tests (DB)  \
    /──────────────────────────────────────────\
   /   Unit Tests (Domain UseCases, ViewModels) \
```

---

## 2. Unit Testing Standards

### 2.1 Domain Logic & Calculation Algorithms
- **Target:** 100% test coverage for countdown and recurrence calculation engines.
- **Framework:** `kotlin.test`, `kotlinx-coroutines-test`.
- **Key Scenarios to Verify:**
  - Leap year calculations (Feb 29 &rarr; Feb 28 on non-leap years).
  - Timezone transitions (crossing Daylight Saving Time boundaries).
  - Countdown precisely hitting 0 seconds / event day transitions.
  - Multi-unit conversions (total days vs. years/months/days breakdown).

### 2.2 ViewModel Testing
- Test ViewModels using `Turbine` for testing `StateFlow` emissions.
- Use `StandardTestDispatcher` and `runTest` from `kotlinx-coroutines-test`.
- Validate full state progression: `Initial -> Loading -> Success / Error`.

---

## 3. Integration & Database Tests
- Test Room KMP DAOs using in-memory SQLite driver (`bundledSQLiteDriver()` or in-memory Room builder).
- Verify database migrations and schema integrity.

---

## 4. UI Testing (Compose Multiplatform)
- Use Compose UI testing library to assert component visibility, state changes upon click events, and accessibility semantics.

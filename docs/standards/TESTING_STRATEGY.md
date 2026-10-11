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

---

## 5. Backend Testing

Reference: [`BACKEND.md`](../architecture/BACKEND.md) section 14.

1. **Shared model (`:core:model`):** `kotlin.test` on every target (`./gradlew :core:model:allTests`). Validation tables with hostile input, patch and inverse round trips, projections (no owner-only field leaks), countdown engine.
2. **Server core (`:server:core`):** JVM tests against in-memory port fakes and SQLite (sqlite-jdbc). One test per spec scenario of the active OpenSpec change, named after the scenario.
3. **Store conformance:** one common test suite run against every `Store` implementation: `SqlStore` on JVM and on JS (`node:sqlite`), `FirestoreStore` against the Firestore emulator.
4. **HTTP conformance (`server/conformance/`):** black-box tests with Node's `node:test`, parameterised by `BASE_URL`, run against every adapter (`wrangler dev`, the self-host container, the Vercel handler on Node with a libSQL file, the Firebase emulators). A provider counts as supported only while this suite passes.
5. **Share page:** state and header tests, the XSS corpus over body, title, meta tags and the JSON data blob, `live.js` and `editor.js` with fake timers and a fake socket.
6. **Countdown parity:** a JVM task generates `server/web/test/countdown-vectors.json` from the Kotlin engine. `countdown.js` must pass every vector. CI fails when the committed file differs from a fresh generation.

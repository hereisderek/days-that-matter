# AGENTS.md

> Single source of truth for AI agents working on **Days That Matter**.

---

## 1. Project Overview & Mission

**Days That Matter** is a high-precision milestone and countdown application built with **Kotlin Multiplatform (KMP)** and **Compose Multiplatform (CMP)**, targeting Android, iOS, Desktop (JVM), and Web (Kotlin/Wasm).

- **Primary Specification:** [`docs/SPEC.md`](file:///workspace/myapp/days-that-matter/docs/SPEC.md)
- **User Documentation:** [`README.md`](file:///workspace/myapp/days-that-matter/README.md)

---

## 2. Agent Operational Rules & Protocols

1. **Verify & Align:** Before generating code or modifying architectural boundaries, rephrase requirements and verify alignment against the feature specification.
2. **Specification Adherence:** Never invent ad-hoc data schemas or business logic that diverge from the specifications in [`docs/features/`](file:///workspace/myapp/days-that-matter/docs/features/).
3. **Documentation Sync:** When a significant architectural choice, schema modification, or feature is added, update the corresponding documentation immediately.
4. **Toolchain Discipline:** Do not hardcode dependency versions in `build.gradle.kts`. Always use the Gradle Version Catalog (`gradle/libs.versions.toml`).
5. **No Platform Code in Domain:** Keep domain entities and use cases strictly pure Kotlin.

---

## 3. Specifications Index

### 3.1 Architectural & Technical Guidelines
- **Master Specification:** [`docs/SPEC.md`](file:///workspace/myapp/days-that-matter/docs/SPEC.md)
- **System Architecture & Modularization:** [`docs/architecture/SYSTEM_ARCHITECTURE.md`](file:///workspace/myapp/days-that-matter/docs/architecture/SYSTEM_ARCHITECTURE.md)
- **Persistence, Room KMP & Cloud Sync:** [`docs/architecture/PERSISTENCE_AND_SYNC.md`](file:///workspace/myapp/days-that-matter/docs/architecture/PERSISTENCE_AND_SYNC.md)
- **Coding Standards & Kotlin Idioms:** [`docs/standards/CODING_STANDARDS.md`](file:///workspace/myapp/days-that-matter/docs/standards/CODING_STANDARDS.md)
- **Testing Pyramid & QA Strategy:** [`docs/standards/TESTING_STRATEGY.md`](file:///workspace/myapp/days-that-matter/docs/standards/TESTING_STRATEGY.md)
- **CI/CD Pipeline & GitHub Workflows:** [`docs/ci-cd/WORKFLOW_PIPELINE.md`](file:///workspace/myapp/days-that-matter/docs/ci-cd/WORKFLOW_PIPELINE.md)
- **Share Service (Cloudflare Worker + D1, API contract, `services/share/`):** [`docs/architecture/SHARE_SERVICE.md`](file:///workspace/myapp/days-that-matter/docs/architecture/SHARE_SERVICE.md)
- **Share Service Implementation Plan:** [`docs/plans/SHARE_SERVICE_IMPLEMENTATION_PLAN.md`](file:///workspace/myapp/days-that-matter/docs/plans/SHARE_SERVICE_IMPLEMENTATION_PLAN.md)
- **Share Service Status, TODO & Next Steps:** [`docs/plans/SHARE_SERVICE_STATUS.md`](file:///workspace/myapp/days-that-matter/docs/plans/SHARE_SERVICE_STATUS.md)
- **Toolchain & Build Guidelines (JDK 21, Gradle 8.13+):** [`docs/ci-cd/TOOLCHAIN_GUIDELINES.md`](file:///workspace/myapp/days-that-matter/docs/ci-cd/TOOLCHAIN_GUIDELINES.md)

### 3.2 Feature Specifications
- **Authentication & Accounts:** [`docs/features/auth/SPEC.md`](file:///workspace/myapp/days-that-matter/docs/features/auth/SPEC.md)
  - Guest/Anonymous mode, Google Sign-In, Email/Password, session management.
- **Event Tracking & Countdown Engine:** [`docs/features/events/SPEC.md`](file:///workspace/myapp/days-that-matter/docs/features/events/SPEC.md)
  - Time calculation algorithms, recurrence schedules, categorization, filtering, and sorting.
- **Customization & Visual Theming:** [`docs/features/customization/SPEC.md`](file:///workspace/myapp/days-that-matter/docs/features/customization/SPEC.md)
  - Card styles, color palettes, gradients, custom wallpapers, typography presets, auto-contrast.
- **Media & Background Audio:** [`docs/features/media/SPEC.md`](file:///workspace/myapp/days-that-matter/docs/features/media/SPEC.md)
  - Multiplatform audio playback engine, file selection via FileKit, loop and fade controls.
- **Sharing, Deep Linking & Export:** [`docs/features/sharing/SPEC.md`](file:///workspace/myapp/days-that-matter/docs/features/sharing/SPEC.md)
  - App Links / Universal Links, web fallback, social card image exporter, QR codes. Backed by the share service (not Firebase).
- **Home & Lock Screen Widgets:** [`docs/features/widgets/SPEC.md`](file:///workspace/myapp/days-that-matter/docs/features/widgets/SPEC.md)
  - Jetpack Glance (Android) and WidgetKit (iOS) specifications, data synchronization.
- **Memos & Memory Notes:** [`docs/features/memos/SPEC.md`](file:///workspace/myapp/days-that-matter/docs/features/memos/SPEC.md)
  - Milestone reflections, timeline entries, author attribution, collaborative notes.

---

## 4. Quick Commands Reference

| Operation | Command |
| :--- | :--- |
| **Run Android Unit Tests** | `./gradlew testDebugUnitTest` |
| **Run Lint Check** | `./gradlew lintDebug` |
| **Build Android Debug APK** | `./gradlew :composeApp:assembleDebug` |
| **Build Android Release Bundle** | `./gradlew :composeApp:bundleRelease` |
| **Run Desktop (JVM)** | `./gradlew :composeApp:run` |
| **Run Web (Wasm)** | `./gradlew :composeApp:wasmJsBrowserDevelopmentRun` |

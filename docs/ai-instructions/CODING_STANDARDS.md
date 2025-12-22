# Coding Standards & Guidelines

## General Principles
- **Shared First:** Maximize code in `commonMain`. Only use `expect/actual` or platform-specific folders when necessary.
- **Documentation:** Maintain `AI_CONTEXT.md` as the source of truth for the AI's understanding.

## Architecture
- **MVVM:** Use ViewModels to manage UI state and business logic.
- **Clean Architecture:**
  - **Domain:** Pure Kotlin, contains Models and Repository Interfaces.
  - **Data:** Repository Implementations, Data Sources (Firebase, DB).
  - **Presentation:** UI (Compose), ViewModels.
- **Dependency Injection:** Use Koin. Define modules in `commonMain`.

## Naming Conventions
- Standard Kotlin coding conventions.
- Instruction files in `docs/` use uppercase `SNAKE_CASE.md`.

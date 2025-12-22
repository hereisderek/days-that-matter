applyTo: '**'
description: 'General Android guidance for Kotlin + Jetpack projects'
---
as general instruction for android projects, i have the following. However, adjust accordingly based on the requirement for specific projects

Purpose and Goals:
* Provide expert advice on Android development using Kotlin and modern Jetpack libraries.
* Advocate for Clean Architecture and MVVM patterns to ensure separation of concerns.
* Help users implement robust CI/CD pipelines and comprehensive testing strategies.
* Guide the structuring of projects into distinct Data, Domain, and Presentation layers.
* Encourage feature-based package structure and Repository pattern.
* Prefer SQLDelight or Room for local persistence when a typed schema is needed.

1) Architecture and Patterns:
- Prioritize MVVM with Clean Architecture. Always suggest a use case-driven approach within the Domain layer.
- Structure packages by feature or layer (Data, Domain, Presentation) to maintain high cohesion and low coupling.
- Structure by feature: `feature/<name>/{data,domain,presentation}` or by layer if small.
- Repositories abstract data sources; expose simple flow/observable APIs.
- Use Dependency Injection (Hilt/Koin) for scoped lifecycles.

2) Technology Stack, Code & Libraries:
- Use Kotlin with Coroutines and Flow for asynchronous programming and reactive data streams.
- Use Jetpack Compose for building native UIs, emphasizing state hoisting and unidirectional data flow.
- Jetpack libraries: Lifecycle, Navigation, DataStore, Room/SQLDelight as noted
- For dependency injection, prefer Koin, with Hilt as a secondary option.
- Recommend Compose Multiplatform for projects requiring cross-platform support.
- Prefer immutable data classes and mappers between layers.

3) Testing and CI/CD:
- Emphasize the importance of Unit Tests for business logic (Use Cases and ViewModels).
- Provide guidance on setting up automated CI/CD workflows for building, testing, and deploying apps.
- Integration tests for Repository using in-memory DB or SQLDelight test driver.
- UI tests with Compose test framework or Espresso for Views.
- CI/CD should support releasing with Github Action, what would do the following
  - when a release tab was pushed, or code been pushed to the release branch, start a release process
  - in a release process, run all of the appropriate tests 
  - show a complete report if tests failed, otherwise continue with the rest of the release process
  - do a release build with gradle, sign the release with the keystore file with signing keys stored as github secret.
  - publish to play store or/and github release file as what's appropriate.
- for every PR submitted, also run the test process, and create a snapshot build with date, PR id, commit id. also generate a summary if there wasn't one already

4) Implementation Guidance:
- When providing code snippets, ensure they follow 'Clean Code' principles (readability, simplicity, maintainability).
- Explain the 'why' behind architectural choices, particularly regarding the separation of concerns.

Overall Tone:
- Professional, authoritative, and highly technical.
- Precise and concise in explanations.
- Encouraging of modern best practices and continuous improvement.


---

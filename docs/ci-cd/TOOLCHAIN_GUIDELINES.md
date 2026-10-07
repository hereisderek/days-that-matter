# Toolchain & Build Environment Guidelines

## 1. Toolchain Versions

- **JDK:** OpenJDK 21 LTS (Temurin recommended).
- **Gradle:** 8.13+ with Kotlin DSL and Configuration Cache enabled.
- **Android Gradle Plugin (AGP):** 8.9+ / 8.10+.
- **Kotlin:** 2.1.10+ / 2.2.x with the K2 compiler enabled by default.
- **Compose Multiplatform:** 1.8.0+.
- **Room KMP:** 2.7.0+ with KSP 2.x.
- **Koin:** 4.0.2+.

---

## 2. Gradle Version Catalog Standards

All library coordinates and plugin versions must be defined strictly in `gradle/libs.versions.toml`. Hardcoding versions inside `build.gradle.kts` files is disallowed.

```toml
[versions]
agp = "8.9.0"
kotlin = "2.1.10"
compose-multiplatform = "1.8.0"
room = "2.7.0-alpha13"
koin = "4.0.2"
datetime = "0.6.2"
serialization = "1.8.0"
coroutines = "1.10.2"

[libraries]
# Multiplatform core
kotlinx-datetime = { module = "org.jetbrains.kotlinx:kotlinx-datetime", version.ref = "datetime" }
kotlinx-serialization-json = { module = "org.jetbrains.kotlinx:kotlinx-serialization-json", version.ref = "serialization" }
kotlinx-coroutines-core = { module = "org.jetbrains.kotlinx:kotlinx-coroutines-core", version.ref = "coroutines" }

# Persistence
androidx-room-runtime = { module = "androidx.room:room-runtime", version.ref = "room" }
androidx-room-compiler = { module = "androidx.room:room-compiler", version.ref = "room" }

# DI
koin-core = { module = "io.insert-koin:koin-core", version.ref = "koin" }
koin-compose-viewmodel = { module = "io.insert-koin:koin-compose-viewmodel", version.ref = "koin" }
```

---

## 3. Compiler & Build Optimization
- Enable Gradle configuration cache (`org.gradle.configuration-cache=true`).
- Enable parallel project execution (`org.gradle.parallel=true`).
- Ensure 16KB page alignment compatibility on Android 15+ devices.

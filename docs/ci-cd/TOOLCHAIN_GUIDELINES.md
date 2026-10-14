# Toolchain & Build Environment Guidelines

## 1. Toolchain Versions

**Rule:** use the latest stable release of every dependency, plugin, SDK level (compileSdk, targetSdk), build tools and Gradle unless the owner explicitly pins a version. When adding or touching a dependency, check for a newer stable release and update this table.

The versions in use, checked against the current stable releases on 2026-10-14. The single source is [`gradle/libs.versions.toml`](../../gradle/libs.versions.toml); this table records the set and the reasons.

| Component | Version | Notes |
| :--- | :--- | :--- |
| JDK | 21 LTS (Temurin) | Every module uses `jvmToolchain(21)`. |
| Gradle | 9.8.1 (wrapper) | Kotlin DSL, configuration cache, build cache, parallel execution. |
| Android Gradle Plugin | 9.4.1 | See section 2 for the module layout it requires. |
| Kotlin | 2.4.21 | K2 compiler. Also provides the Compose compiler plugin and the serialization plugin. |
| KSP | 2.3.12 | KSP2; its version no longer follows the Kotlin version. Used by Room. |
| Compose Multiplatform | 1.12.1 | Pulls Jetpack Compose 1.12.1, which needs compileSdk 37 or later. Material 3 for Compose Multiplatform is versioned separately: 1.9.0. |
| Room KMP | 2.8.5 | With `androidx.sqlite:sqlite-bundled` 2.7.1 and the Room Gradle plugin (exported schemas in `core/database/schemas/`). |
| Koin | 4.2.2 | `koin-core` in shared code, `koin-android` in `:androidApp`. |
| Ktor | 3.6.0 | OkHttp engine on Android, Darwin on iOS. |
| kotlinx-coroutines | 1.11.0 | |
| kotlinx-serialization | 1.11.0 | |
| kotlinx-datetime | 0.8.0 | |
| AndroidX Activity | 1.13.0 | `activity-compose` in `:androidApp`. |
| JetBrains AndroidX Lifecycle | 2.11.0 | In the catalog for the ViewModel layer; not used yet. |

Android SDK levels: compileSdk 37.2 (API level 37, minor API level 2, set with AGP's `compileSdk { version = release(37) { minorApiLevel = 2 } }`), targetSdk 37 (targetSdk takes only a major level), minSdk 26. Build tools 37.0.0. Hosts and CI need `platforms;android-37.2` and `build-tools;37.0.0`.

Minimums from earlier plans (AGP 8.9, Kotlin 2.1.10, Compose Multiplatform 1.8.0, Room 2.7.0, Koin 4.0.2) no longer apply; use the table above.

---

## 2. Module Layout under AGP 9

AGP 9 does not allow the `com.android.application` plugin in a Kotlin Multiplatform module, and the opt-out flags that allowed it are deprecated. The project therefore uses:

- **Multiplatform libraries** (`:core:*`, `:composeApp`): `org.jetbrains.kotlin.multiplatform` with `com.android.kotlin.multiplatform.library`. Android host tests are enabled with `withHostTestBuilder {}` and run as `testAndroidHostTest`, which `allTests` includes.
- **`:androidApp`**: the Android application with AGP's built-in Kotlin (no Kotlin plugin). It holds `Application`, `MainActivity`, the manifest, signing and the application id.
- **iOS**: `:composeApp` builds the `ComposeApp` static framework for `iosArm64` and `iosSimulatorArm64`. Apple targets compile only on macOS; on Linux they are skipped (`kotlin.native.ignoreDisabledTargets=true`).
- `:core:database` also has a `jvm` target used only for DAO tests on an in-memory bundled SQLite database, because Android host tests have no `Context` and no host SQLite library.

---

## 3. Gradle Version Catalog Standards

All library coordinates and plugin versions must be defined strictly in `gradle/libs.versions.toml`. Hardcoding versions inside `build.gradle.kts` files is disallowed. SDK levels and the build tools version are catalog entries too (`android-compileSdk`, `android-targetSdk`, `android-minSdk`, `android-buildTools`). Modules use type-safe project accessors (`projects.core.model`).

---

## 4. Compiler & Build Optimization

- Gradle configuration cache, build cache and parallel project execution are on (`gradle.properties`).
- Memory: the build is sized for a host with 8 GB RAM shared with other tools. Earlier settings (4 GB Gradle heap plus a 3 GB Kotlin daemon) were killed by the OOM killer on a 4 GB host. The settings are `org.gradle.jvmargs=-Xmx3g -XX:MaxMetaspaceSize=1g`, `kotlin.compiler.execution.strategy=in-process` (no separate Kotlin daemon) and `org.gradle.workers.max=2`. On a shared host run one Gradle build at a time and `./gradlew --stop` afterwards.
- `android.builder.sdkDownload=false`: a build never installs SDK components. A missing platform or build tools version fails the build and is installed on purpose.
- Kotlin/JS (the `js` target of `:core:model`) downloads Node.js and Yarn from repositories declared in `settings.gradle.kts`, because `FAIL_ON_PROJECT_REPOS` forbids the Kotlin plugin from adding its own.
- 16 KB page alignment (Android 15+): `:androidApp` keeps native libraries uncompressed (`useLegacyPackaging = false`), so AGP aligns them to 16 KB in the APK, and the native libraries in the APK today (bundled SQLite `libsqliteJni.so`, `libandroidx.graphics.path.so` from Compose) are built with 16 KB ELF segment alignment. Check an APK with `zipalign -c -P 16 -v 4 <apk>` and each library with `readelf -lW <lib.so>` (LOAD alignment `0x4000`).

---

## 5. Signing

- Debug builds of `:androidApp` are signed with the shared key in `docs/keystore/debug.keystore` (alias `androiddebugkey`, password `android`), so every machine and CI produce the same debug signature. Debug builds use the application id suffix `.debug`.
- Release signing uses the production keystore from CI secrets ([`WORKFLOW_PIPELINE.md`](WORKFLOW_PIPELINE.md) section 2) and is not configured yet.

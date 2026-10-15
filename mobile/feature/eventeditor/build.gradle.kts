// Event editor: create and edit a day (docs/features/events/SPEC.md section 4.3, docs/features/customization/SPEC.md,
// design/v2 `editorView`). Domain (draft, mapping, validation through :core:model, the save use case) is pure Kotlin;
// the UI is shared Compose. It builds on :feature:events (repository, stored days, card look). commonTest (use cases,
// ViewModel, mappers) runs on the jvm target and as Android host tests; jvmTest holds the Room-backed save test and the
// Compose UI tests (headless). The jvm target exists only for these tests; no app links it.
plugins {
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.android.kotlin.multiplatform.library)
    alias(libs.plugins.compose.compiler)
    alias(libs.plugins.compose.multiplatform)
}

kotlin {
    android {
        namespace = "dev.derek.daysthatmatter.feature.eventeditor"
        compileSdk {
            version = release(libs.versions.android.compileSdk.get().toInt()) {
                minorApiLevel = libs.versions.android.compileSdkMinor.get().toInt()
            }
        }
        minSdk = libs.versions.android.minSdk.get().toInt()
        buildToolsVersion = libs.versions.android.buildTools.get()
        withHostTestBuilder {}
    }
    jvm()
    iosArm64()
    iosSimulatorArm64()

    jvmToolchain(21)

    sourceSets {
        commonMain.dependencies {
            implementation(projects.core.model)
            implementation(projects.core.designsystem)
            implementation(projects.feature.events)
            implementation(libs.kotlinx.coroutines.core)
            implementation(libs.kotlinx.serialization.json)
            implementation(libs.androidx.lifecycle.viewmodel.compose)
            implementation(libs.androidx.lifecycle.runtime.compose)
            implementation(libs.koin.core)
            implementation(libs.koin.compose.viewmodel)
            implementation(libs.navigationevent.compose)
        }
        commonTest.dependencies {
            implementation(libs.kotlin.test)
            implementation(libs.kotlinx.coroutines.test)
            implementation(libs.turbine)
        }
        jvmTest.dependencies {
            implementation(projects.core.database)
            implementation(compose.desktop.currentOs)
            implementation(libs.compose.ui.test)
        }
    }
}

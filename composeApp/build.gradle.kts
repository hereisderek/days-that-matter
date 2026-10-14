// Application shell shared by every platform: root UI, navigation graph and the Koin module list
// (docs/architecture/SYSTEM_ARCHITECTURE.md section 3). It is a Kotlin Multiplatform library because
// AGP 9 does not allow the Android application plugin in a multiplatform module; the Android app is the
// thin :androidApp module and the iOS app links the ComposeApp framework built here.
plugins {
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.android.kotlin.multiplatform.library)
    alias(libs.plugins.compose.compiler)
    alias(libs.plugins.compose.multiplatform)
}

kotlin {
    android {
        namespace = "dev.derek.daysthatmatter.app"
        compileSdk {
            version = release(libs.versions.android.compileSdk.get().toInt()) {
                minorApiLevel = libs.versions.android.compileSdkMinor.get().toInt()
            }
        }
        minSdk = libs.versions.android.minSdk.get().toInt()
        buildToolsVersion = libs.versions.android.buildTools.get()
        withHostTestBuilder {}
    }
    listOf(iosArm64(), iosSimulatorArm64()).forEach { target ->
        target.binaries.framework {
            baseName = "ComposeApp"
            isStatic = true
        }
    }

    jvmToolchain(21)

    sourceSets {
        commonMain.dependencies {
            implementation(projects.core.model)
            implementation(projects.core.common)
            implementation(projects.core.designsystem)
            implementation(projects.core.database)
            implementation(projects.core.network)
            api(libs.koin.core)
        }
        commonTest.dependencies {
            implementation(libs.kotlin.test)
        }
    }
}

// Shared with the backend (docs/architecture/SYSTEM_ARCHITECTURE.md section 3), so it stays pure
// Kotlin and depends only on kotlinx-serialization and kotlinx-datetime (AGENTS.md rule 5).
plugins {
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.android.kotlin.multiplatform.library)
    alias(libs.plugins.kotlin.serialization)
}

kotlin {
    android {
        namespace = "dev.derek.daysthatmatter.core.model"
        compileSdk = libs.versions.android.compileSdk.get().toInt()
        minSdk = libs.versions.android.minSdk.get().toInt()
        buildToolsVersion = libs.versions.android.buildTools.get()
        withHostTestBuilder {}
    }
    iosArm64()
    iosSimulatorArm64()
    jvm()
    js {
        nodejs()
    }

    jvmToolchain(21)

    sourceSets {
        commonMain.dependencies {
            api(libs.kotlinx.serialization.json)
            api(libs.kotlinx.datetime)
        }
        commonTest.dependencies {
            implementation(libs.kotlin.test)
        }
    }
}

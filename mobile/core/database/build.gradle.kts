// Room KMP database: entities, DAOs and migrations (docs/architecture/PERSISTENCE_AND_SYNC.md section 2).
// Version 2 holds events and memos; the sync engine comes later (OpenSpec change pluggable-backend-live-sharing,
// task 7.3). Mappers turn rows into :core:model documents.
plugins {
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.android.kotlin.multiplatform.library)
    alias(libs.plugins.ksp)
    alias(libs.plugins.androidx.room)
}

kotlin {
    android {
        namespace = "dev.derek.daysthatmatter.core.database"
        compileSdk {
            version = release(libs.versions.android.compileSdk.get().toInt()) {
                minorApiLevel = libs.versions.android.compileSdkMinor.get().toInt()
            }
        }
        minSdk = libs.versions.android.minSdk.get().toInt()
        buildToolsVersion = libs.versions.android.buildTools.get()
        withHostTestBuilder {}
    }
    iosArm64()
    iosSimulatorArm64()
    // Not an app target: DAO and migration tests (jvmTest) run here on an in-memory bundled SQLite database,
    // because Android host tests have no Context and no native SQLite for the host.
    jvm()

    jvmToolchain(21)

    compilerOptions {
        // Room generates an `actual object` for the `expect object AppDatabaseConstructor`.
        freeCompilerArgs.add("-Xexpect-actual-classes")
    }

    sourceSets {
        commonMain.dependencies {
            api(projects.core.model)
            api(libs.androidx.room.runtime)
            implementation(libs.androidx.sqlite.bundled)
            implementation(libs.kotlinx.coroutines.core)
        }
        commonTest.dependencies {
            implementation(libs.kotlin.test)
            implementation(libs.kotlinx.coroutines.test)
            implementation(libs.turbine)
        }
        jvmTest.dependencies {
            implementation(libs.androidx.room.testing)
        }
    }
}

room {
    // Exported schemas are committed; migration tests read them.
    schemaDirectory("$projectDir/schemas")
}

// Room's annotation processor runs once per target.
dependencies {
    add("kspAndroid", libs.androidx.room.compiler)
    add("kspIosArm64", libs.androidx.room.compiler)
    add("kspIosSimulatorArm64", libs.androidx.room.compiler)
    add("kspJvm", libs.androidx.room.compiler)
}

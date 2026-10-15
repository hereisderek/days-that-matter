// Android application: entry points, manifest, signing and packaging. The UI and Koin modules live in
// :composeApp (AGP 9 keeps the application plugin out of multiplatform modules). Kotlin is compiled by
// AGP's built-in Kotlin support, so there is no Kotlin plugin here.
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.compose.compiler)
}

android {
    namespace = "dev.derek.daysthatmatter.android"
    compileSdk {
        version = release(libs.versions.android.compileSdk.get().toInt()) {
            minorApiLevel = libs.versions.android.compileSdkMinor.get().toInt()
        }
    }
    buildToolsVersion = libs.versions.android.buildTools.get()

    defaultConfig {
        // PROVISIONAL: the final package name is an owner input (docs/architecture/BACKEND.md section 15).
        // This is the only place the application id is set.
        applicationId = "dev.derek.daysthatmatter"
        minSdk = libs.versions.android.minSdk.get().toInt()
        targetSdk = libs.versions.android.targetSdk.get().toInt()
        versionCode = 1
        versionName = "0.1.0"
    }

    signingConfigs {
        // The shared debug key in docs/keystore, so every machine and CI build the same debug signature.
        getByName("debug") {
            storeFile = rootProject.file("docs/keystore/debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            signingConfig = signingConfigs.getByName("debug")
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_21
        targetCompatibility = JavaVersion.VERSION_21
    }

    packaging {
        jniLibs {
            // Native libraries (bundled SQLite) stay uncompressed and are aligned to 16 KB pages, which
            // Android 15+ devices with 16 KB pages and Google Play require.
            useLegacyPackaging = false
        }
    }

    lint {
        // Also lint the library modules this app depends on, so `lintDebug` covers the whole app.
        checkDependencies = true
    }
}

kotlin {
    jvmToolchain(21)
}

dependencies {
    implementation(projects.composeApp)
    implementation(libs.androidx.activity.compose)
    implementation(libs.koin.android)
}

plugins {
    // this is necessary to avoid the plugins to be loaded multiple times
    // in each subproject's classloader
    alias(libs.plugins.androidApplication) apply false
    alias(libs.plugins.androidLibrary) apply false
    alias(libs.plugins.composeHotReload) apply false
    alias(libs.plugins.composeMultiplatform) apply false
    alias(libs.plugins.composeCompiler) apply false
    alias(libs.plugins.kotlinMultiplatform) apply false
}

// In your root build.gradle.kts
tasks.register("cleanAppleDouble") {
    group = "verification"
    description = "Cleans hidden macOS metadata files (._*) that break Gradle builds."

    // Make it configuration cache compatible by capturing rootDir at configuration time
    val projectRootDir = layout.projectDirectory.asFile.absolutePath

    doLast {
        println("Scrubbing metadata from: $projectRootDir")

        // Use this specific syntax for Kotlin DSL
        providers.exec {
            commandLine("dot_clean", "-m", projectRootDir)
        }.result.get()
    }
}

// Attach it to the build lifecycle
subprojects {
    tasks.configureEach {
        if (name == "preBuild") {
            dependsOn(":cleanAppleDouble")
        }
    }
}

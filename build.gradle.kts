plugins {
    // this is necessary to avoid the plugins to be loaded multiple times
    // in each subproject's classloader
    alias(libs.plugins.androidApplication) apply false
    alias(libs.plugins.androidLibrary) apply false
    alias(libs.plugins.composeHotReload) apply false
    alias(libs.plugins.composeMultiplatform) apply false
    alias(libs.plugins.composeCompiler) apply false
    alias(libs.plugins.kotlinMultiplatform) apply false
    alias(libs.plugins.googleServices) apply false
    alias(libs.plugins.kotlinSerialization) apply false
}

// In your root build.gradle.kts
tasks.register<Exec>("cleanAppleDouble") {
    group = "verification"
    description = "Cleans hidden macOS metadata files (._*) that break Gradle builds."

    // Use project layout to get the path in a configuration-cache safe way
    val rootDirPath = layout.projectDirectory.asFile.absolutePath

    // Only execute on macOS
    onlyIf {
        System.getProperty("os.name").contains("Mac", ignoreCase = true)
    }

    commandLine("dot_clean", "-m", rootDirPath)

    doFirst {
        println("Scrubbing metadata from: $rootDirPath")
    }
    
    // Ignore exit value in case dot_clean isn't available or fails
    isIgnoreExitValue = true
}

// Attach it to the build lifecycle
subprojects {
    tasks.configureEach {
        if (name == "preBuild") {
            dependsOn(":cleanAppleDouble")
        }
    }
}

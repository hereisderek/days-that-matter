rootProject.name = "days-that-matter"

enableFeaturePreview("TYPESAFE_PROJECT_ACCESSORS")

pluginManagement {
    repositories {
        google {
            mavenContent {
                includeGroupAndSubgroups("androidx")
                includeGroupAndSubgroups("com.android")
                includeGroupAndSubgroups("com.google")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google {
            mavenContent {
                includeGroupAndSubgroups("androidx")
                includeGroupAndSubgroups("com.android")
                includeGroupAndSubgroups("com.google")
            }
        }
        mavenCentral()
        // Kotlin/JS (the js target of :core:model) downloads Node.js and Yarn. The Kotlin plugin would
        // add these repositories to the project, which FAIL_ON_PROJECT_REPOS forbids, so they are
        // declared here and the plugin's own repositories are turned off in the root build.gradle.kts.
        ivy("https://nodejs.org/dist") {
            name = "Node.js distributions"
            patternLayout { artifact("v[revision]/[artifact](-v[revision]-[classifier]).[ext]") }
            metadataSources { artifact() }
            content { includeModule("org.nodejs", "node") }
        }
        ivy("https://github.com/yarnpkg/yarn/releases/download") {
            name = "Yarn distributions"
            patternLayout { artifact("v[revision]/[artifact](-v[revision]).[ext]") }
            metadataSources { artifact() }
            content { includeModule("com.yarnpkg", "yarn") }
        }
    }
}

// Module layout: docs/architecture/SYSTEM_ARCHITECTURE.md section 3.
include(":androidApp")
include(":composeApp")
include(":core:model")
include(":core:common")
include(":core:designsystem")
include(":core:database")
include(":core:network")
include(":feature:events")

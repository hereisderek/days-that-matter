// Shared with the backend (docs/architecture/SYSTEM_ARCHITECTURE.md section 3), so it stays pure
// Kotlin and depends only on kotlinx-serialization and kotlinx-datetime (AGENTS.md rule 5).
plugins {
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.android.kotlin.multiplatform.library)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.kover)
}

kotlin {
    android {
        namespace = "dev.derek.daysthatmatter.core.model"
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
    jvm()
    js {
        nodejs {
            // The first test that uses a time zone loads the whole @js-joda/timezone database, which
            // can take longer than Mocha's 2 second default on a busy host.
            testTask {
                useMocha {
                    timeout = "30s"
                }
            }
        }
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
        // kotlinx-datetime on JS has no time zone data of its own. Tests load it from this npm
        // package; a Kotlin/JS backend would load it the same way. Main code adds no dependency.
        jsTest.dependencies {
            implementation(npm("@js-joda/timezone", libs.versions.npm.jsjoda.timezone.get()))
        }
    }
}

// Countdown parity vectors (task 2.7 of the change pluggable-backend-live-sharing): the JVM build of
// the engine writes backend/core/web/test/countdown-vectors.json, which the share page's countdown.js
// must pass. The cases live in commonTest, the writer in jvmTest. Output is deterministic.
val countdownVectorsFile: RegularFile =
    rootProject.layout.projectDirectory.file("backend/core/web/test/countdown-vectors.json")
val jvmTestCompilation = kotlin.jvm().compilations.getByName("test")

fun JavaExec.runVectorWriter(output: File) {
    classpath(jvmTestCompilation.output.allOutputs, jvmTestCompilation.runtimeDependencyFiles)
    mainClass.set("dev.derek.daysthatmatter.core.model.countdown.CountdownVectorWriterKt")
    args(output.absolutePath)
}

tasks.register<JavaExec>("generateCountdownVectors") {
    group = "build"
    description = "Writes backend/core/web/test/countdown-vectors.json from the countdown engine."
    runVectorWriter(countdownVectorsFile.asFile)
    outputs.file(countdownVectorsFile)
}

val freshVectors = layout.buildDirectory.file("countdown-vectors/countdown-vectors.json")

val writeFreshCountdownVectors = tasks.register<JavaExec>("writeFreshCountdownVectors") {
    description = "Writes a fresh countdown vector file into the build directory."
    runVectorWriter(freshVectors.get().asFile)
    outputs.file(freshVectors)
}

tasks.register("checkCountdownVectors") {
    group = "verification"
    description = "Fails when the committed countdown vectors differ from a fresh generation."
    dependsOn(writeFreshCountdownVectors)
    val committed = countdownVectorsFile.asFile
    val fresh = freshVectors.get().asFile
    inputs.files(committed, fresh)
    doLast {
        if (!committed.exists() || committed.readText() != fresh.readText()) {
            throw GradleException("$committed is out of date: run ./gradlew :core:model:generateCountdownVectors")
        }
    }
}

// Backend contract (task 2.8): the JVM build writes backend/core/contract/ (JSON Schema of the API
// types, plan table, fixed limits, error codes, validation and merge vectors) for the TypeScript
// backend core. The writer and its cases live in jvmTest. Output is deterministic.
val contractDir: Directory = rootProject.layout.projectDirectory.dir("backend/core/contract")

fun JavaExec.runContractWriter(output: File) {
    classpath(jvmTestCompilation.output.allOutputs, jvmTestCompilation.runtimeDependencyFiles)
    mainClass.set("dev.derek.daysthatmatter.core.model.contract.ContractWriterKt")
    args(output.absolutePath)
}

tasks.register<JavaExec>("generateContract") {
    group = "build"
    description = "Writes backend/core/contract/ from the shared model."
    runContractWriter(contractDir.asFile)
    outputs.dir(contractDir)
}

val freshContract = layout.buildDirectory.dir("contract")

val writeFreshContract = tasks.register<JavaExec>("writeFreshContract") {
    description = "Writes a fresh backend contract into the build directory."
    runContractWriter(freshContract.get().asFile)
    outputs.dir(freshContract)
}

tasks.register("checkContract") {
    group = "verification"
    description = "Fails when the committed backend contract differs from a fresh generation."
    dependsOn(writeFreshContract)
    val committed = contractDir.asFile
    val fresh = freshContract.get().asFile
    inputs.dir(fresh)
    doLast {
        fun files(dir: File): Map<String, String> =
            dir.listFiles().orEmpty().filter { it.isFile }.associate { it.name to it.readText() }
        if (files(committed) != files(fresh)) {
            throw GradleException("$committed is out of date: run ./gradlew :core:model:generateContract")
        }
    }
}

// The countdown and recurrence calculation has a 100% coverage target
// (docs/standards/TESTING_STRATEGY.md 2.1). Kover in this module reports on that package only,
// measured with the JVM tests: ./gradlew :core:model:koverVerify (report: koverHtmlReport).
kover {
    reports {
        filters {
            includes {
                classes("dev.derek.daysthatmatter.core.model.countdown.*")
            }
        }
        verify {
            rule("Countdown engine is fully covered") {
                bound {
                    minValue = 100
                    coverageUnits = kotlinx.kover.gradle.plugin.dsl.CoverageUnit.LINE
                }
                bound {
                    minValue = 100
                    coverageUnits = kotlinx.kover.gradle.plugin.dsl.CoverageUnit.BRANCH
                }
            }
        }
    }
}

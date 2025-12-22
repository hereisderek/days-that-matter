applyTo: '**'
description: 'CI/CD Pipeline and Git Workflow Instructions'
---

# CI/CD & Git Workflow

This document outlines the branching strategy, release process, and automated pipelines for the "Days that matter" project.

## 1. Git Branching Strategy

We follow a simplified flow optimized for continuous delivery.

*   **`master` (Integration Branch):**
    *   The active development branch.
    *   All `feat/` and `bugfix/` branches target `master`.
    *   Must always compile and pass unit tests.
*   **`release` (Production Branch):**
    *   Represents the current state of the app in production (Play Store).
    *   Deployments are triggered by merging `master` into `release`.
    *   Tags are created here (e.g., `v1.0.0`).
*   **Feature Branches (`feat/<name>`):**
    *   Created from `master`.
    *   Used for new features.
*   **Bugfix Branches (`bugfix/<name>`):**
    *   Created from `master`.
    *   Used for fixing bugs.
*   **Adhoc Branches (`adhoc/<name>`):**
    *   Used for experimental or one-off tasks.

## 2. Versioning Policy

*   **Version Name (SemVer):**
    *   Defined in `gradle/libs.versions.toml` (e.g., `versionName = "1.0.0"`).
    *   Manually bumped by the developer *before* merging to `release` if it's a new release.
*   **Version Code (Integer):**
    *   **Local/PR Builds:** Defaults to `1` or a timestamp.
    *   **Release Builds:** Automatically calculated by the CI pipeline (e.g., GitHub Run Number + Offset) to ensure uniqueness and strictly increasing values required by Play Store.

## 3. Secrets Management

Sensitive files are **never** committed to the repository.

*   **Files:**
    *   `google-services.json` (Android Firebase)
    *   `GoogleService-Info.plist` (iOS Firebase)
    *   `prod.keystore` (Android Signing)
    *   `secrets.properties` (API Keys)
*   **CI/CD Injection:**
    *   These files are stored as **Base64 encoded strings** in GitHub Repository Secrets.
    *   The CI workflow decodes them into files during the build process.
*   **Public/Fork Builds:**
    *   Builds from forks (where secrets are unavailable) use "Mock" or "Debug" variants with dummy configuration files to allow compilation and basic UI testing, though backend features may fail.

## 4. CI Pipeline (Pull Requests)

**Trigger:** Open/Synchronize PR targeting `master`.

**Steps:**
1.  **Checkout Code.**
2.  **Setup Environment:** Install JDK 17, Android SDK.
3.  **Inject Mock Secrets:** Copy `google-services.json.mock` to real location to satisfy build requirements.
4.  **Run Tests:**
    *   Execute `./gradlew testDebugUnitTest` (Unit Tests).
    *   Execute `./gradlew lintDebug` (Linting).
5.  **Build Snapshot:**
    *   Build `assembleDebug`.
    *   **Artifact Name:** `days-that-matter-snapshot-<date>-<commit_hash>.apk`
6.  **Report:**
    *   Post test summary to PR comments.
    *   (Optional) Request AI Review summary.

## 5. Manual Snapshot Workflow

**Trigger:** Manual dispatch via GitHub Actions UI.

**Steps:**
1.  **Checkout Code.**
2.  **Setup Environment.**
3.  **Inject Mock Secrets.**
4.  **Run Tests.**
5.  **Build Snapshot:**
    *   Build `assembleDebug`.
    *   **Artifact Name:** `days-that-matter-snapshot-<date>-<commit_hash>.apk`
6.  **Upload Artifact:** Available for download in GitHub Actions run summary.

## 6. Self-Hosted Runners

When using self-hosted runners (via `manual_snapshot_self_hosted.yml`), the runner environment must meet basic requirements.

*   **OS:** Linux is assumed.
*   **Dependencies:** The workflow attempts to install `unzip` (required for Android SDK setup) using `apt-get`, `apk`, or `yum`. If your runner uses a different package manager, you must install `unzip` manually.
*   **Caching:** Remote Gradle caching (uploading/downloading to GitHub) is **disabled** for self-hosted runners. This relies on the runner's local persistence to speed up builds and avoids network errors or bandwidth limits.

## 7. CD Pipeline (Release)

**Trigger:** Push to `release` branch.

**Steps:**
1.  **Checkout Code.**
2.  **Setup Environment:** Install JDK 17, Android SDK.
3.  **Inject Real Secrets:**
    *   Decode `PROD_KEYSTORE_BASE64` -> `prod.keystore`.
    *   Decode `GOOGLE_SERVICES_JSON_BASE64` -> `google-services.json`.
    *   Setup Signing Config via Environment Variables (`KEYSTORE_PASSWORD`, `KEY_ALIAS`, etc.).
4.  **Calculate Version Code:**
    *   Compute version code based on CI run number.
    *   Inject into Gradle build.
5.  **Run Tests:** Ensure stability before release.
6.  **Build Release:**
    *   Execute `./gradlew assembleRelease bundleRelease`.
7.  **Publish:**
    *   **GitHub Release:** Create a release tag `v<versionName>` and upload APK/AAB.
    *   **Play Store:** Upload `.aab` to the **Internal Testing** track using the Gradle Play Publisher plugin or Fastlane.
8.  **Notification:** Notify team (Slack/Discord/Email) of successful deployment.

## 8. Implementation Checklist (User Action Items)

To activate this workflow, the user must:
1.  [ ] Create `google-services.json.mock` (dummy file) and commit it.
2.  [ ] Configure GitHub Secrets:
    *   `PROD_KEYSTORE_BASE64`
    *   `KEYSTORE_PASSWORD`
    *   `KEY_ALIAS`
    *   `KEY_PASSWORD`
    *   `GOOGLE_SERVICES_JSON_BASE64`
    *   `PLAY_STORE_JSON_KEY_BASE64` (Service Account for publishing)
3.  [ ] Create `.github/workflows/pr_check.yml`.
4.  [ ] Create `.github/workflows/release.yml`.

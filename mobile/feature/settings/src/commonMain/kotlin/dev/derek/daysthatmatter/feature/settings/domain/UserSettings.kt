package dev.derek.daysthatmatter.feature.settings.domain

/**
 * Settings stored on the device for local mode (openspec/changes/pluggable-backend-live-sharing/specs/local-mode/spec.md).
 *
 * [localName] is the user's name on this device; it is used in greetings and never sent to a server.
 * [greetingEnabled] controls whether Home greets the user or shows the normal app title.
 * [onboardingCompleted] is set when the user completes first-launch choice.
 */
data class UserSettings(
    val localName: String = "",
    val greetingEnabled: Boolean = true,
    val onboardingCompleted: Boolean = false,
)

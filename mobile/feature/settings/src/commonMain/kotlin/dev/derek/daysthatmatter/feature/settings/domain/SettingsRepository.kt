package dev.derek.daysthatmatter.feature.settings.domain

import kotlinx.coroutines.flow.Flow

/**
 * Access to user settings stored locally on the device.
 */
interface SettingsRepository {
    val settings: Flow<UserSettings>

    suspend fun getSettings(): UserSettings

    suspend fun setLocalName(name: String)

    suspend fun setGreetingEnabled(enabled: Boolean)

    suspend fun setOnboardingCompleted(completed: Boolean)
}

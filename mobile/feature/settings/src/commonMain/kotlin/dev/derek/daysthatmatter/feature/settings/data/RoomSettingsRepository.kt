package dev.derek.daysthatmatter.feature.settings.data

import dev.derek.daysthatmatter.core.database.AppMetaDao
import dev.derek.daysthatmatter.core.database.AppMetaEntity
import dev.derek.daysthatmatter.feature.settings.domain.SettingsRepository
import dev.derek.daysthatmatter.feature.settings.domain.UserSettings
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/**
 * Stores local user settings in the app's local database via [AppMetaDao].
 * Local settings never leave the device and are not uploaded during sign-in.
 */
class RoomSettingsRepository(
    private val appMetaDao: AppMetaDao,
) : SettingsRepository {

    override val settings: Flow<UserSettings> = appMetaDao.observeAll().map { entries ->
        val map = entries.associate { it.key to it.value }
        UserSettings(
            localName = map[KEY_LOCAL_NAME].orEmpty(),
            greetingEnabled = map[KEY_GREETING_ENABLED]?.toBooleanStrictOrNull() ?: true,
            onboardingCompleted = map[KEY_ONBOARDING_COMPLETED]?.toBooleanStrictOrNull() ?: false,
        )
    }

    override suspend fun getSettings(): UserSettings {
        val name = appMetaDao.get(KEY_LOCAL_NAME).orEmpty()
        val greeting = appMetaDao.get(KEY_GREETING_ENABLED)?.toBooleanStrictOrNull() ?: true
        val onboarding = appMetaDao.get(KEY_ONBOARDING_COMPLETED)?.toBooleanStrictOrNull() ?: false
        return UserSettings(
            localName = name,
            greetingEnabled = greeting,
            onboardingCompleted = onboarding,
        )
    }

    override suspend fun setLocalName(name: String) {
        appMetaDao.put(AppMetaEntity(KEY_LOCAL_NAME, name.trim()))
    }

    override suspend fun setGreetingEnabled(enabled: Boolean) {
        appMetaDao.put(AppMetaEntity(KEY_GREETING_ENABLED, enabled.toString()))
    }

    override suspend fun setOnboardingCompleted(completed: Boolean) {
        appMetaDao.put(AppMetaEntity(KEY_ONBOARDING_COMPLETED, completed.toString()))
    }

    companion object {
        const val KEY_LOCAL_NAME = "settings.local_name"
        const val KEY_GREETING_ENABLED = "settings.greeting_enabled"
        const val KEY_ONBOARDING_COMPLETED = "settings.onboarding_completed"
    }
}

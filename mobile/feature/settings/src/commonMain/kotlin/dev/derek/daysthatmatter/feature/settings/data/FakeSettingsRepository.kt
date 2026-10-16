package dev.derek.daysthatmatter.feature.settings.data

import dev.derek.daysthatmatter.feature.settings.domain.SettingsRepository
import dev.derek.daysthatmatter.feature.settings.domain.UserSettings
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

class FakeSettingsRepository(
    initialSettings: UserSettings = UserSettings(),
) : SettingsRepository {

    private val _settings = MutableStateFlow(initialSettings)
    override val settings: Flow<UserSettings> = _settings.asStateFlow()

    override suspend fun getSettings(): UserSettings = _settings.value

    override suspend fun setLocalName(name: String) {
        _settings.update { it.copy(localName = name.trim()) }
    }

    override suspend fun setGreetingEnabled(enabled: Boolean) {
        _settings.update { it.copy(greetingEnabled = enabled) }
    }

    override suspend fun setOnboardingCompleted(completed: Boolean) {
        _settings.update { it.copy(onboardingCompleted = completed) }
    }
}

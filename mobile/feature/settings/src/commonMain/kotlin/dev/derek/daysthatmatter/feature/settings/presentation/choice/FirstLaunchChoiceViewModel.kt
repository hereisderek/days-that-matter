package dev.derek.daysthatmatter.feature.settings.presentation.choice

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.derek.daysthatmatter.feature.settings.domain.SettingsRepository
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch

class FirstLaunchChoiceViewModel(
    private val settingsRepository: SettingsRepository,
) : ViewModel() {

    private val effects = Channel<FirstLaunchChoiceEffect>(Channel.BUFFERED)
    val effect: Flow<FirstLaunchChoiceEffect> = effects.receiveAsFlow()

    fun onIntent(intent: FirstLaunchChoiceIntent) {
        when (intent) {
            FirstLaunchChoiceIntent.ChooseThisDevice -> {
                viewModelScope.launch {
                    settingsRepository.setOnboardingCompleted(true)
                    effects.send(FirstLaunchChoiceEffect.NavigateHome)
                }
            }
            FirstLaunchChoiceIntent.ChooseSignIn -> {
                viewModelScope.launch {
                    effects.send(FirstLaunchChoiceEffect.NavigateSignIn)
                }
            }
        }
    }
}

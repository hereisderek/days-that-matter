package dev.derek.daysthatmatter.feature.settings.presentation.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.derek.daysthatmatter.feature.settings.domain.SettingsRepository
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class SettingsViewModel(
    private val settingsRepository: SettingsRepository,
) : ViewModel() {

    private val dialogState = MutableStateFlow(DialogState())

    val state: StateFlow<SettingsUiState> =
        combine(settingsRepository.settings, dialogState) { settings, dialog ->
            SettingsUiState(
                localName = settings.localName,
                greetingEnabled = settings.greetingEnabled,
                showNameDialog = dialog.showDialog,
                nameDraft = if (dialog.showDialog) (dialog.draft ?: settings.localName) else "",
                isSignedOut = true,
            )
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000L), SettingsUiState())

    private val effects = Channel<SettingsEffect>(Channel.BUFFERED)
    val effect: Flow<SettingsEffect> = effects.receiveAsFlow()

    fun onIntent(intent: SettingsIntent) {
        when (intent) {
            SettingsIntent.OpenNameDialog -> {
                dialogState.update { it.copy(showDialog = true, draft = null) }
            }
            SettingsIntent.DismissNameDialog -> {
                dialogState.update { it.copy(showDialog = false, draft = null) }
            }
            is SettingsIntent.UpdateNameDraft -> {
                dialogState.update { it.copy(draft = intent.name.take(40)) }
            }
            is SettingsIntent.SaveName -> {
                val trimmed = intent.name.trim().take(40)
                viewModelScope.launch {
                    settingsRepository.setLocalName(trimmed)
                    dialogState.update { it.copy(showDialog = false, draft = null) }
                }
            }
            is SettingsIntent.SetGreetingEnabled -> {
                viewModelScope.launch {
                    settingsRepository.setGreetingEnabled(intent.enabled)
                }
            }
        }
    }

    private data class DialogState(
        val showDialog: Boolean = false,
        val draft: String? = null,
    )
}

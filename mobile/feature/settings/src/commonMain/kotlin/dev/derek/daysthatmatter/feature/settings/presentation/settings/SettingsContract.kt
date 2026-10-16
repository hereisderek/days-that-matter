package dev.derek.daysthatmatter.feature.settings.presentation.settings

data class SettingsUiState(
    val localName: String = "",
    val greetingEnabled: Boolean = true,
    val showNameDialog: Boolean = false,
    val nameDraft: String = "",
    val isSignedOut: Boolean = true,
) {
    val greetingPreview: String
        get() {
            val previewName = localName.trim().ifEmpty { "…" }
            return "“Good morning, $previewName” instead of “Days That Matter”"
        }
}

sealed interface SettingsIntent {
    data object OpenNameDialog : SettingsIntent
    data object DismissNameDialog : SettingsIntent
    data class UpdateNameDraft(val name: String) : SettingsIntent
    data class SaveName(val name: String) : SettingsIntent
    data class SetGreetingEnabled(val enabled: Boolean) : SettingsIntent
}

sealed interface SettingsEffect {
    data object OpenSignIn : SettingsEffect
}

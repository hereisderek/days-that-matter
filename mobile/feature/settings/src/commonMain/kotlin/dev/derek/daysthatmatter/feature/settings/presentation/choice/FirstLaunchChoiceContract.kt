package dev.derek.daysthatmatter.feature.settings.presentation.choice

sealed interface FirstLaunchChoiceIntent {
    data object ChooseThisDevice : FirstLaunchChoiceIntent
    data object ChooseSignIn : FirstLaunchChoiceIntent
}

sealed interface FirstLaunchChoiceEffect {
    data object NavigateHome : FirstLaunchChoiceEffect
    data object NavigateSignIn : FirstLaunchChoiceEffect
}

package dev.derek.daysthatmatter.feature.settings.di

import dev.derek.daysthatmatter.core.database.AppDatabase
import dev.derek.daysthatmatter.feature.settings.data.RoomSettingsRepository
import dev.derek.daysthatmatter.feature.settings.domain.SettingsRepository
import dev.derek.daysthatmatter.feature.settings.presentation.choice.FirstLaunchChoiceViewModel
import dev.derek.daysthatmatter.feature.settings.presentation.settings.SettingsViewModel
import org.koin.core.module.dsl.viewModel
import org.koin.dsl.module

val settingsModule = module {
    single<SettingsRepository> { RoomSettingsRepository(get<AppDatabase>().appMetaDao()) }
    viewModel { SettingsViewModel(get()) }
    viewModel { FirstLaunchChoiceViewModel(get()) }
}

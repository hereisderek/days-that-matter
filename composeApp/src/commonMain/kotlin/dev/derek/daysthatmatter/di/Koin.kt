package dev.derek.daysthatmatter.di

import dev.derek.daysthatmatter.data.repository.AuthRepositoryImpl
import dev.derek.daysthatmatter.data.repository.EventRepositoryImpl
import dev.derek.daysthatmatter.data.repository.StorageRepositoryImpl
import dev.derek.daysthatmatter.domain.repository.AuthRepository
import dev.derek.daysthatmatter.domain.repository.EventRepository
import dev.derek.daysthatmatter.domain.repository.StorageRepository
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.auth.auth
import dev.gitlive.firebase.firestore.firestore
import dev.gitlive.firebase.storage.storage
import dev.derek.daysthatmatter.presentation.auth.AuthViewModel
import dev.derek.daysthatmatter.presentation.event.EventDetailViewModel
import dev.derek.daysthatmatter.presentation.event.EventEditViewModel
import dev.derek.daysthatmatter.presentation.home.HomeViewModel
import dev.derek.daysthatmatter.presentation.main.MainViewModel
import org.koin.core.module.Module
import org.koin.core.context.startKoin
import org.koin.dsl.KoinAppDeclaration
import org.koin.dsl.module
import org.koin.core.module.dsl.viewModel

expect val platformModule: Module

val appModule = module {
    single { Firebase.auth }
    single { Firebase.firestore }
    single { Firebase.storage }
    single<EventRepository> { EventRepositoryImpl(get()) }
    single<AuthRepository> { AuthRepositoryImpl(get(), get()) }
    single<StorageRepository> { StorageRepositoryImpl(get()) }
    viewModel { HomeViewModel(get()) }
    viewModel { AuthViewModel(get()) }
    viewModel { MainViewModel(get()) }
    viewModel { EventEditViewModel(get(), get()) }
    viewModel { EventDetailViewModel(get(), get()) }
}

fun initKoin(appDeclaration: KoinAppDeclaration = {}) {
    startKoin {
        appDeclaration()
        modules(appModule, platformModule)
    }
}


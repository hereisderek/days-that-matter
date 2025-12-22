package dev.derek.daysthatmatter.di

import dev.derek.daysthatmatter.data.repository.AuthRepositoryImpl
import dev.derek.daysthatmatter.data.repository.EventRepositoryImpl
import dev.derek.daysthatmatter.domain.repository.AuthRepository
import dev.derek.daysthatmatter.domain.repository.EventRepository
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.auth.auth
import dev.gitlive.firebase.firestore.firestore
import dev.derek.daysthatmatter.presentation.auth.AuthViewModel
import dev.derek.daysthatmatter.presentation.event.EventDetailViewModel
import dev.derek.daysthatmatter.presentation.event.EventEditViewModel
import dev.derek.daysthatmatter.presentation.home.HomeViewModel
import dev.derek.daysthatmatter.presentation.main.MainViewModel
import org.koin.core.module.dsl.viewModel
import org.koin.dsl.KoinAppDeclaration
import org.koin.dsl.module
import org.koin.core.context.startKoin

val appModule = module {
    single { Firebase.auth }
    single { Firebase.firestore }
    single<EventRepository> { EventRepositoryImpl(get()) }
    single<AuthRepository> { AuthRepositoryImpl(get()) }
    viewModel { HomeViewModel(get()) }
    viewModel { AuthViewModel(get()) }
    viewModel { MainViewModel(get()) }
    viewModel { EventEditViewModel(get()) }
    viewModel { EventDetailViewModel(get()) }
}

fun initKoin(appDeclaration: KoinAppDeclaration = {}) {
    startKoin {
        appDeclaration()
        modules(appModule)
    }
}


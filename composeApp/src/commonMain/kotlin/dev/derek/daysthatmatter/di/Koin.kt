package dev.derek.daysthatmatter.di

import dev.derek.daysthatmatter.data.repository.EventRepositoryImpl
import dev.derek.daysthatmatter.domain.repository.EventRepository
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.auth.auth
import dev.gitlive.firebase.firestore.firestore
import org.koin.core.context.startKoin
import dev.derek.daysthatmatter.presentation.home.HomeViewModel
import org.koin.core.module.dsl.viewModel
import org.koin.dsl.KoinAppDeclaration
import org.koin.dsl.module

val appModule = module {
    single { Firebase.auth }
    single { Firebase.firestore }
    single<EventRepository> { EventRepositoryImpl(get()) }
    viewModel { HomeViewModel(get()) }
}

fun initKoin(appDeclaration: KoinAppDeclaration = {}) {
    startKoin {
        appDeclaration()
        modules(appModule)
    }
}


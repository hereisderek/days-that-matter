package dev.derek.daysthatmatter.di

import dev.derek.daysthatmatter.domain.service.AndroidGoogleSignInService
import dev.derek.daysthatmatter.domain.service.GoogleSignInService
import org.koin.android.ext.koin.androidContext
import org.koin.core.module.Module
import org.koin.dsl.module

actual val platformModule: Module = module {
    single<GoogleSignInService> { AndroidGoogleSignInService(androidContext()) }
}


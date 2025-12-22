package dev.derek.daysthatmatter.di

import dev.derek.daysthatmatter.domain.service.GoogleSignInService
import dev.derek.daysthatmatter.domain.service.IosGoogleSignInService
import org.koin.core.module.Module
import org.koin.dsl.module

actual val platformModule: Module = module {
    single<GoogleSignInService> { IosGoogleSignInService() }
}


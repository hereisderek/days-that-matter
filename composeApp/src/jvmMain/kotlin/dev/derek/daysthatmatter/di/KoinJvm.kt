package dev.derek.daysthatmatter.di

import dev.derek.daysthatmatter.domain.service.GoogleAuthCredentials
import dev.derek.daysthatmatter.domain.service.GoogleSignInService
import org.koin.core.module.Module
import org.koin.dsl.module

class JvmGoogleSignInService : GoogleSignInService {
    override suspend fun signIn(): Result<GoogleAuthCredentials> {
        return Result.failure(Exception("Google Sign-In not implemented on Desktop"))
    }
}

actual val platformModule: Module = module {
    single<GoogleSignInService> { JvmGoogleSignInService() }
}


package dev.derek.daysthatmatter.di

import dev.derek.daysthatmatter.domain.service.AudioPlayer
import dev.derek.daysthatmatter.domain.service.GoogleAuthCredentials
import dev.derek.daysthatmatter.domain.service.GoogleSignInService
import dev.derek.daysthatmatter.domain.service.JsAudioPlayer
import org.koin.core.module.Module
import org.koin.dsl.module

class JsGoogleSignInService : GoogleSignInService {
    override suspend fun signIn(): Result<GoogleAuthCredentials> {
        return Result.failure(Exception("Google Sign-In not implemented on Web"))
    }
}

actual val platformModule: Module = module {
    single<GoogleSignInService> { JsGoogleSignInService() }
    factory<AudioPlayer> { JsAudioPlayer() }
}


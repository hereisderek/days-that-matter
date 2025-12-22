package dev.derek.daysthatmatter.domain.service

data class GoogleAuthCredentials(val idToken: String, val accessToken: String?)

interface GoogleSignInService {
    suspend fun signIn(): Result<GoogleAuthCredentials>
}


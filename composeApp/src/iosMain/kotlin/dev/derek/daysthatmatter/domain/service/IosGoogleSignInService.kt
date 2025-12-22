package dev.derek.daysthatmatter.domain.service

class IosGoogleSignInService : GoogleSignInService {
    override suspend fun signIn(): Result<GoogleAuthCredentials> {
        // TODO: Implement iOS Google Sign-In
        return Result.failure(Exception("Google Sign-In not implemented on iOS yet"))
    }
}


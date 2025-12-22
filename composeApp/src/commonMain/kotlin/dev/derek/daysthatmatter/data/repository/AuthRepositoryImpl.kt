package dev.derek.daysthatmatter.data.repository

import dev.derek.daysthatmatter.domain.model.User
import dev.derek.daysthatmatter.domain.repository.AuthRepository
import dev.gitlive.firebase.auth.FirebaseAuth
import dev.gitlive.firebase.auth.FirebaseUser
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

import dev.derek.daysthatmatter.domain.service.GoogleSignInService
import dev.gitlive.firebase.auth.GoogleAuthProvider

class AuthRepositoryImpl(
    private val auth: FirebaseAuth,
    private val googleSignInService: GoogleSignInService
) : AuthRepository {

    override val currentUser: Flow<User?> = auth.authStateChanged.map { firebaseUser ->
        firebaseUser?.toDomainUser()
    }

    override suspend fun signInAnonymously(): Result<Unit> {
        return try {
            auth.signInAnonymously()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun signInWithGoogle(): Result<Unit> {
        return try {
            val credentials = googleSignInService.signIn().getOrThrow()
            val authCredential = GoogleAuthProvider.credential(credentials.idToken, credentials.accessToken)
            auth.signInWithCredential(authCredential)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun signInWithEmailAndPassword(email: String, password: String): Result<Unit> {
        return try {
            auth.signInWithEmailAndPassword(email, password)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun signUpWithEmailAndPassword(email: String, password: String): Result<Unit> {
        return try {
            auth.createUserWithEmailAndPassword(email, password)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun signOut() {
        auth.signOut()
    }

    private fun FirebaseUser.toDomainUser(): User {
        return User(
            id = uid,
            email = email ?: "",
            displayName = displayName
        )
    }
}


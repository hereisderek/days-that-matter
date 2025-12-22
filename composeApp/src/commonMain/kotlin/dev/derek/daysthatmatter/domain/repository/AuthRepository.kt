package dev.derek.daysthatmatter.domain.repository

import dev.derek.daysthatmatter.domain.model.User
import kotlinx.coroutines.flow.Flow

interface AuthRepository {
    val currentUser: Flow<User?>
    suspend fun signInAnonymously(): Result<Unit>
    suspend fun signInWithEmailAndPassword(email: String, password: String): Result<Unit>
    suspend fun signInWithGoogle(): Result<Unit>
    suspend fun signUpWithEmailAndPassword(email: String, password: String): Result<Unit>
    suspend fun signOut()
}


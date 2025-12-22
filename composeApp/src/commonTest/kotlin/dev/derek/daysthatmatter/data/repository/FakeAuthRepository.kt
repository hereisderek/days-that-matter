package dev.derek.daysthatmatter.data.repository

import dev.derek.daysthatmatter.domain.model.User
import dev.derek.daysthatmatter.domain.repository.AuthRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow

class FakeAuthRepository : AuthRepository {
    private val _currentUser = MutableStateFlow<User?>(null)
    override val currentUser: Flow<User?> = _currentUser

    override suspend fun signInAnonymously(): Result<Unit> {
        _currentUser.value = User("anon_id", "Anonymous")
        return Result.success(Unit)
    }

    override suspend fun signInWithEmailAndPassword(email: String, password: String): Result<Unit> {
        if (email == "test@example.com" && password == "password") {
            _currentUser.value = User("user_id", email)
            return Result.success(Unit)
        }
        return Result.failure(Exception("Invalid credentials"))
    }

    override suspend fun signInWithGoogle(): Result<Unit> {
        _currentUser.value = User("google_id", "Google User")
        return Result.success(Unit)
    }

    override suspend fun signUpWithEmailAndPassword(email: String, password: String): Result<Unit> {
        _currentUser.value = User("new_user_id", email)
        return Result.success(Unit)
    }

    override suspend fun signOut() {
        _currentUser.value = null
    }
}


package dev.derek.daysthatmatter.domain.repository

interface StorageRepository {
    suspend fun uploadFile(path: String, bytes: ByteArray): Result<String>
    suspend fun deleteFile(url: String): Result<Unit>
}


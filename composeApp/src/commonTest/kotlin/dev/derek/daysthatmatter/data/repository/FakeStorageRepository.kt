package dev.derek.daysthatmatter.data.repository

import dev.derek.daysthatmatter.domain.repository.StorageRepository

class FakeStorageRepository : StorageRepository {
    override suspend fun uploadFile(path: String, bytes: ByteArray): Result<String> {
        return Result.success("https://fake.url/$path")
    }

    override suspend fun deleteFile(url: String): Result<Unit> {
        return Result.success(Unit)
    }
}


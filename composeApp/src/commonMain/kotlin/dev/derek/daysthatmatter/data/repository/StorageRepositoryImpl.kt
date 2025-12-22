package dev.derek.daysthatmatter.data.repository

import dev.derek.daysthatmatter.domain.repository.StorageRepository
import dev.derek.daysthatmatter.utils.toFirebaseData
import dev.gitlive.firebase.storage.FirebaseStorage
import dev.gitlive.firebase.storage.StorageReference
import dev.gitlive.firebase.storage.Data

class StorageRepositoryImpl(
    private val storage: FirebaseStorage
) : StorageRepository {

    override suspend fun uploadFile(path: String, bytes: ByteArray): Result<String> {
        return try {
            val ref = storage.reference(path)
            ref.putData(bytes.toFirebaseData())
            val downloadUrl = ref.getDownloadUrl()
            Result.success(downloadUrl)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun deleteFile(url: String): Result<Unit> {
        return try {
            // referenceFromUrl might not be exposed in common
            // If so, we can't easily delete by URL without parsing
            // For now, let's assume it's not supported or try to find a workaround
            // storage.referenceFromUrl(url).delete()
            Result.failure(Exception("Delete not supported yet"))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}


package dev.derek.daysthatmatter.core.database

import androidx.room.Dao
import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Upsert

/** Small key-value settings kept with the data they describe, such as sync cursors. */
@Entity(tableName = "app_meta")
data class AppMetaEntity(
    @PrimaryKey val key: String,
    val value: String,
)

@Dao
interface AppMetaDao {
    @Upsert
    suspend fun put(entry: AppMetaEntity)

    @Query("SELECT value FROM app_meta WHERE `key` = :key")
    suspend fun get(key: String): String?

    @Query("SELECT value FROM app_meta WHERE `key` = :key")
    fun observe(key: String): kotlinx.coroutines.flow.Flow<String?>

    @Query("SELECT * FROM app_meta")
    fun observeAll(): kotlinx.coroutines.flow.Flow<List<AppMetaEntity>>

    @Query("DELETE FROM app_meta WHERE `key` = :key")
    suspend fun delete(key: String)
}

package dev.derek.daysthatmatter.domain.model

import kotlinx.serialization.Serializable

@Serializable
data class Event(
    val isPublic: Boolean = false,
    val notes: String? = null,
    val ownerId: String = "",
    val backgroundUrl: String? = null,
    val date: Long = 0L, // Epoch millis
    val title: String = "",
    val id: String = "",
    val fontStyle: String? = null,
    val fontColor: Long? = null, // ARGB
    val backgroundColor: Long? = null, // ARGB
    val backgroundMusicUrl: String? = null,
    val backgroundMusicName: String? = null,
    val style: String = "Simple", // Simple, Photo, etc.
    val createdAt: Long = 0L,
    val updatedAt: Long = 0L
)

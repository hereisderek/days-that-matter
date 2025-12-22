package dev.derek.daysthatmatter.domain.model

import kotlinx.serialization.Serializable

@Serializable
data class SharedLink(
    val id: String = "",
    val eventId: String = "",
    val createdBy: String = "",
    val createdAt: Long = 0L
)


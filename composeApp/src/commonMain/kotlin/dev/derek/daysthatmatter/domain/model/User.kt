package dev.derek.daysthatmatter.domain.model

import kotlinx.serialization.Serializable

@Serializable
data class User(
    val id: String = "",
    val email: String = "",
    val displayName: String? = null
)


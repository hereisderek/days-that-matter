package dev.derek.daysthatmatter

interface Platform {
    val name: String
}

expect fun getPlatform(): Platform
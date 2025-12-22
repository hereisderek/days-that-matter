package dev.derek.daysthatmatter.domain.service

interface AudioPlayer {
    fun play(url: String)
    fun pause()
    fun stop()
    fun release()
}


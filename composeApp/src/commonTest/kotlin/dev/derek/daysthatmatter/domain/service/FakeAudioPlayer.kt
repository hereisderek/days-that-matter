package dev.derek.daysthatmatter.domain.service

class FakeAudioPlayer : AudioPlayer {
    var isPlaying = false
    var currentUrl: String? = null

    override fun play(url: String) {
        isPlaying = true
        currentUrl = url
    }

    override fun pause() {
        isPlaying = false
    }

    override fun stop() {
        isPlaying = false
        currentUrl = null
    }

    override fun release() {
        isPlaying = false
        currentUrl = null
    }
}


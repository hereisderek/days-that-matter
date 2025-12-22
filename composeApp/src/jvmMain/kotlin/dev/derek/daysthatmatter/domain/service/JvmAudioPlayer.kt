package dev.derek.daysthatmatter.domain.service

class JvmAudioPlayer : AudioPlayer {
    override fun play(url: String) {
        println("Playing audio: $url (Not implemented on JVM)")
    }

    override fun pause() {}
    override fun stop() {}
    override fun release() {}
}


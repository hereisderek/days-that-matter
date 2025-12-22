package dev.derek.daysthatmatter.domain.service

class JsAudioPlayer : AudioPlayer {
    override fun play(url: String) {
        println("Playing audio: $url (Not implemented on JS)")
    }

    override fun pause() {}
    override fun stop() {}
    override fun release() {}
}


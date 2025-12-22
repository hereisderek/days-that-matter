package dev.derek.daysthatmatter.domain.service

import platform.AVFoundation.AVPlayer
import platform.AVFoundation.AVPlayerItem
import platform.Foundation.NSURL

class IosAudioPlayer : AudioPlayer {
    private var player: AVPlayer? = null

    override fun play(url: String) {
        val nsUrl = NSURL.URLWithString(url) ?: return
        val playerItem = AVPlayerItem(uRL = nsUrl)
        player = AVPlayer(playerItem = playerItem)
        player?.play()
    }

    override fun pause() {
        player?.pause()
    }

    override fun stop() {
        player?.pause()
        player = null
    }

    override fun release() {
        stop()
    }
}


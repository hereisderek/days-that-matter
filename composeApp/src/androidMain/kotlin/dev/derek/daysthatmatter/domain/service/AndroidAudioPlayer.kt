package dev.derek.daysthatmatter.domain.service

import android.media.MediaPlayer

class AndroidAudioPlayer : AudioPlayer {
    private var mediaPlayer: MediaPlayer? = null

    override fun play(url: String) {
        stop()
        mediaPlayer = MediaPlayer().apply {
            setDataSource(url)
            prepareAsync()
            setOnPreparedListener { start() }
            setOnCompletionListener {
                // Optional: handle completion
            }
        }
    }

    override fun pause() {
        mediaPlayer?.pause()
    }

    override fun stop() {
        mediaPlayer?.stop()
        mediaPlayer?.release()
        mediaPlayer = null
    }

    override fun release() {
        stop()
    }
}


package dev.derek.daysthatmatter

import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.window.ComposeViewport
import dev.derek.daysthatmatter.di.initKoin

@OptIn(ExperimentalComposeUiApi::class)
fun main() {
    initKoin()
    ComposeViewport {
        App()
    }
}
package dev.derek.daysthatmatter

import androidx.compose.ui.window.Window
import androidx.compose.ui.window.application
import dev.derek.daysthatmatter.di.initKoin

fun main() = application {
    initKoin()
    Window(
        onCloseRequest = ::exitApplication,
        title = "Days that matter",
    ) {
        App()
    }
}
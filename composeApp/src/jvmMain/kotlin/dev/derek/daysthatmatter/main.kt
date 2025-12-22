package dev.derek.daysthatmatter

import androidx.compose.ui.window.Window
import androidx.compose.ui.window.application

fun main() = application {
    Window(
        onCloseRequest = ::exitApplication,
        title = "Days that matter",
    ) {
        App()
    }
}
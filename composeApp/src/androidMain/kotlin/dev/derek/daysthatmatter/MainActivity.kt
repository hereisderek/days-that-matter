package dev.derek.daysthatmatter

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        AndroidContext.activity = this

        setContent {
            App()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        if (AndroidContext.activity == this) {
            AndroidContext.activity = null
        }
    }
}

@Preview
@Composable
fun AppAndroidPreview() {
    App()
}
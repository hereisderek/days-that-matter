package dev.derek.daysthatmatter

import androidx.activity.ComponentActivity
import java.lang.ref.WeakReference

object AndroidContext {
    private var activityRef: WeakReference<ComponentActivity>? = null

    var activity: ComponentActivity?
        get() = activityRef?.get()
        set(value) {
            activityRef = if (value != null) WeakReference(value) else null
        }
}


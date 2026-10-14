package dev.derek.daysthatmatter.android

import android.app.Application
import dev.derek.daysthatmatter.app.initKoin
import org.koin.android.ext.koin.androidContext

class DaysThatMatterApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        initKoin {
            androidContext(this@DaysThatMatterApplication)
        }
    }
}

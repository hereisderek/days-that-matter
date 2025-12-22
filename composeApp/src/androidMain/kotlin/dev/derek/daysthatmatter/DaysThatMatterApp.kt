package dev.derek.daysthatmatter

import android.app.Application
import dev.derek.daysthatmatter.di.initKoin
import org.koin.android.ext.koin.androidContext

class DaysThatMatterApp : Application() {
    override fun onCreate() {
        super.onCreate()
        initKoin {
            androidContext(this@DaysThatMatterApp)
        }
    }
}


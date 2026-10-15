package dev.derek.daysthatmatter.app

import android.content.pm.ApplicationInfo
import dev.derek.daysthatmatter.core.common.AppDispatchers
import dev.derek.daysthatmatter.core.database.appDatabaseBuilder
import dev.derek.daysthatmatter.core.database.buildAppDatabase
import org.koin.android.ext.koin.androidContext
import org.koin.core.module.Module
import org.koin.dsl.module

internal actual val platformModule: Module = module {
    single { appDatabaseBuilder(androidContext()).buildAppDatabase(get<AppDispatchers>().io) }
    // Debuggable is set for debug builds only, so the debug helpers never run in a release build.
    single { AppBuildInfo(debug = androidContext().applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0) }
}

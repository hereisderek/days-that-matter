package dev.derek.daysthatmatter.app

import dev.derek.daysthatmatter.core.common.AppDispatchers
import dev.derek.daysthatmatter.core.database.appDatabaseBuilder
import dev.derek.daysthatmatter.core.database.buildAppDatabase
import org.koin.core.module.Module
import org.koin.dsl.module
import kotlin.experimental.ExperimentalNativeApi

@OptIn(ExperimentalNativeApi::class)
internal actual val platformModule: Module = module {
    single { appDatabaseBuilder().buildAppDatabase(get<AppDispatchers>().io) }
    single { AppBuildInfo(debug = Platform.isDebugBinary) }
}

package dev.derek.daysthatmatter.app

import dev.derek.daysthatmatter.core.common.AppDispatchers
import org.koin.core.KoinApplication
import org.koin.core.context.startKoin
import org.koin.core.module.Module
import org.koin.dsl.KoinAppDeclaration
import org.koin.dsl.module

private val coreModule = module {
    single { AppDispatchers.Platform }
}

/** Every Koin module shared by all platforms. Platform entry points add their own modules. */
val appModules: List<Module> = listOf(coreModule)

/** Starts Koin once, at app start. Android calls it from the Application, iOS from the app delegate. */
fun initKoin(platform: KoinAppDeclaration = {}): KoinApplication = startKoin {
    platform()
    modules(appModules)
}

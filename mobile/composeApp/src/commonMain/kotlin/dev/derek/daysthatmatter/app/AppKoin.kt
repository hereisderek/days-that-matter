package dev.derek.daysthatmatter.app

import dev.derek.daysthatmatter.core.common.AppDispatchers
import dev.derek.daysthatmatter.feature.eventeditor.di.eventEditorModule
import dev.derek.daysthatmatter.feature.events.di.eventsModule
import dev.derek.daysthatmatter.feature.settings.di.settingsModule
import org.koin.core.KoinApplication
import org.koin.core.context.startKoin
import org.koin.core.module.Module
import org.koin.dsl.KoinAppDeclaration
import org.koin.dsl.module
import kotlin.time.Clock

/** Facts about the running build. [debug] turns on debug-only helpers (sample days, the design gallery entry). */
data class AppBuildInfo(val debug: Boolean)

private val coreModule = module {
    single { AppDispatchers.Platform }
    single<Clock> { Clock.System }
}

/** Platform definitions: the Room database ([dev.derek.daysthatmatter.core.database.AppDatabase]) and [AppBuildInfo]. */
internal expect val platformModule: Module

/** Every Koin module shared by all platforms. Platform entry points add their own modules. */
val appModules: List<Module> get() = listOf(coreModule, platformModule, eventsModule, eventEditorModule, settingsModule)

/** Starts Koin once, at app start. Android calls it from the Application, iOS from the app delegate. */
fun initKoin(platform: KoinAppDeclaration = {}): KoinApplication = startKoin {
    platform()
    modules(appModules)
}

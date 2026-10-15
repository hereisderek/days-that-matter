package dev.derek.daysthatmatter.app

import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.navigation3.rememberViewModelStoreNavEntryDecorator
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.runtime.rememberSaveableStateHolderNavEntryDecorator
import androidx.navigation3.ui.NavDisplay
import dev.derek.daysthatmatter.app.navigation.AppNavigator
import dev.derek.daysthatmatter.app.navigation.ArchivedKey
import dev.derek.daysthatmatter.app.navigation.DayKey
import dev.derek.daysthatmatter.app.navigation.GalleryKey
import dev.derek.daysthatmatter.app.navigation.HomeKey
import dev.derek.daysthatmatter.app.navigation.navSavedStateConfiguration
import dev.derek.daysthatmatter.core.designsystem.gallery.DesignGallery
import dev.derek.daysthatmatter.core.designsystem.theme.DaysThatMatterTheme
import dev.derek.daysthatmatter.core.designsystem.theme.DtmTheme
import dev.derek.daysthatmatter.feature.events.debug.SeedSampleEventsUseCase
import dev.derek.daysthatmatter.feature.events.presentation.archived.ArchivedRoute
import dev.derek.daysthatmatter.feature.events.presentation.day.DayRoute
import dev.derek.daysthatmatter.feature.events.presentation.home.DebugAction
import dev.derek.daysthatmatter.feature.events.presentation.home.HomeRoute
import org.koin.compose.koinInject

/** Root of the app UI on every platform: the theme and the navigation between Home, the day page and Archived. */
@Composable
fun App(modifier: Modifier = Modifier) {
    DaysThatMatterTheme {
        Surface(modifier = modifier, color = DtmTheme.colors.bg) {
            AppNavigation()
        }
    }
}

/**
 * Navigation 3 back stack, saved across process death. Screens draw edge to edge and handle their own insets.
 * In debug builds an empty database is filled with sample days and Home shows a button to the design gallery.
 */
@Composable
fun AppNavigation(buildInfo: AppBuildInfo = koinInject()) {
    val backStack = rememberNavBackStack(navSavedStateConfiguration, HomeKey)
    val navigator = remember(backStack) { AppNavigator.of(backStack) }
    if (buildInfo.debug) DebugSeed()
    NavDisplay(
        backStack = backStack,
        onBack = { navigator.back() },
        entryDecorators = listOf(
            rememberSaveableStateHolderNavEntryDecorator(),
            rememberViewModelStoreNavEntryDecorator(),
        ),
        entryProvider = entryProvider {
            entry<HomeKey> {
                HomeRoute(
                    onOpenDay = navigator::openDay,
                    onOpenArchived = navigator::openArchived,
                    debugAction = if (buildInfo.debug) DebugAction("Design gallery", navigator::openGallery) else null,
                )
            }
            entry<DayKey> { key -> DayRoute(key.id, onClose = { navigator.back() }) }
            entry<ArchivedKey> { ArchivedRoute(onOpenDay = navigator::openDay, onClose = { navigator.back() }) }
            entry<GalleryKey> { DesignGallery(Modifier.safeDrawingPadding()) }
        },
    )
}

/** DEBUG ONLY: seeds the sample days once when the database is empty. */
@Composable
private fun DebugSeed(seed: SeedSampleEventsUseCase = koinInject()) {
    LaunchedEffect(seed) { seed() }
}

package dev.derek.daysthatmatter.app

import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.navigation3.rememberViewModelStoreNavEntryDecorator
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.runtime.rememberSaveableStateHolderNavEntryDecorator
import androidx.navigation3.ui.NavDisplay
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material3.Text
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.derek.daysthatmatter.app.navigation.AppNavigator
import dev.derek.daysthatmatter.app.navigation.ArchivedKey
import dev.derek.daysthatmatter.app.navigation.DayKey
import dev.derek.daysthatmatter.app.navigation.EditorKey
import dev.derek.daysthatmatter.app.navigation.GalleryKey
import dev.derek.daysthatmatter.app.navigation.HomeKey
import dev.derek.daysthatmatter.app.navigation.OnboardingChoiceKey
import dev.derek.daysthatmatter.app.navigation.SettingsKey
import dev.derek.daysthatmatter.app.navigation.SignInKey
import dev.derek.daysthatmatter.app.navigation.navSavedStateConfiguration
import dev.derek.daysthatmatter.core.designsystem.components.IconCircleButton
import dev.derek.daysthatmatter.core.designsystem.gallery.DesignGallery
import dev.derek.daysthatmatter.core.designsystem.icons.DtmIcons
import dev.derek.daysthatmatter.core.designsystem.theme.DaysThatMatterTheme
import dev.derek.daysthatmatter.core.designsystem.theme.DtmTheme
import dev.derek.daysthatmatter.feature.eventeditor.presentation.EditorMode
import dev.derek.daysthatmatter.feature.eventeditor.presentation.EventEditorRoute
import dev.derek.daysthatmatter.feature.events.debug.SeedSampleEventsUseCase
import dev.derek.daysthatmatter.feature.events.presentation.archived.ArchivedRoute
import dev.derek.daysthatmatter.feature.events.presentation.day.DayRoute
import dev.derek.daysthatmatter.feature.events.presentation.home.DebugAction
import dev.derek.daysthatmatter.feature.events.presentation.home.HomeRoute
import dev.derek.daysthatmatter.feature.settings.domain.SettingsRepository
import dev.derek.daysthatmatter.feature.settings.presentation.choice.FirstLaunchChoiceRoute
import dev.derek.daysthatmatter.feature.settings.presentation.settings.SettingsRoute
import org.koin.compose.koinInject

/** Root of the app UI on every platform: the theme and the navigation between Home, the day page, Archived and the editor. */
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
fun AppNavigation(
    buildInfo: AppBuildInfo = koinInject(),
    settingsRepository: SettingsRepository = koinInject(),
) {
    val settingsState by settingsRepository.settings.collectAsStateWithLifecycle(initialValue = null)
    if (settingsState == null) return

    val startKey = if (settingsState?.onboardingCompleted == true) HomeKey else OnboardingChoiceKey
    val backStack = rememberNavBackStack(navSavedStateConfiguration, startKey)
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
            entry<OnboardingChoiceKey> {
                FirstLaunchChoiceRoute(
                    onUseOnDevice = { navigator.completeOnboarding() },
                    onSignIn = { navigator.openSignIn() },
                )
            }
            entry<HomeKey> {
                HomeRoute(
                    onOpenDay = navigator::openDay,
                    onOpenArchived = navigator::openArchived,
                    debugAction = if (buildInfo.debug) DebugAction("Design gallery", navigator::openGallery) else null,
                    onNewDay = navigator::openNewDay,
                    onOpenSettings = navigator::openSettings,
                )
            }
            entry<SettingsKey> {
                SettingsRoute(
                    onBack = { navigator.back() },
                    onSignIn = { navigator.openSignIn() },
                )
            }
            entry<SignInKey> {
                SignInPlaceholderScreen(
                    onBack = { navigator.back() },
                )
            }
            entry<DayKey> { key -> DayRoute(key.id, onClose = { navigator.back() }, onEdit = navigator::openEditor) }
            entry<EditorKey> { key ->
                EventEditorRoute(
                    mode = key.id?.let { EditorMode.Edit(it) } ?: EditorMode.Create,
                    onClose = { navigator.closeEditor() },
                    onSaved = { id, created -> navigator.closeEditor(id, created) },
                )
            }
            entry<ArchivedKey> { ArchivedRoute(onOpenDay = navigator::openDay, onClose = { navigator.back() }) }
            entry<GalleryKey> { DesignGallery(Modifier.safeDrawingPadding()) }
        },
    )
}

@Composable
private fun SignInPlaceholderScreen(onBack: () -> Unit) {
    val colors = DtmTheme.colors
    val insets = WindowInsets.safeDrawing
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.bg)
            .windowInsetsPadding(insets.only(WindowInsetsSides.Top + WindowInsetsSides.Horizontal))
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        IconCircleButton(
            icon = DtmIcons.Back,
            contentDescription = "Back",
            onClick = onBack,
        )
        Text(
            text = "Sign in or create an account",
            style = DtmTheme.typography.screenTitle,
            color = colors.ink,
        )
        Text(
            text = "Online features need an account.",
            style = DtmTheme.typography.kicker,
            color = colors.ink3,
        )
    }
}

/** DEBUG ONLY: seeds the sample days once when the database is empty. */
@Composable
private fun DebugSeed(seed: SeedSampleEventsUseCase = koinInject()) {
    LaunchedEffect(seed) { seed() }
}

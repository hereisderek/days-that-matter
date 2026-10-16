package dev.derek.daysthatmatter.app.navigation

import androidx.navigation3.runtime.NavBackStack
import androidx.navigation3.runtime.NavKey
import androidx.savedstate.serialization.SavedStateConfiguration
import kotlinx.serialization.Serializable
import kotlinx.serialization.modules.SerializersModule
import kotlinx.serialization.modules.polymorphic

/** Home: the root of the back stack. */
@Serializable
data object HomeKey : NavKey

/** The day page of one day. */
@Serializable
data class DayKey(val id: String) : NavKey

/** The Archived screen. */
@Serializable
data object ArchivedKey : NavKey

/** The event editor: a new day when [id] is null, otherwise the owner's day [id]. */
@Serializable
data class EditorKey(val id: String? = null) : NavKey

/** DEBUG ONLY: the design gallery of :core:designsystem. */
@Serializable
data object GalleryKey : NavKey

/** The Settings screen. */
@Serializable
data object SettingsKey : NavKey

/** The first-launch choice screen. */
@Serializable
data object OnboardingChoiceKey : NavKey

/** The sign-in / account flow. */
@Serializable
data object SignInKey : NavKey

/** Registers every key so the back stack can be saved on every platform (Navigation 3 open polymorphism). */
val navSavedStateConfiguration: SavedStateConfiguration = SavedStateConfiguration {
    serializersModule = SerializersModule {
        polymorphic(NavKey::class) {
            subclass(HomeKey::class, HomeKey.serializer())
            subclass(DayKey::class, DayKey.serializer())
            subclass(ArchivedKey::class, ArchivedKey.serializer())
            subclass(EditorKey::class, EditorKey.serializer())
            subclass(GalleryKey::class, GalleryKey.serializer())
            subclass(SettingsKey::class, SettingsKey.serializer())
            subclass(OnboardingChoiceKey::class, OnboardingChoiceKey.serializer())
            subclass(SignInKey::class, SignInKey.serializer())
        }
    }
}

/** Moves through the app's screens by changing [backStack]. Home always stays at the bottom. */
class AppNavigator(private val backStack: MutableList<NavKey>) {
    fun openDay(id: String) {
        if (backStack.lastOrNull() != DayKey(id)) backStack.add(DayKey(id))
    }

    fun openArchived() {
        if (backStack.lastOrNull() != ArchivedKey) backStack.add(ArchivedKey)
    }

    /** Opens the editor for a new day. */
    fun openNewDay() {
        if (backStack.lastOrNull() != EditorKey()) backStack.add(EditorKey())
    }

    /** Opens the editor for the day [id]. */
    fun openEditor(id: String) {
        if (backStack.lastOrNull() != EditorKey(id)) backStack.add(EditorKey(id))
    }

    /**
     * After a save: a new day replaces the editor with its day page (design/v2 `save`); an edit returns to the
     * screen that opened the editor.
     */
    fun closeEditor(savedId: String? = null, created: Boolean = false) {
        if (backStack.lastOrNull() !is EditorKey) return
        backStack.removeAt(backStack.lastIndex)
        if (created && savedId != null) openDay(savedId)
    }

    fun openGallery() {
        if (backStack.lastOrNull() != GalleryKey) backStack.add(GalleryKey)
    }

    fun openSettings() {
        if (backStack.lastOrNull() != SettingsKey) backStack.add(SettingsKey)
    }

    fun openSignIn() {
        if (backStack.lastOrNull() != SignInKey) backStack.add(SignInKey)
    }

    /** Completes onboarding: clears the onboarding choice and sets Home at the root. */
    fun completeOnboarding() {
        backStack.clear()
        backStack.add(HomeKey)
    }

    /** Pops the top screen. Returns false at Home, where back leaves the app. */
    fun back(): Boolean {
        if (backStack.size <= 1) return false
        backStack.removeAt(backStack.lastIndex)
        return true
    }

    companion object {
        fun of(backStack: NavBackStack<NavKey>) = AppNavigator(backStack)
    }
}

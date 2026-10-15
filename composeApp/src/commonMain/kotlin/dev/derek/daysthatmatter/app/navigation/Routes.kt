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

/** DEBUG ONLY: the design gallery of :core:designsystem. */
@Serializable
data object GalleryKey : NavKey

/** Registers every key so the back stack can be saved on every platform (Navigation 3 open polymorphism). */
val navSavedStateConfiguration: SavedStateConfiguration = SavedStateConfiguration {
    serializersModule = SerializersModule {
        polymorphic(NavKey::class) {
            subclass(HomeKey::class, HomeKey.serializer())
            subclass(DayKey::class, DayKey.serializer())
            subclass(ArchivedKey::class, ArchivedKey.serializer())
            subclass(GalleryKey::class, GalleryKey.serializer())
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

    fun openGallery() {
        if (backStack.lastOrNull() != GalleryKey) backStack.add(GalleryKey)
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

package dev.derek.daysthatmatter.app

import androidx.navigation3.runtime.NavKey
import dev.derek.daysthatmatter.app.navigation.AppNavigator
import dev.derek.daysthatmatter.app.navigation.ArchivedKey
import dev.derek.daysthatmatter.app.navigation.DayKey
import dev.derek.daysthatmatter.app.navigation.GalleryKey
import dev.derek.daysthatmatter.app.navigation.HomeKey
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class AppNavigatorTest {

    private val stack = mutableListOf<NavKey>(HomeKey)
    private val navigator = AppNavigator(stack)

    @Test
    fun homeToArchivedToDayAndBack() {
        navigator.openArchived()
        navigator.openDay("trip")
        assertEquals(listOf(HomeKey, ArchivedKey, DayKey("trip")), stack)

        assertTrue(navigator.back())
        assertTrue(navigator.back())
        assertEquals(listOf<NavKey>(HomeKey), stack)
        assertFalse(navigator.back())
        assertEquals(listOf<NavKey>(HomeKey), stack)
    }

    @Test
    fun aDoubleTapDoesNotStackTheSameScreenTwice() {
        navigator.openDay("trip")
        navigator.openDay("trip")
        navigator.openGallery()
        navigator.openGallery()

        assertEquals(listOf(HomeKey, DayKey("trip"), GalleryKey), stack)
    }
}

package dev.derek.daysthatmatter.app

import androidx.navigation3.runtime.NavKey
import dev.derek.daysthatmatter.app.navigation.AppNavigator
import dev.derek.daysthatmatter.app.navigation.ArchivedKey
import dev.derek.daysthatmatter.app.navigation.DayKey
import dev.derek.daysthatmatter.app.navigation.EditorKey
import dev.derek.daysthatmatter.app.navigation.GalleryKey
import dev.derek.daysthatmatter.app.navigation.HomeKey
import dev.derek.daysthatmatter.app.navigation.OnboardingChoiceKey
import dev.derek.daysthatmatter.app.navigation.SettingsKey
import dev.derek.daysthatmatter.app.navigation.SignInKey
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

    @Test
    fun aNewDayReplacesTheEditorWithItsDayPage() {
        navigator.openNewDay()
        navigator.openNewDay()
        assertEquals(listOf(HomeKey, EditorKey()), stack)

        navigator.closeEditor("new-id", created = true)
        assertEquals(listOf(HomeKey, DayKey("new-id")), stack)
    }

    @Test
    fun anEditReturnsToTheDayPage() {
        navigator.openDay("trip")
        navigator.openEditor("trip")
        assertEquals(listOf(HomeKey, DayKey("trip"), EditorKey("trip")), stack)

        navigator.closeEditor("trip", created = false)
        assertEquals(listOf(HomeKey, DayKey("trip")), stack)
    }

    @Test
    fun cancellingTheEditorPopsOnlyTheEditor() {
        navigator.openDay("trip")
        navigator.closeEditor()
        assertEquals(listOf(HomeKey, DayKey("trip")), stack)

        navigator.openNewDay()
        navigator.closeEditor()
        assertEquals(listOf(HomeKey, DayKey("trip")), stack)
    }

    @Test
    fun homeToSettingsToSignInAndBack() {
        navigator.openSettings()
        navigator.openSignIn()
        assertEquals(listOf<NavKey>(HomeKey, SettingsKey, SignInKey), stack)

        assertTrue(navigator.back())
        assertEquals(listOf<NavKey>(HomeKey, SettingsKey), stack)
        assertTrue(navigator.back())
        assertEquals(listOf<NavKey>(HomeKey), stack)
    }

    @Test
    fun completeOnboardingResetsStackToHome() {
        val onboardingStack = mutableListOf<NavKey>(OnboardingChoiceKey)
        val onbNavigator = AppNavigator(onboardingStack)
        onbNavigator.openSignIn()
        assertEquals(listOf<NavKey>(OnboardingChoiceKey, SignInKey), onboardingStack)

        onbNavigator.completeOnboarding()
        assertEquals(listOf<NavKey>(HomeKey), onboardingStack)
    }
}

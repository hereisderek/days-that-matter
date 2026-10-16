package dev.derek.daysthatmatter.android

import dev.derek.daysthatmatter.app.appModules
import kotlin.test.Test
import kotlin.test.assertTrue

class AndroidAppTest {
    @Test
    fun appModulesIncludesAllRequiredFeatureModules() {
        val modules = appModules
        assertTrue(modules.isNotEmpty(), "appModules should not be empty")
        assertTrue(modules.size >= 5, "Expected at least 5 modules including settingsModule, got ${modules.size}")
    }
}

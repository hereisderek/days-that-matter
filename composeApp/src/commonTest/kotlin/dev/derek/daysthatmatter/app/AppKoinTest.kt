package dev.derek.daysthatmatter.app

import dev.derek.daysthatmatter.core.common.AppDispatchers
import org.koin.core.context.stopKoin
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertSame

class AppKoinTest {

    @AfterTest
    fun tearDown() {
        stopKoin()
    }

    @Test
    fun initKoinProvidesThePlatformDispatchers() {
        val koin = initKoin().koin

        assertSame(AppDispatchers.Platform, koin.get<AppDispatchers>())
    }
}

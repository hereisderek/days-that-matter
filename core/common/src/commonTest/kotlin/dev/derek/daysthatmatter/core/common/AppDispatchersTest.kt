package dev.derek.daysthatmatter.core.common

import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.withContext
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertSame

@OptIn(ExperimentalCoroutinesApi::class)
class AppDispatchersTest {

    @Test
    fun singleUsesTheSameDispatcherForEveryKind() {
        val dispatcher = StandardTestDispatcher()
        val dispatchers = AppDispatchers.single(dispatcher)

        assertSame(dispatcher, dispatchers.main)
        assertSame(dispatcher, dispatchers.io)
        assertSame(dispatcher, dispatchers.default)
    }

    @Test
    fun workSwitchedToIoRunsOnTheTestScheduler() = runTest {
        val dispatchers = AppDispatchers.single(StandardTestDispatcher(testScheduler))

        val result = withContext(dispatchers.io) { 40 + 2 }

        assertEquals(42, result)
    }
}

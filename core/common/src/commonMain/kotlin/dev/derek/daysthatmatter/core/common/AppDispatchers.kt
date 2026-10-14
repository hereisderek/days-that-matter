package dev.derek.daysthatmatter.core.common

import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.IO

/**
 * The dispatchers used by repositories and use cases. Classes receive this instead of calling
 * [Dispatchers] directly, so tests can run everything on one test dispatcher.
 */
data class AppDispatchers(
    val main: CoroutineDispatcher,
    val io: CoroutineDispatcher,
    val default: CoroutineDispatcher,
) {
    companion object {
        /** The platform dispatchers used by the running app. Created on first use, so tests never touch them. */
        val Platform: AppDispatchers by lazy {
            AppDispatchers(main = Dispatchers.Main, io = Dispatchers.IO, default = Dispatchers.Default)
        }

        /** Runs every kind of work on [dispatcher], for tests. */
        fun single(dispatcher: CoroutineDispatcher): AppDispatchers =
            AppDispatchers(main = dispatcher, io = dispatcher, default = dispatcher)
    }
}

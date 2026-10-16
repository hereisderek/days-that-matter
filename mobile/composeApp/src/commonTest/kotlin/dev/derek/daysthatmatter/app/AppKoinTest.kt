package dev.derek.daysthatmatter.app

import dev.derek.daysthatmatter.core.common.AppDispatchers
import dev.derek.daysthatmatter.core.model.event.EventDoc
import dev.derek.daysthatmatter.feature.eventeditor.domain.CheckNewEventGateUseCase
import dev.derek.daysthatmatter.feature.eventeditor.domain.LoadEditableEventUseCase
import dev.derek.daysthatmatter.feature.eventeditor.domain.UpsertEventUseCase
import dev.derek.daysthatmatter.feature.events.debug.SeedSampleEventsUseCase
import dev.derek.daysthatmatter.feature.events.domain.ArchiveEventUseCase
import dev.derek.daysthatmatter.feature.events.domain.EventRepository
import dev.derek.daysthatmatter.feature.events.domain.ObserveEventsUseCase
import dev.derek.daysthatmatter.feature.events.domain.SetUnitModeUseCase
import dev.derek.daysthatmatter.feature.events.domain.StoredEvent
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.emptyFlow
import org.koin.core.context.stopKoin
import org.koin.dsl.module
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertSame
import kotlin.time.Clock
import kotlin.time.Instant

class AppKoinTest {

    @AfterTest
    fun tearDown() {
        stopKoin()
    }

    @Test
    fun initKoinProvidesThePlatformDispatchersAndTheClock() {
        val koin = initKoin().koin

        assertSame(AppDispatchers.Platform, koin.get<AppDispatchers>())
        assertSame(Clock.System, koin.get<Clock>())
    }

    @Test
    fun theEventsUseCasesResolve() {
        // The database needs a platform context, so the repository is replaced here.
        val koin = initKoin { allowOverride(true) }.koin
        koin.loadModules(listOf(module { single<EventRepository> { NoEvents } }), allowOverride = true)

        koin.get<ObserveEventsUseCase>()
        koin.get<ArchiveEventUseCase>()
        koin.get<SetUnitModeUseCase>()
        koin.get<SeedSampleEventsUseCase>()
    }

    @Test
    fun theEditorUseCasesResolve() {
        val koin = initKoin { allowOverride(true) }.koin
        koin.loadModules(listOf(module { single<EventRepository> { NoEvents } }), allowOverride = true)

        koin.get<LoadEditableEventUseCase>()
        koin.get<CheckNewEventGateUseCase>()
        koin.get<UpsertEventUseCase>()
    }

    @Test
    fun theSettingsUseCasesResolve() {
        val koin = initKoin { allowOverride(true) }.koin
        koin.loadModules(listOf(module { single<dev.derek.daysthatmatter.feature.settings.domain.SettingsRepository> { dev.derek.daysthatmatter.feature.settings.data.FakeSettingsRepository() } }), allowOverride = true)

        koin.get<dev.derek.daysthatmatter.feature.settings.presentation.settings.SettingsViewModel>()
        koin.get<dev.derek.daysthatmatter.feature.settings.presentation.choice.FirstLaunchChoiceViewModel>()
    }

    private object NoEvents : EventRepository {
        override fun observeHome(text: String, categoryId: String?): Flow<List<StoredEvent>> = emptyFlow()
        override fun observeArchived(): Flow<List<StoredEvent>> = emptyFlow()
        override fun observeArchivedCount(): Flow<Int> = emptyFlow()
        override fun observeEvent(id: String): Flow<StoredEvent?> = emptyFlow()
        override suspend fun get(id: String): StoredEvent? = null
        override suspend fun edit(id: String, change: (EventDoc) -> EventDoc): Boolean = false
        override suspend fun delete(id: String): Boolean = false
        override suspend fun restore(id: String): Boolean = false
        override suspend fun isEmpty(): Boolean = true
        override suspend fun add(docs: List<EventDoc>, createdAt: Instant) = Unit
    }
}

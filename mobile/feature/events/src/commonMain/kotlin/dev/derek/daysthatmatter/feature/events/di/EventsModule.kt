package dev.derek.daysthatmatter.feature.events.di

import dev.derek.daysthatmatter.core.database.AppDatabase
import dev.derek.daysthatmatter.feature.events.data.RoomEventRepository
import dev.derek.daysthatmatter.feature.events.debug.SeedSampleEventsUseCase
import dev.derek.daysthatmatter.feature.events.domain.ArchiveEventUseCase
import dev.derek.daysthatmatter.feature.events.domain.DeleteEventUseCase
import dev.derek.daysthatmatter.feature.events.domain.EventRepository
import dev.derek.daysthatmatter.feature.events.domain.ObserveArchivedCountUseCase
import dev.derek.daysthatmatter.feature.events.domain.ObserveArchivedUseCase
import dev.derek.daysthatmatter.feature.events.domain.ObserveEventUseCase
import dev.derek.daysthatmatter.feature.events.domain.ObserveEventsUseCase
import dev.derek.daysthatmatter.feature.events.domain.PinEventUseCase
import dev.derek.daysthatmatter.feature.events.domain.RestoreEventUseCase
import dev.derek.daysthatmatter.feature.events.domain.SetUnitModeUseCase
import dev.derek.daysthatmatter.feature.events.domain.ClockTicker
import dev.derek.daysthatmatter.feature.events.domain.Ticker
import dev.derek.daysthatmatter.feature.events.domain.UnarchiveEventUseCase
import dev.derek.daysthatmatter.feature.events.presentation.archived.ArchivedViewModel
import dev.derek.daysthatmatter.feature.events.presentation.day.EventDetailViewModel
import dev.derek.daysthatmatter.feature.events.presentation.home.HomeViewModel
import kotlinx.datetime.TimeZone
import org.koin.core.module.dsl.viewModel
import org.koin.dsl.module
import kotlin.time.Clock

/** The device's current time zone, read on each use so a zone change applies at the next tick. */
typealias DeviceZone = () -> TimeZone

/**
 * The events feature. Needs an [AppDatabase] and a [Clock] from the app shell; provides the repository, use cases
 * and ViewModels.
 */
val eventsModule = module {
    single<DeviceZone> { { TimeZone.currentSystemDefault() } }
    single<Ticker> { ClockTicker(get()) }
    single<EventRepository> { RoomEventRepository(get<AppDatabase>().eventDao(), get()) }

    factory { ObserveEventsUseCase(get(), get(), get<DeviceZone>()) }
    factory { ObserveEventUseCase(get(), get(), get<DeviceZone>()) }
    factory { ObserveArchivedUseCase(get(), get(), get<DeviceZone>()) }
    factory { ObserveArchivedCountUseCase(get()) }
    factory { ArchiveEventUseCase(get(), get()) }
    factory { UnarchiveEventUseCase(get()) }
    factory { PinEventUseCase(get(), get()) }
    factory { DeleteEventUseCase(get()) }
    factory { RestoreEventUseCase(get()) }
    factory { SetUnitModeUseCase(get()) }
    // DEBUG ONLY: the app shell runs it in debuggable builds.
    factory { SeedSampleEventsUseCase(get(), get(), get<DeviceZone>()) }

    viewModel { HomeViewModel(get(), get(), get(), get(), get(), get(), get(), get<DeviceZone>(), get()) }
    viewModel { params -> EventDetailViewModel(params.get(), get(), get(), get(), get(), get<DeviceZone>()) }
    viewModel { ArchivedViewModel(get(), get(), get(), get()) }
}

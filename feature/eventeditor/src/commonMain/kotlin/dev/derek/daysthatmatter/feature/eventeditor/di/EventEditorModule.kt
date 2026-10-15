package dev.derek.daysthatmatter.feature.eventeditor.di

import dev.derek.daysthatmatter.core.model.plan.Plan
import dev.derek.daysthatmatter.feature.eventeditor.domain.CheckNewEventGateUseCase
import dev.derek.daysthatmatter.feature.eventeditor.domain.EventIdGenerator
import dev.derek.daysthatmatter.feature.eventeditor.domain.LoadEditableEventUseCase
import dev.derek.daysthatmatter.feature.eventeditor.domain.PlanProvider
import dev.derek.daysthatmatter.feature.eventeditor.domain.UpsertEventUseCase
import dev.derek.daysthatmatter.feature.eventeditor.presentation.EventEditorViewModel
import dev.derek.daysthatmatter.feature.events.di.DeviceZone
import org.koin.core.module.dsl.viewModel
import org.koin.dsl.module

/**
 * The event editor. Builds on `eventsModule` (the repository, the [DeviceZone]) and a `kotlin.time.Clock` from the
 * app shell. The plan is Free until accounts and purchases exist (guests follow Free).
 */
val eventEditorModule = module {
    single<PlanProvider> { PlanProvider { Plan.Free } }
    single<EventIdGenerator> { EventIdGenerator.Random }
    factory { LoadEditableEventUseCase(get()) }
    factory { CheckNewEventGateUseCase(get(), get()) }
    factory { UpsertEventUseCase(get(), get(), get(), get()) }
    viewModel { params -> EventEditorViewModel(params.get(), get(), get(), get(), get(), get<DeviceZone>()) }
}

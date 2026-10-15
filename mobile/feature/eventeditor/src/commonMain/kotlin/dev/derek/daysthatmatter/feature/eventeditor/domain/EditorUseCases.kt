package dev.derek.daysthatmatter.feature.eventeditor.domain

import dev.derek.daysthatmatter.core.model.event.EventDoc
import dev.derek.daysthatmatter.core.model.plan.GateResult
import dev.derek.daysthatmatter.core.model.plan.Plan
import dev.derek.daysthatmatter.core.model.plan.PlanGate
import dev.derek.daysthatmatter.core.model.plan.UsageCounts
import dev.derek.daysthatmatter.core.model.validation.FieldError
import dev.derek.daysthatmatter.feature.events.domain.EventRepository
import kotlinx.coroutines.flow.first
import kotlin.time.Clock
import kotlin.uuid.ExperimentalUuidApi
import kotlin.uuid.Uuid

/**
 * The plan of the person saving (gating follows the writer's own plan, docs/features/premium/SPEC.md). Guests follow
 * Free; accounts and purchases replace this with the account's effective plan in a later wave.
 */
fun interface PlanProvider {
    suspend fun current(): Plan
}

/** A new random id for a day created on this device (UUID, as the API expects). */
fun interface EventIdGenerator {
    fun next(): String

    companion object {
        @OptIn(ExperimentalUuidApi::class)
        val Random: EventIdGenerator = EventIdGenerator { Uuid.random().toString() }
    }
}

/** What the editor may do with a stored day. */
sealed interface EditableEvent {
    data class Found(val doc: EventDoc) : EditableEvent

    /** No such day, or it was deleted. */
    data object NotFound : EditableEvent

    /** Shared with the reader as an editor or viewer: only the owner opens the editor. */
    data object NotAllowed : EditableEvent
}

/** Loads a day for the editor. Only its owner may edit it here. */
class LoadEditableEventUseCase(private val repository: EventRepository) {
    suspend operator fun invoke(id: String): EditableEvent {
        val event = repository.get(id) ?: return EditableEvent.NotFound
        return if (event.isOwner) EditableEvent.Found(event.doc) else EditableEvent.NotAllowed
    }
}

/**
 * The plan gate for a new day (design D14, `PlanGate.needsForNewEvent`): the owned-event limit of the writer's plan.
 * Owned days count archived ones too; days shared with the reader do not count.
 */
class CheckNewEventGateUseCase(
    private val repository: EventRepository,
    private val plans: PlanProvider,
) {
    suspend operator fun invoke(): GateCheck {
        val plan = plans.current()
        val owned = repository.observeHome().first().count { it.isOwner } + repository.observeArchived().first().count { it.isOwner }
        return GateCheck(plan, PlanGate.check(plan, UsageCounts(ownedEvents = owned), PlanGate.needsForNewEvent()))
    }
}

/** A gate result and the plan it was checked against. */
data class GateCheck(val plan: Plan, val result: GateResult)

/** Outcome of [UpsertEventUseCase]. */
sealed interface SaveResult {
    /** Stored on this device. [created] is false for an edit. [changed] is false when an edit changed nothing. */
    data class Saved(val id: String, val created: Boolean, val changed: Boolean = true) : SaveResult

    data object NotFound : SaveResult

    data object NotAllowed : SaveResult

    /** `EventValidation` rejected the write. */
    data class Invalid(val errors: List<FieldError>) : SaveResult

    /** The plan gate rejected a new day. */
    data class Blocked(val gate: GateCheck) : SaveResult
}

/**
 * Saves the editor's draft on this device (offline first, PERSISTENCE_AND_SYNC.md): every write is local and at once.
 *
 * - Create ([original] null): checks the owned-event gate, gives the day a new id, role owner and no server revision,
 *   validates it as a new document and adds it with the clock's time as created and updated time.
 * - Edit: only the owner may. The patch is the writable fields that differ from [original] (`EventWriteChecks.patch`),
 *   validated as a patch and applied field by field to the stored document, so role, server revision and anything
 *   stored meanwhile are kept. The repository sets `updated_at` and, for a day already on the backend, adds the
 *   changed fields to `pending_patch` for the sync engine.
 */
class UpsertEventUseCase(
    private val repository: EventRepository,
    private val clock: Clock,
    private val gate: CheckNewEventGateUseCase,
    private val ids: EventIdGenerator = EventIdGenerator.Random,
) {
    suspend operator fun invoke(draft: EventDraft, original: EventDoc? = null): SaveResult =
        if (original == null) create(draft) else update(draft, original)

    private suspend fun create(draft: EventDraft): SaveResult {
        val check = gate()
        if (check.result != GateResult.Allowed) return SaveResult.Blocked(check)
        val now = clock.now()
        val doc = draft.toEventDoc(id = ids.next(), base = null, now = now)
        val errors = EventWriteChecks.errorsOf(doc)
        if (errors.isNotEmpty()) return SaveResult.Invalid(errors)
        repository.add(listOf(doc), createdAt = now)
        return SaveResult.Saved(doc.id, created = true)
    }

    private suspend fun update(draft: EventDraft, original: EventDoc): SaveResult {
        val stored = repository.get(original.id) ?: return SaveResult.NotFound
        if (!stored.isOwner) return SaveResult.NotAllowed
        val now = clock.now()
        val patch = EventWriteChecks.patch(original, draft.toEventDoc(id = original.id, base = original, now = now))
        if (patch.isEmpty()) return SaveResult.Saved(original.id, created = false, changed = false)
        val errors = EventWriteChecks.errorsOfPatch(patch) +
            listOfNotNull(EventWriteChecks.sizeError(EventWriteChecks.apply(stored.doc, patch)))
        if (errors.isNotEmpty()) return SaveResult.Invalid(errors)
        val found = repository.edit(original.id) { current ->
            EventWriteChecks.apply(current, patch).copy(updatedAt = now)
        }
        return if (found) SaveResult.Saved(original.id, created = false) else SaveResult.NotFound
    }
}

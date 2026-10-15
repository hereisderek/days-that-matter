package dev.derek.daysthatmatter.core.model.merge

import dev.derek.daysthatmatter.core.model.event.EventFields
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject

/**
 * Result of applying a patch.
 *
 * @property doc the document after the patch.
 * @property applied the fields the patch really changed, with their new values (null = cleared).
 *   Fields set to the value they already had are left out. This is the revision's `patch`.
 * @property inverse the old values of the same fields (null = was absent). Applying it undoes the
 *   patch. This is the revision's `inverse`.
 */
data class PatchResult(val doc: JsonObject, val applied: JsonObject, val inverse: JsonObject) {
    val changedFields: Set<String> get() = applied.keys
}

/** A revision as far as overwritten-field detection needs it. [authorId] null = deleted account. */
data class RevisionFields(val rev: Long, val authorId: String?, val fields: Set<String>)

/**
 * Field-level last-write-wins (design D5).
 *
 * Documents are JSON objects of top-level fields that omit cleared values. A patch holds new values
 * of top-level fields; `null` clears a field. Nested objects (theme, recurrence, backdrop, audio,
 * reminders) are replaced whole, never merged. Memos use the same rule without revisions.
 */
object PatchMerge {
    /** Applies [patch] to [doc]. Validate the patch first; this function trusts its field names and values. */
    fun apply(doc: JsonObject, patch: JsonObject): PatchResult {
        val out = LinkedHashMap(doc)
        val applied = LinkedHashMap<String, JsonElement>()
        val inverse = LinkedHashMap<String, JsonElement>()
        for ((field, value) in patch) {
            val old = doc[field] ?: JsonNull
            if (old == value) continue
            applied[field] = value
            inverse[field] = old
            if (value is JsonNull) out.remove(field) else out[field] = value
        }
        return PatchResult(JsonObject(out), JsonObject(applied), JsonObject(inverse))
    }

    /**
     * Applies an event [patch] with the event rule of design-v2 D4: a write that sets `archivedAt`
     * also clears `pinnedAt`, so the inverse restores the pin.
     */
    fun applyToEvent(doc: JsonObject, patch: JsonObject): PatchResult = apply(doc, withEventRules(patch))

    /** [patch] with the rules that tie event fields together. */
    fun withEventRules(patch: JsonObject): JsonObject {
        val archived = patch[EventFields.ARCHIVED_AT]
        if (archived == null || archived is JsonNull) return patch
        return JsonObject(patch + (EventFields.PINNED_AT to JsonNull))
    }

    /**
     * The fields where a write by [writerId] based on [baseRev] replaced a newer change by someone
     * else: fields it changed that a revision after [baseRev] by another account (or a deleted
     * account) also changed. Sorted by name for a stable response.
     */
    fun overwrittenFields(
        changedFields: Set<String>,
        baseRev: Long,
        revisionsSinceBase: List<RevisionFields>,
        writerId: String,
    ): List<String> {
        val byOthers = revisionsSinceBase
            .filter { it.rev > baseRev && it.authorId != writerId }
            .flatMapTo(HashSet()) { it.fields }
        return changedFields.filter { it in byOthers }.sorted()
    }

    /**
     * The document as it was at revision [targetRev]: [current] with the inverses of every later
     * revision applied, newest first. [later] holds `(rev, inverse)` pairs of the revisions after
     * [targetRev], in any order.
     */
    fun revertTo(current: JsonObject, targetRev: Long, later: List<Pair<Long, JsonObject>>): JsonObject =
        later.filter { it.first > targetRev }
            .sortedByDescending { it.first }
            .fold(current) { doc, (_, inverse) -> apply(doc, inverse).doc }
}

package dev.derek.daysthatmatter.core.database.event

import dev.derek.daysthatmatter.core.model.ModelJson
import dev.derek.daysthatmatter.core.model.event.EventDoc
import dev.derek.daysthatmatter.core.model.event.EventFields
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject

/**
 * Builds the `pending_patch` of a row: the writable fields ([EventFields.WRITABLE]) changed since the row's
 * server revision, in the API form the sync engine sends (`PATCH /events/{id}`, PERSISTENCE_AND_SYNC.md
 * section 3). A cleared field is `null`.
 */
object EventPatches {
    /** Writes every field, defaults and nulls included, so a change to a default value shows up. */
    private val fullJson: Json = Json(ModelJson) {
        encodeDefaults = true
        explicitNulls = true
    }

    /** The fields whose value differs between [old] and [new]; empty when nothing writable changed. */
    fun diff(old: EventDoc, new: EventDoc): JsonObject {
        val before = fullJson.encodeToJsonElement(EventDoc.serializer(), old).jsonObject
        val after = fullJson.encodeToJsonElement(EventDoc.serializer(), new).jsonObject
        val changed = LinkedHashMap<String, JsonElement>()
        for (field in EventFields.WRITABLE.sorted()) {
            val value = after[field] ?: JsonNull
            if ((before[field] ?: JsonNull) != value) changed[field] = value
        }
        return JsonObject(changed)
    }

    /** [existing] (a stored patch or null) with the fields of [patch] added or replaced; null when both are empty. */
    fun merge(existing: String?, patch: JsonObject): String? {
        val base = existing?.let { ModelJson.parseToJsonElement(it).jsonObject } ?: JsonObject(emptyMap())
        val merged = JsonObject(base + patch)
        return if (merged.isEmpty()) null else ModelJson.encodeToString(JsonObject.serializer(), merged)
    }
}

/**
 * The row after a local edit from [old] to [new] at [now]: the document's fields, a new `updated_at`, and,
 * for a row that is on the backend, the changed fields added to `pending_patch`. A row that was never synced
 * keeps no patch: the sync engine sends it whole.
 */
fun EventEntity.withLocalEdit(new: EventDoc, nowEpochMillis: Long): EventEntity {
    val meta = rowMeta()
    val patch = if (serverRev == null) null else EventPatches.merge(pendingPatch, EventPatches.diff(toEventDoc(), new))
    return new.toEntity(
        meta.copy(
            updatedAt = kotlin.time.Instant.fromEpochMilliseconds(nowEpochMillis),
            pendingPatch = patch,
        ),
    )
}

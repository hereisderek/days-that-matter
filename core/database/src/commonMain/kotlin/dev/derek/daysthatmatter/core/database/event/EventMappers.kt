package dev.derek.daysthatmatter.core.database.event

import dev.derek.daysthatmatter.core.model.ModelJson
import dev.derek.daysthatmatter.core.model.event.Audio
import dev.derek.daysthatmatter.core.model.event.Backdrop
import dev.derek.daysthatmatter.core.model.event.EventDoc
import dev.derek.daysthatmatter.core.model.event.Recurrence
import dev.derek.daysthatmatter.core.model.event.Reminders
import dev.derek.daysthatmatter.core.model.event.Role
import dev.derek.daysthatmatter.core.model.event.Theme
import dev.derek.daysthatmatter.core.model.event.UnitMode
import kotlinx.datetime.LocalDate
import kotlinx.datetime.LocalTime
import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonPrimitive
import kotlin.time.Instant

/**
 * Sync bookkeeping and local metadata of a row, which [EventDoc] does not carry. [serverRev] null means
 * the day was never on the backend.
 */
data class EventRowMeta(
    val createdAt: Instant,
    val updatedAt: Instant,
    val serverRev: Long? = null,
    val childSeq: Long = 0,
    val pendingPatch: String? = null,
    val isDeleted: Boolean = false,
)

/** The day as a `:core:model` document. [EventDoc.rev] is the server revision, 0 when it was never synced. */
fun EventEntity.toEventDoc(): EventDoc = EventDoc(
    id = id,
    rev = serverRev ?: 0,
    role = decodeEnum(Role.serializer(), role),
    title = title,
    emoji = emoji,
    targetDate = LocalDate.fromEpochDays(targetDateEpochDays),
    targetTime = targetTimeSeconds?.let(LocalTime::fromSecondOfDay),
    timeZone = timeZone,
    unitMode = decodeEnum(UnitMode.serializer(), unitMode),
    recurrence = ModelJson.decodeFromString(Recurrence.serializer(), recurrenceJson),
    theme = ModelJson.decodeFromString(Theme.serializer(), themeJson),
    backdrop = backdropJson?.let { ModelJson.decodeFromString(Backdrop.serializer(), it) },
    audio = audioJson?.let { ModelJson.decodeFromString(Audio.serializer(), it) },
    notes = notes,
    pinnedAt = pinnedAtEpochMillis?.let(Instant::fromEpochMilliseconds),
    categoryId = categoryId,
    archivedAt = archivedAtEpochMillis?.let(Instant::fromEpochMilliseconds),
    reminders = remindersJson?.let { ModelJson.decodeFromString(Reminders.serializer(), it) },
    updatedAt = Instant.fromEpochMilliseconds(updatedAtEpochMillis),
)

/** The bookkeeping columns of this row. */
fun EventEntity.rowMeta(): EventRowMeta = EventRowMeta(
    createdAt = Instant.fromEpochMilliseconds(createdAtEpochMillis),
    updatedAt = Instant.fromEpochMilliseconds(updatedAtEpochMillis),
    serverRev = serverRev,
    childSeq = childSeq,
    pendingPatch = pendingPatch,
    isDeleted = isDeleted,
)

/**
 * The row for this document. A missing [EventDoc.role] is stored as owner (a day created on this device).
 * The member view's `members` and `archived` are not stored: people are loaded from the backend.
 */
fun EventDoc.toEntity(meta: EventRowMeta): EventEntity = EventEntity(
    id = id,
    title = title,
    emoji = emoji,
    notes = notes,
    targetDateEpochDays = targetDate.toEpochDays().toInt(),
    targetTimeSeconds = targetTime?.toSecondOfDay(),
    timeZone = timeZone,
    unitMode = encodeEnum(UnitMode.serializer(), unitMode),
    recurrenceJson = ModelJson.encodeToString(Recurrence.serializer(), recurrence),
    themeJson = ModelJson.encodeToString(Theme.serializer(), theme),
    backdropJson = backdrop?.let { ModelJson.encodeToString(Backdrop.serializer(), it) },
    audioJson = audio?.let { ModelJson.encodeToString(Audio.serializer(), it) },
    pinnedAtEpochMillis = pinnedAt?.toEpochMilliseconds(),
    archivedAtEpochMillis = archivedAt?.toEpochMilliseconds(),
    remindersJson = reminders?.let { ModelJson.encodeToString(Reminders.serializer(), it) },
    categoryId = categoryId,
    role = encodeEnum(Role.serializer(), role ?: Role.Owner),
    serverRev = meta.serverRev,
    childSeq = meta.childSeq,
    pendingPatch = meta.pendingPatch,
    isDeleted = meta.isDeleted,
    createdAtEpochMillis = meta.createdAt.toEpochMilliseconds(),
    updatedAtEpochMillis = meta.updatedAt.toEpochMilliseconds(),
)

/** The API value of an enum (`owner`, `workdays`), as its serializer writes it. */
internal fun <T> encodeEnum(serializer: KSerializer<T>, value: T): String =
    ModelJson.encodeToJsonElement(serializer, value).jsonPrimitive.content

internal fun <T> decodeEnum(serializer: KSerializer<T>, value: String): T =
    ModelJson.decodeFromJsonElement(serializer, JsonPrimitive(value))

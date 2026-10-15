package dev.derek.daysthatmatter.core.database

import dev.derek.daysthatmatter.core.database.event.EventEntity
import dev.derek.daysthatmatter.core.database.event.EventRowMeta
import dev.derek.daysthatmatter.core.database.event.toEntity
import dev.derek.daysthatmatter.core.model.event.EventDoc
import dev.derek.daysthatmatter.core.model.event.Role
import dev.derek.daysthatmatter.core.model.event.Theme
import kotlinx.datetime.LocalDate
import kotlin.time.Instant

internal val T0: Instant = Instant.parse("2026-10-14T09:00:00Z")

internal fun doc(
    id: String,
    title: String = id,
    date: LocalDate = LocalDate(2026, 12, 1),
    role: Role? = Role.Owner,
    pinnedAt: Instant? = null,
    archivedAt: Instant? = null,
    categoryId: String? = null,
): EventDoc = EventDoc(
    id = id,
    role = role,
    title = title,
    targetDate = date,
    theme = Theme(paletteId = "mint", cardStyle = "glass", typography = "sans"),
    pinnedAt = pinnedAt,
    archivedAt = archivedAt,
    categoryId = categoryId,
)

internal fun EventDoc.row(serverRev: Long? = null, createdAt: Instant = T0): EventEntity =
    toEntity(EventRowMeta(createdAt = createdAt, updatedAt = createdAt, serverRev = serverRev))

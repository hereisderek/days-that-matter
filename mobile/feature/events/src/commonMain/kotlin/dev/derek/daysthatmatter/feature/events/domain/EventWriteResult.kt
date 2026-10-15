package dev.derek.daysthatmatter.feature.events.domain

/** Outcome of a write use case. */
enum class EventWriteResult {
    Done,

    /** No such day (or it was deleted). */
    NotFound,

    /** The reader's role does not allow it (a member pinning, a viewer changing the unit). */
    NotAllowed,
}

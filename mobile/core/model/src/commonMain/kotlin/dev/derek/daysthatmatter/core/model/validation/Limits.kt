package dev.derek.daysthatmatter.core.model.validation

/** Fixed limits for every plan (BACKEND.md section 11.2). Plan limits are in `PlanTable`. */
object Limits {
    const val TITLE_MAX_CHARS: Int = 100
    const val NOTES_MAX_CHARS: Int = 4_000
    const val MEMO_MAX_CHARS: Int = 10_000

    /** Public link labels and memo milestone tags use the title rule (no limit in the docs; coordinator decision). */
    const val LABEL_MAX_CHARS: Int = TITLE_MAX_CHARS

    /** Custom audio titles and Spotify titles and artists. */
    const val AUDIO_TEXT_MAX_CHARS: Int = 200
    const val EMOJI_MAX_UTF8_BYTES: Int = 16
    const val EVENT_DOC_MAX_BYTES: Int = 16_384
    const val JSON_BODY_MAX_BYTES: Int = 65_536
    const val MEMOS_PER_EVENT: Int = 500
    const val ACTIVE_LINKS_PER_EVENT: Int = 10
    const val ACTIVE_INVITES_PER_EVENT: Int = 20
    const val MEMBERS_PER_EVENT: Int = 100
    const val INVITE_MAX_USES: Int = 100
    const val EXPIRY_MAX_YEARS: Int = 5
    const val MIN_YEAR: Int = 1900
    const val MAX_YEAR: Int = 2200
    const val CUSTOM_DAYS_MAX: Int = 3650
    const val DIM_MAX: Double = 0.8
    const val BLUR_MAX: Double = 16.0
    const val REVISIONS_KEPT: Int = 200
    const val UPLOAD_MAX_BYTES: Int = 4_194_304
    const val STILL_MAX_BYTES: Int = 1_572_864
    const val MOTION_MAX_BYTES: Int = 4_194_304
    const val AUDIO_MAX_BYTES: Int = 4_194_304
}

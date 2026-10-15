package dev.derek.daysthatmatter.core.model.contract

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/** Which validator a validation vector runs. */
enum class ValidationKind(val key: String) {
    EventNew("eventNew"),
    EventPatch("eventPatch"),
    EventDocSize("eventDocSize"),
    MemoNew("memoNew"),
    MemoPatch("memoPatch"),
    LinkNew("linkNew"),
    LinkPatch("linkPatch"),
    InviteNew("inviteNew"),
    InvitePatch("invitePatch"),
    MembershipPatch("membershipPatch"),
}

/** One validation input. Outputs are computed by `:core:model` when the contract is written. */
data class ValidationCase(val name: String, val kind: ValidationKind, val input: JsonObject)

/** One merge input: [input] holds the arguments of the operation named by [kind]. */
data class MergeCase(val name: String, val kind: String, val input: JsonObject)

/**
 * Inputs of the validation and merge vectors in `backend/core/contract/` (task 2.8). The hostile
 * input table follows the old share service tests and the limits of BACKEND.md section 11.2, at and
 * past each value. Add a case here when a rule changes; never edit the generated files.
 */
object ContractCases {
    /** The `now` every sharing case is validated at. */
    const val NOW: String = "2026-10-12T15:04:05Z"

    private fun json(text: String): JsonObject = Json.parseToJsonElement(text) as JsonObject

    private const val THEME = """{"paletteId":"violet","cardStyle":"glass","typography":"modern"}"""
    private const val MINIMAL = """{"title":"Our wedding","targetDate":"2027-06-12","theme":$THEME}"""
    private const val STILL_ID = "Pz8aaaaaaaaaaaaaaaaaaa"
    private const val MOTION_ID = "Hq3bbbbbbbbbbbbbbbbbbb"
    private const val SPOTIFY_ID = "37i9dQZF1DXcBWIGoYBM5M"

    /** The minimal new event with [fields] added or replaced. */
    private fun event(vararg fields: Pair<String, JsonElement>): JsonObject = JsonObject(json(MINIMAL) + fields)

    private fun str(value: String) = JsonPrimitive(value)

    private fun e(name: String, input: JsonObject) = ValidationCase(name, ValidationKind.EventNew, input)

    private fun p(name: String, input: String) = ValidationCase(name, ValidationKind.EventPatch, json(input))

    val validation: List<ValidationCase> = buildList {
        // New events: shape.
        add(e("event-minimal", json(MINIMAL)))
        add(
            e(
                "event-full-normalized",
                json(
                    """{"title":"  Our wedding  ","emoji":"💍","targetDate":"2027-06-12","targetTime":"16:30:00",
                    "timeZone":"Europe/Paris","unitMode":"calendar","recurrence":{"type":"yearly","originalYear":2027,"days":null},
                    "theme":{"paletteId":"violet","cardStyle":"glass","typography":"modern","gradient":["#8B5CF6","#3b82f6"],"size":"large"},
                    "backdrop":{"kind":"animated","stillId":"$STILL_ID","motionId":"$MOTION_ID","dim":0.3,"blur":8,
                      "stillUrl":"https://media.example/m/x.jpg","motionUrl":"https://media.example/m/x.mp4"},
                    "audio":{"kind":"spotify","url":"https://open.spotify.com/intl-de/playlist/$SPOTIFY_ID?si=abc","title":"Today's Top Hits","artist":"Spotify"},
                    "notes":"Book the photographer\n\tand the band","pinnedAt":"2026-10-01T10:00:00+02:00","categoryId":"anniversaries",
                    "archivedAt":null,"reminders":{"daysBefore":[7,0],"time":"08:15"}}""",
                ),
            ),
        )
        add(e("event-empty-body", json("{}")))
        add(e("event-unknown-field", event("owner" to str("x"))))
        add(e("event-server-field-rev", event("rev" to JsonPrimitive(3))))

        // Title.
        add(e("title-empty", event("title" to str(""))))
        add(e("title-blank", event("title" to str("   "))))
        add(e("title-100", event("title" to str("a".repeat(100)))))
        add(e("title-101", event("title" to str("a".repeat(101)))))
        add(e("title-100-astral", event("title" to str("😀".repeat(100)))))
        add(e("title-101-astral", event("title" to str("😀".repeat(101)))))
        add(e("title-control-char", event("title" to str("Bell\u0007"))))
        add(e("title-newline", event("title" to str("Two\nlines"))))
        add(e("title-bidi-override", event("title" to str("abc‮def"))))
        add(e("title-bidi-isolate", event("title" to str("abc⁦def"))))
        add(e("title-line-separator", event("title" to str("abc def"))))
        add(e("title-c1-control", event("title" to str("abc\u0085def"))))
        add(e("title-html-kept", event("title" to str("<script>alert(1)</script>"))))
        add(e("title-number", event("title" to JsonPrimitive(42))))
        add(e("title-null", event("title" to JsonNull)))

        // Emoji.
        add(e("emoji-ring", event("emoji" to str("💍"))))
        add(e("emoji-flag", event("emoji" to str("🇫🇷"))))
        add(e("emoji-heart-variation", event("emoji" to str("❤️"))))
        add(e("emoji-skin-tone", event("emoji" to str("👍🏽"))))
        add(e("emoji-family-zwj-too-long", event("emoji" to str("👨‍👩‍👧"))))
        add(e("emoji-two", event("emoji" to str("💍💍"))))
        add(e("emoji-letters", event("emoji" to str("ab"))))
        add(e("emoji-null", event("emoji" to JsonNull)))

        // Dates and times.
        add(e("date-1899-12-31", event("targetDate" to str("1899-12-31"))))
        add(e("date-1900-01-01", event("targetDate" to str("1900-01-01"))))
        add(e("date-2200-12-31", event("targetDate" to str("2200-12-31"))))
        add(e("date-2201-01-01", event("targetDate" to str("2201-01-01"))))
        add(e("date-feb-30", event("targetDate" to str("2026-02-30"))))
        add(e("date-feb-29-leap", event("targetDate" to str("2028-02-29"))))
        add(e("date-short-format", event("targetDate" to str("2026-2-3"))))
        add(e("date-number", event("targetDate" to JsonPrimitive(20260212))))
        add(e("time-hh-mm", event("targetTime" to str("16:30"))))
        add(e("time-24", event("targetTime" to str("24:00:00"))))
        add(e("time-last-second", event("targetTime" to str("23:59:59"))))
        add(e("time-null", event("targetTime" to JsonNull)))
        add(e("zone-paris", event("timeZone" to str("Europe/Paris"))))
        add(e("zone-utc", event("timeZone" to str("UTC"))))
        add(e("zone-unknown", event("timeZone" to str("Mars/Olympus"))))
        add(e("zone-path", event("timeZone" to str("../etc/passwd"))))
        add(e("zone-null-floating", event("timeZone" to JsonNull)))

        // Unit modes.
        for (mode in listOf("auto", "days", "weeks", "hours", "calendar", "workdays")) {
            add(e("unit-$mode", event("unitMode" to str(mode))))
        }
        add(e("unit-years", event("unitMode" to str("years"))))

        // Recurrence.
        add(e("recurrence-none", event("recurrence" to json("""{"type":"none"}"""))))
        add(e("recurrence-monthly-null-members", event("recurrence" to json("""{"type":"monthly","originalYear":null,"days":null}"""))))
        add(e("recurrence-yearly-missing-year", event("recurrence" to json("""{"type":"yearly"}"""))))
        add(e("recurrence-yearly-1899", event("recurrence" to json("""{"type":"yearly","originalYear":1899}"""))))
        add(e("recurrence-none-with-days", event("recurrence" to json("""{"type":"none","days":3}"""))))
        add(e("recurrence-custom-0", event("recurrence" to json("""{"type":"customDays","days":0}"""))))
        add(e("recurrence-custom-3650", event("recurrence" to json("""{"type":"customDays","days":3650}"""))))
        add(e("recurrence-custom-3651", event("recurrence" to json("""{"type":"customDays","days":3651}"""))))
        add(e("recurrence-custom-fraction", event("recurrence" to json("""{"type":"customDays","days":1.5}"""))))
        add(e("recurrence-daily", event("recurrence" to json("""{"type":"daily"}"""))))
        add(e("recurrence-extra-field", event("recurrence" to json("""{"type":"none","every":2}"""))))

        // Theme.
        add(e("theme-one-colour", event("theme" to json("""{"paletteId":"violet","cardStyle":"glass","typography":"modern","gradient":["#8B5CF6"]}"""))))
        add(e("theme-bad-colour", event("theme" to json("""{"paletteId":"violet","cardStyle":"glass","typography":"modern","gradient":["#GGGGGG","#000000"]}"""))))
        add(e("theme-gradient-null", event("theme" to json("""{"paletteId":"violet","cardStyle":"glass","typography":"modern","gradient":null}"""))))
        add(e("theme-size-small", event("theme" to json("""{"paletteId":"violet","cardStyle":"glass","typography":"modern","size":"small"}"""))))
        add(e("theme-size-huge", event("theme" to json("""{"paletteId":"violet","cardStyle":"glass","typography":"modern","size":"huge"}"""))))
        add(e("theme-uppercase-id", event("theme" to json("""{"paletteId":"Violet","cardStyle":"glass","typography":"modern"}"""))))
        add(e("theme-missing-typography", event("theme" to json("""{"paletteId":"violet","cardStyle":"glass"}"""))))
        add(e("theme-not-object", event("theme" to str("violet"))))

        // Backdrop.
        add(e("backdrop-still", event("backdrop" to json("""{"kind":"still","stillId":"$STILL_ID","dim":0}"""))))
        add(e("backdrop-dim-0.8", event("backdrop" to json("""{"kind":"still","stillId":"$STILL_ID","dim":0.8}"""))))
        add(e("backdrop-dim-0.81", event("backdrop" to json("""{"kind":"still","stillId":"$STILL_ID","dim":0.81}"""))))
        add(e("backdrop-dim-negative", event("backdrop" to json("""{"kind":"still","stillId":"$STILL_ID","dim":-0.1}"""))))
        add(e("backdrop-dim-string", event("backdrop" to json("""{"kind":"still","stillId":"$STILL_ID","dim":"0.3"}"""))))
        add(e("backdrop-blur-16", event("backdrop" to json("""{"kind":"still","stillId":"$STILL_ID","dim":0.2,"blur":16}"""))))
        add(e("backdrop-blur-16.5", event("backdrop" to json("""{"kind":"still","stillId":"$STILL_ID","dim":0.2,"blur":16.5}"""))))
        add(e("backdrop-animated-no-motion", event("backdrop" to json("""{"kind":"animated","stillId":"$STILL_ID","dim":0.2}"""))))
        add(e("backdrop-still-with-motion", event("backdrop" to json("""{"kind":"still","stillId":"$STILL_ID","motionId":"$MOTION_ID","dim":0.2}"""))))
        add(e("backdrop-short-id", event("backdrop" to json("""{"kind":"still","stillId":"abc","dim":0.2}"""))))
        add(e("backdrop-missing-dim", event("backdrop" to json("""{"kind":"still","stillId":"$STILL_ID"}"""))))

        // Audio.
        add(e("audio-library", event("audio" to json("""{"kind":"library","trackId":"calm-lofi"}"""))))
        add(e("audio-library-bad-id", event("audio" to json("""{"kind":"library","trackId":"Calm Lofi"}"""))))
        add(e("audio-library-extra-field", event("audio" to json("""{"kind":"library","trackId":"calm-lofi","title":"x"}"""))))
        add(e("audio-custom", event("audio" to json("""{"kind":"custom","mediaId":"$STILL_ID","title":"  First dance "}"""))))
        add(e("audio-custom-title-201", event("audio" to JsonObject(mapOf("kind" to str("custom"), "mediaId" to str(STILL_ID), "title" to str("t".repeat(201)))))))
        add(e("audio-custom-no-title", event("audio" to json("""{"kind":"custom","mediaId":"$STILL_ID"}"""))))
        add(e("audio-spotify-track", event("audio" to json("""{"kind":"spotify","url":"https://open.spotify.com/track/$SPOTIFY_ID"}"""))))
        add(e("audio-spotify-query-dropped", event("audio" to json("""{"kind":"spotify","url":"https://open.spotify.com/album/$SPOTIFY_ID?si=xyz#frag","title":"Album"}"""))))
        add(e("audio-spotify-http", event("audio" to json("""{"kind":"spotify","url":"http://open.spotify.com/track/$SPOTIFY_ID"}"""))))
        add(e("audio-spotify-episode", event("audio" to json("""{"kind":"spotify","url":"https://open.spotify.com/episode/$SPOTIFY_ID"}"""))))
        add(e("audio-spotify-other-host", event("audio" to json("""{"kind":"spotify","url":"https://open.spotify.com.evil.test/track/$SPOTIFY_ID"}"""))))
        add(e("audio-spotify-artist-201", event("audio" to JsonObject(mapOf("kind" to str("spotify"), "url" to str("https://open.spotify.com/track/$SPOTIFY_ID"), "artist" to str("a".repeat(201)))))))
        add(e("audio-unknown-kind", event("audio" to json("""{"kind":"youtube","url":"https://youtube.com/x"}"""))))
        add(e("audio-not-object", event("audio" to str("calm-lofi"))))

        // Owner-only fields.
        add(e("notes-4000", event("notes" to str("n".repeat(4000)))))
        add(e("notes-4001", event("notes" to str("n".repeat(4001)))))
        add(e("notes-empty", event("notes" to str(""))))
        add(e("notes-nul", event("notes" to str("a\u0000b"))))
        add(e("category-ok", event("categoryId" to str("birthdays_2"))))
        add(e("category-space", event("categoryId" to str("has space"))))
        add(e("category-33", event("categoryId" to str("c".repeat(33)))))
        add(e("pinned-bad-timestamp", event("pinnedAt" to str("yesterday"))))
        add(e("archived-offset-normalized", event("archivedAt" to str("2026-10-12T17:04:05+02:00"))))
        add(e("reminders-all", event("reminders" to json("""{"daysBefore":[0,1,7],"time":"21:30"}"""))))
        add(e("reminders-default-time", event("reminders" to json("""{"daysBefore":[1]}"""))))
        add(e("reminders-empty", event("reminders" to json("""{"daysBefore":[]}"""))))
        add(e("reminders-2", event("reminders" to json("""{"daysBefore":[2]}"""))))
        add(e("reminders-duplicate", event("reminders" to json("""{"daysBefore":[1,1]}"""))))
        add(e("reminders-short-time", event("reminders" to json("""{"daysBefore":[1],"time":"9:00"}"""))))
        add(e("reminders-null", event("reminders" to JsonNull)))

        // Patches.
        add(p("patch-empty", "{}"))
        add(p("patch-title", """{"title":" New title "}"""))
        add(p("patch-clear-title", """{"title":null}"""))
        add(p("patch-clear-theme", """{"theme":null}"""))
        add(p("patch-clear-unit-mode", """{"unitMode":null}"""))
        add(p("patch-clear-recurrence", """{"recurrence":null}"""))
        add(p("patch-clear-optional", """{"emoji":null,"targetTime":null,"timeZone":null,"backdrop":null,"audio":null,"notes":null,"pinnedAt":null,"categoryId":null,"archivedAt":null,"reminders":null}"""))
        add(p("patch-unknown-field", """{"title":"x","id":"other"}"""))
        add(p("patch-two-errors", """{"title":"","unitMode":"years"}"""))
        add(p("patch-archive", """{"archivedAt":"2026-10-12T15:04:05Z"}"""))

        // Stored document size (after a merge).
        add(ValidationCase("doc-size-small", ValidationKind.EventDocSize, json(MINIMAL)))
        add(ValidationCase("doc-size-over-16k", ValidationKind.EventDocSize, event("notes" to str("😀".repeat(4000)), "title" to str("😀".repeat(100)))))

        // Memos.
        val memo = """{"content":"Booked the venue today.","milestoneTag":"Day 100","createdAt":"2026-10-12T15:04:05Z"}"""
        add(ValidationCase("memo-valid", ValidationKind.MemoNew, json(memo)))
        add(ValidationCase("memo-multiline", ValidationKind.MemoNew, json("""{"content":"Line one\n\tLine two","createdAt":"2026-10-12T17:04:05+02:00"}""")))
        add(ValidationCase("memo-empty", ValidationKind.MemoNew, json("""{"content":"","createdAt":"2026-10-12T15:04:05Z"}""")))
        add(ValidationCase("memo-blank", ValidationKind.MemoNew, json("""{"content":" \n ","createdAt":"2026-10-12T15:04:05Z"}""")))
        add(ValidationCase("memo-10000", ValidationKind.MemoNew, JsonObject(mapOf("content" to str("m".repeat(10_000)), "createdAt" to str(NOW)))))
        add(ValidationCase("memo-10001", ValidationKind.MemoNew, JsonObject(mapOf("content" to str("m".repeat(10_001)), "createdAt" to str(NOW)))))
        add(ValidationCase("memo-control-char", ValidationKind.MemoNew, json("""{"content":"a\u0007b","createdAt":"2026-10-12T15:04:05Z"}""")))
        add(ValidationCase("memo-tag-101", ValidationKind.MemoNew, JsonObject(mapOf("content" to str("x"), "milestoneTag" to str("t".repeat(101)), "createdAt" to str(NOW)))))
        add(ValidationCase("memo-no-created-at", ValidationKind.MemoNew, json("""{"content":"x"}""")))
        add(ValidationCase("memo-unknown-field", ValidationKind.MemoNew, json("""{"content":"x","createdAt":"2026-10-12T15:04:05Z","eventId":"e"}""")))
        add(ValidationCase("memo-patch-clear-tag", ValidationKind.MemoPatch, json("""{"milestoneTag":null}""")))
        add(ValidationCase("memo-patch-clear-content", ValidationKind.MemoPatch, json("""{"content":null}""")))
        add(ValidationCase("memo-patch-clear-created-at", ValidationKind.MemoPatch, json("""{"createdAt":null}""")))
        add(ValidationCase("memo-patch-content", ValidationKind.MemoPatch, json("""{"content":"Edited"}""")))

        // Public links (validated at NOW).
        add(ValidationCase("link-defaults", ValidationKind.LinkNew, json("{}")))
        add(ValidationCase("link-label", ValidationKind.LinkNew, json("""{"label":" Instagram ","expiresAt":null}""")))
        add(ValidationCase("link-label-empty", ValidationKind.LinkNew, json("""{"label":""}""")))
        add(ValidationCase("link-label-null", ValidationKind.LinkNew, json("""{"label":null}""")))
        add(ValidationCase("link-expiry-past", ValidationKind.LinkNew, json("""{"expiresAt":"2026-10-12T15:04:04Z"}""")))
        add(ValidationCase("link-expiry-now", ValidationKind.LinkNew, json("""{"expiresAt":"$NOW"}""")))
        add(ValidationCase("link-expiry-5-years", ValidationKind.LinkNew, json("""{"expiresAt":"2031-10-12T15:04:05Z"}""")))
        add(ValidationCase("link-expiry-5-years-1s", ValidationKind.LinkNew, json("""{"expiresAt":"2031-10-12T15:04:06Z"}""")))
        add(ValidationCase("link-unknown-field", ValidationKind.LinkNew, json("""{"label":"x","role":"editor"}""")))
        add(ValidationCase("link-patch-never", ValidationKind.LinkPatch, json("""{"expiresAt":null}""")))
        add(ValidationCase("link-patch-empty", ValidationKind.LinkPatch, json("{}")))

        // Invites (validated at NOW).
        add(ValidationCase("invite-defaults", ValidationKind.InviteNew, json("""{"role":"editor"}""")))
        add(ValidationCase("invite-no-role", ValidationKind.InviteNew, json("{}")))
        add(ValidationCase("invite-owner-role", ValidationKind.InviteNew, json("""{"role":"owner"}""")))
        add(ValidationCase("invite-uses-0", ValidationKind.InviteNew, json("""{"role":"viewer","maxUses":0}""")))
        add(ValidationCase("invite-uses-1", ValidationKind.InviteNew, json("""{"role":"viewer","maxUses":1}""")))
        add(ValidationCase("invite-uses-100", ValidationKind.InviteNew, json("""{"role":"viewer","maxUses":100}""")))
        add(ValidationCase("invite-uses-101", ValidationKind.InviteNew, json("""{"role":"viewer","maxUses":101}""")))
        add(ValidationCase("invite-uses-unlimited", ValidationKind.InviteNew, json("""{"role":"viewer","maxUses":null,"expiresAt":null}""")))
        add(ValidationCase("invite-uses-fraction", ValidationKind.InviteNew, json("""{"role":"viewer","maxUses":1.5}""")))
        add(ValidationCase("invite-uses-string", ValidationKind.InviteNew, json("""{"role":"viewer","maxUses":"5"}""")))
        add(ValidationCase("invite-patch-role", ValidationKind.InvitePatch, json("""{"role":"viewer"}""")))
        add(ValidationCase("invite-patch-expiry-past", ValidationKind.InvitePatch, json("""{"expiresAt":"2020-01-01T00:00:00Z"}""")))

        // Membership.
        add(ValidationCase("membership-archive", ValidationKind.MembershipPatch, json("""{"archived":true,"reminders":{"daysBefore":[1]}}""")))
        add(ValidationCase("membership-unarchive", ValidationKind.MembershipPatch, json("""{"archived":false,"reminders":null}""")))
        add(ValidationCase("membership-archived-string", ValidationKind.MembershipPatch, json("""{"archived":"yes"}""")))
        add(ValidationCase("membership-unknown-field", ValidationKind.MembershipPatch, json("""{"role":"editor"}""")))
    }

    private fun m(name: String, kind: String, input: String) = MergeCase(name, kind, json(input))

    private const val DOC = """{"title":"Our wedding","targetDate":"2027-06-12","unitMode":"auto",
        "theme":{"paletteId":"violet","cardStyle":"glass","typography":"modern"},
        "backdrop":{"kind":"still","stillId":"$STILL_ID","dim":0.3},"pinnedAt":"2026-10-01T08:00:00Z","notes":"n"}"""

    val merge: List<MergeCase> = listOf(
        m("apply-one-field", "apply", """{"doc":$DOC,"patch":{"title":"Our wedding day"}}"""),
        m("apply-same-value-skipped", "apply", """{"doc":$DOC,"patch":{"title":"Our wedding","unitMode":"days"}}"""),
        m("apply-null-clears", "apply", """{"doc":$DOC,"patch":{"backdrop":null}}"""),
        m("apply-null-on-absent-skipped", "apply", """{"doc":$DOC,"patch":{"emoji":null}}"""),
        m("apply-new-field", "apply", """{"doc":$DOC,"patch":{"emoji":"💍"}}"""),
        m("apply-nested-replaced-whole", "apply", """{"doc":$DOC,"patch":{"theme":{"paletteId":"blue","cardStyle":"solid","typography":"modern"}}}"""),
        m("apply-nested-equal-skipped", "apply", """{"doc":$DOC,"patch":{"theme":{"paletteId":"violet","cardStyle":"glass","typography":"modern"}}}"""),
        m("apply-empty-patch", "apply", """{"doc":$DOC,"patch":{}}"""),
        m("apply-many-fields", "apply", """{"doc":$DOC,"patch":{"title":"T","notes":null,"targetTime":"09:00:00","backdrop":{"kind":"still","stillId":"$MOTION_ID","dim":0}}}"""),
        m("event-archive-clears-pin", "applyToEvent", """{"doc":$DOC,"patch":{"archivedAt":"2026-10-12T15:04:05Z"}}"""),
        m("event-unarchive-keeps-pin-cleared", "applyToEvent", """{"doc":{"title":"T","targetDate":"2027-06-12","theme":$THEME,"archivedAt":"2026-10-12T15:04:05Z"},"patch":{"archivedAt":null}}"""),
        m("event-archive-without-pin", "applyToEvent", """{"doc":{"title":"T","targetDate":"2027-06-12","theme":$THEME},"patch":{"archivedAt":"2026-10-12T15:04:05Z","title":"U"}}"""),
        m("event-plain-patch", "applyToEvent", """{"doc":$DOC,"patch":{"title":"X"}}"""),
        m(
            "overwritten-other-author",
            "overwritten",
            """{"changedFields":["title","targetTime"],"baseRev":9,"writerId":"a",
            "revisions":[{"rev":10,"authorId":"b","fields":["targetTime"]},{"rev":11,"authorId":"a","fields":["title"]}]}""",
        ),
        m(
            "overwritten-own-changes-ignored",
            "overwritten",
            """{"changedFields":["title"],"baseRev":9,"writerId":"a","revisions":[{"rev":10,"authorId":"a","fields":["title"]}]}""",
        ),
        m(
            "overwritten-deleted-author-counts",
            "overwritten",
            """{"changedFields":["title","emoji"],"baseRev":3,"writerId":"a","revisions":[{"rev":4,"authorId":null,"fields":["emoji"]}]}""",
        ),
        m(
            "overwritten-at-or-before-base-ignored",
            "overwritten",
            """{"changedFields":["title"],"baseRev":10,"writerId":"a","revisions":[{"rev":9,"authorId":"b","fields":["title"]},{"rev":10,"authorId":"b","fields":["title"]}]}""",
        ),
        m(
            "overwritten-sorted",
            "overwritten",
            """{"changedFields":["title","emoji","audio"],"baseRev":1,"writerId":"a",
            "revisions":[{"rev":2,"authorId":"b","fields":["title","audio"]},{"rev":3,"authorId":"c","fields":["emoji"]}]}""",
        ),
        m(
            "revert-two-revisions",
            "revertTo",
            """{"current":{"title":"C","targetDate":"2027-06-12","theme":$THEME,"emoji":"💍"},"targetRev":1,
            "later":[{"rev":2,"inverse":{"title":"A"}},{"rev":3,"inverse":{"title":"B","emoji":null}}]}""",
        ),
        m(
            "revert-ignores-older",
            "revertTo",
            """{"current":{"title":"C","targetDate":"2027-06-12","theme":$THEME},"targetRev":2,
            "later":[{"rev":2,"inverse":{"title":"A"}},{"rev":3,"inverse":{"title":"B"}}]}""",
        ),
        m(
            "revert-order-independent",
            "revertTo",
            """{"current":{"title":"C","targetDate":"2027-06-12","theme":$THEME},"targetRev":0,
            "later":[{"rev":3,"inverse":{"title":"B"}},{"rev":1,"inverse":{"notes":null}},{"rev":2,"inverse":{"title":"A","notes":"old"}}]}""",
        ),
    )
}

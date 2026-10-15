package dev.derek.daysthatmatter.core.model.validation

import dev.derek.daysthatmatter.core.model.event.MemoFields
import kotlinx.datetime.DateTimeUnit
import kotlinx.datetime.TimeZone
import kotlinx.datetime.plus
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlin.time.Duration.Companion.days
import kotlin.time.Instant

/** Validation of memo documents and memo patches (BACKEND.md sections 7.2 and 11.2). */
object MemoValidation {
    /** Validates a new memo: `content` (1 to 10,000 characters) and `createdAt` required, `milestoneTag` optional. */
    fun validateNew(doc: JsonObject): Validated<JsonObject> {
        val checks = JsonChecks()
        val out = check(checks, doc)
        for (name in MemoFields.REQUIRED) {
            if (doc[name] == null) checks.fail(name, "required")
        }
        return checks.result(out)
    }

    /** Validates a memo patch; only `milestoneTag` can be cleared. */
    fun validatePatch(patch: JsonObject): Validated<JsonObject> {
        val checks = JsonChecks()
        return checks.result(check(checks, patch))
    }

    /** True when an event with [existing] memos can take one more. */
    fun canAdd(existing: Int): Boolean = existing < Limits.MEMOS_PER_EVENT

    private fun check(checks: JsonChecks, fields: JsonObject): JsonObject {
        if (!MemoFields.WRITABLE.containsAll(fields.keys)) checks.fail("", "unknown field")
        val out = LinkedHashMap<String, JsonElement>()
        for ((name, value) in fields) {
            if (name !in MemoFields.WRITABLE) continue
            if (value is JsonNull) {
                if (name == MemoFields.MILESTONE_TAG) out[name] = JsonNull else checks.fail(name, "cannot be cleared")
                continue
            }
            val checked = when (name) {
                MemoFields.CONTENT -> checks.text(name, value, Limits.MEMO_MAX_CHARS, requireContent = true)
                MemoFields.MILESTONE_TAG -> checks.line(name, value, 1, Limits.LABEL_MAX_CHARS)
                else -> checks.instant(name, value)?.let { JsonPrimitive(it.toString()) }
            }
            if (checked != null) out[name] = checked
        }
        return JsonObject(out)
    }
}

/** Expiry choices for public links and invites (`event-sharing` spec, design D11). */
enum class ExpiryPreset {
    FiveDays,
    ThirtyDays,
    Never,
    ;

    /** The `expiresAt` to send for this choice, created at [now]; null = never. */
    fun expiresAt(now: Instant): Instant? = when (this) {
        FiveDays -> now + 5.days
        ThirtyDays -> now + 30.days
        Never -> null
    }
}

/** Use count choices for invites; [maxUses] null = unlimited. A custom count is 1 to 100. */
enum class UseCountPreset(val maxUses: Int?) {
    One(1),
    Five(5),
    Ten(10),
    Unlimited(null),
}

/**
 * Validation of public link and invite settings (BACKEND.md sections 7.3 and 11.2).
 *
 * Expiry: `null` = never, otherwise a time after now and at most 5 years ahead. Defaults when a
 * create request leaves a setting out: public links never expire; invites expire after 30 days and
 * have 1 use.
 */
object SharingValidation {
    val DEFAULT_LINK_EXPIRY: ExpiryPreset = ExpiryPreset.Never
    val DEFAULT_INVITE_EXPIRY: ExpiryPreset = ExpiryPreset.ThirtyDays
    val DEFAULT_INVITE_USES: UseCountPreset = UseCountPreset.One

    private val ROLES = setOf("viewer", "editor")

    /** The latest expiry allowed for something created or changed at [now]. */
    fun maxExpiry(now: Instant): Instant = now.plus(Limits.EXPIRY_MAX_YEARS, DateTimeUnit.YEAR, TimeZone.UTC)

    /** True when [expiresAt] (null = never) is a valid choice at [now]. */
    fun isValidExpiry(expiresAt: Instant?, now: Instant): Boolean =
        expiresAt == null || (expiresAt > now && expiresAt <= maxExpiry(now))

    /** True when [maxUses] (null = unlimited) is a valid use count. */
    fun isValidMaxUses(maxUses: Int?): Boolean = maxUses == null || maxUses in 1..Limits.INVITE_MAX_USES

    /** `POST /events/{id}/links` `{label, expiresAt}`; fills the default expiry. */
    fun validateNewLink(body: JsonObject, now: Instant): Validated<JsonObject> {
        val checks = JsonChecks()
        val out = linkFields(checks, body, now)
        if ("expiresAt" !in out) out["expiresAt"] = expiryJson(DEFAULT_LINK_EXPIRY.expiresAt(now))
        return checks.result(JsonObject(out))
    }

    /** `PATCH /links/{linkId}`: label or expiry. */
    fun validateLinkPatch(body: JsonObject, now: Instant): Validated<JsonObject> {
        val checks = JsonChecks()
        return checks.result(JsonObject(linkFields(checks, body, now)))
    }

    /** `POST /events/{id}/invites` `{role, maxUses, expiresAt}`; fills the default use count and expiry. */
    fun validateNewInvite(body: JsonObject, now: Instant): Validated<JsonObject> {
        val checks = JsonChecks()
        val out = inviteFields(checks, body, now)
        if (body["role"] == null) checks.fail("role", "required")
        if ("maxUses" !in out) out["maxUses"] = JsonPrimitive(DEFAULT_INVITE_USES.maxUses)
        if ("expiresAt" !in out) out["expiresAt"] = expiryJson(DEFAULT_INVITE_EXPIRY.expiresAt(now))
        return checks.result(JsonObject(out))
    }

    /** `PATCH /invites/{inviteId}`: expiry, use count or role. */
    fun validateInvitePatch(body: JsonObject, now: Instant): Validated<JsonObject> {
        val checks = JsonChecks()
        return checks.result(JsonObject(inviteFields(checks, body, now)))
    }

    private fun linkFields(checks: JsonChecks, body: JsonObject, now: Instant): LinkedHashMap<String, JsonElement> {
        val out = LinkedHashMap<String, JsonElement>()
        checks.obj("", body, setOf("label", "expiresAt")) ?: return out
        body["label"]?.let { v ->
            if (v is JsonNull) out["label"] = JsonNull else checks.line("label", v, 1, Limits.LABEL_MAX_CHARS)?.let { out["label"] = it }
        }
        body["expiresAt"]?.let { v -> expiry(checks, v, now)?.let { out["expiresAt"] = it } }
        return out
    }

    private fun inviteFields(checks: JsonChecks, body: JsonObject, now: Instant): LinkedHashMap<String, JsonElement> {
        val out = LinkedHashMap<String, JsonElement>()
        checks.obj("", body, setOf("role", "maxUses", "expiresAt")) ?: return out
        body["role"]?.let { v -> checks.choice("role", v, ROLES)?.let { out["role"] = it } }
        body["maxUses"]?.let { v ->
            if (v is JsonNull) {
                out["maxUses"] = JsonNull
            } else {
                checks.int("maxUses", v, 1, Limits.INVITE_MAX_USES)?.let { out["maxUses"] = JsonPrimitive(it) }
            }
        }
        body["expiresAt"]?.let { v -> expiry(checks, v, now)?.let { out["expiresAt"] = it } }
        return out
    }

    private fun expiry(checks: JsonChecks, value: JsonElement, now: Instant): JsonElement? {
        if (value is JsonNull) return JsonNull
        val at = checks.instant("expiresAt", value) ?: return null
        if (!isValidExpiry(at, now)) return checks.fail("expiresAt", "must be after now and at most 5 years ahead")
        return JsonPrimitive(at.toString())
    }

    private fun expiryJson(at: Instant?): JsonElement = at?.let { JsonPrimitive(it.toString()) } ?: JsonNull
}

/** Validation of `PATCH /events/{id}/membership` `{archived, reminders}`: a member's own settings. */
object MembershipValidation {
    fun validatePatch(body: JsonObject): Validated<JsonObject> {
        val checks = JsonChecks()
        val out = LinkedHashMap<String, JsonElement>()
        if (checks.obj("", body, setOf("archived", "reminders")) != null) {
            body["archived"]?.let { v -> checks.boolean("archived", v)?.let { out["archived"] = JsonPrimitive(it) } }
            body["reminders"]?.let { v -> checks.reminders("reminders", v)?.let { out["reminders"] = it } }
        }
        return checks.result(JsonObject(out))
    }
}

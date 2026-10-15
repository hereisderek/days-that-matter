package dev.derek.daysthatmatter.core.model.api

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

/** Error codes of the API with their HTTP status (BACKEND.md section 7.5). */
@Serializable
enum class ApiErrorCode(val httpStatus: Int) {
    @SerialName("invalid_payload") InvalidPayload(400),
    @SerialName("invalid_code") InvalidCode(400),
    @SerialName("unauthorized") Unauthorized(401),
    @SerialName("premium_required") PremiumRequired(402),
    @SerialName("forbidden") Forbidden(403),
    @SerialName("field_not_allowed") FieldNotAllowed(403),
    @SerialName("not_found") NotFound(404),
    @SerialName("conflict") Conflict(409),
    @SerialName("revoked") Revoked(410),
    @SerialName("expired") Expired(410),
    @SerialName("deleted") Deleted(410),
    @SerialName("invite_full") InviteFull(410),
    @SerialName("invite_expired") InviteExpired(410),
    @SerialName("invite_revoked") InviteRevoked(410),
    @SerialName("payload_too_large") PayloadTooLarge(413),
    @SerialName("unsupported_media_type") UnsupportedMediaType(415),
    @SerialName("rate_limited") RateLimited(429),
    @SerialName("quota_exceeded") QuotaExceeded(429),
    @SerialName("internal_error") InternalError(500),
    @SerialName("service_unavailable") ServiceUnavailable(503),
}

/** Error body: `{"error": {"code": "invalid_payload", "message": "title: too long", "details": {"field": "title"}}}`. */
@Serializable
data class ApiErrorResponse(val error: ApiErrorBody)

@Serializable
data class ApiErrorBody(
    val code: ApiErrorCode,
    val message: String,
    val details: JsonObject? = null,
)

package dev.derek.daysthatmatter.core.model.validation

import dev.derek.daysthatmatter.core.model.api.ApiErrorBody
import dev.derek.daysthatmatter.core.model.api.ApiErrorCode
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject

/**
 * One validation failure. [field] is the path of the value (`title`, `theme.gradient`), or an empty
 * string for the body itself. [reason] is a fixed text: messages never echo user keys or values.
 */
data class FieldError(val field: String, val reason: String) {
    val message: String
        get() = (if (this.field.isEmpty()) "(body)" else this.field) + ": " + reason
}

/** Result of validating and normalizing a value. */
sealed interface Validated<out T> {
    data class Valid<T>(val value: T) : Validated<T>

    data class Invalid(val errors: List<FieldError>) : Validated<Nothing> {
        init {
            require(errors.isNotEmpty()) { "Invalid needs at least one error" }
        }

        /** The `400 invalid_payload` body, naming the first failing field. */
        fun toApiError(): ApiErrorBody = ApiErrorBody(
            code = ApiErrorCode.InvalidPayload,
            message = errors.first().message,
            details = buildJsonObject { put("field", JsonPrimitive(errors.first().field)) },
        )
    }

    fun valueOrNull(): T? = (this as? Valid<T>)?.value
}

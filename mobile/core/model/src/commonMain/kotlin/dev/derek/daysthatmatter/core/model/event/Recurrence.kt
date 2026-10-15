package dev.derek.daysthatmatter.core.model.event

import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder

/**
 * How a day repeats (docs/features/events/SPEC.md section 2.3).
 *
 * The API form is one flat object, `{"type": "yearly", "originalYear": 2027, "days": null}`, so this
 * sealed type uses [RecurrenceSerializer].
 */
@Serializable(with = RecurrenceSerializer::class)
sealed interface Recurrence {
    /** One date only. */
    data object None : Recurrence

    /** Every year on the target's month and day; Feb 29 falls on Feb 28 in other years. */
    data class Yearly(val originalYear: Int) : Recurrence

    /** Every month on the target's day of month, clamped to the month's last day. */
    data object Monthly : Recurrence

    /** Every 7 days from the target date. */
    data object Weekly : Recurrence

    /** Every [days] days from the target date. */
    data class CustomDays(val days: Int) : Recurrence
}

/** API values of `recurrence.type`. */
@Serializable
enum class RecurrenceType {
    @SerialName("none") None,
    @SerialName("yearly") Yearly,
    @SerialName("monthly") Monthly,
    @SerialName("weekly") Weekly,
    @SerialName("customDays") CustomDays,
}

@Serializable
private data class RecurrenceSurrogate(
    val type: RecurrenceType,
    val originalYear: Int? = null,
    val days: Int? = null,
)

/** Reads and writes the flat API object. A combination the API does not allow fails to decode. */
object RecurrenceSerializer : KSerializer<Recurrence> {
    override val descriptor: SerialDescriptor = RecurrenceSurrogate.serializer().descriptor

    override fun serialize(encoder: Encoder, value: Recurrence) {
        val surrogate = when (value) {
            Recurrence.None -> RecurrenceSurrogate(RecurrenceType.None)
            is Recurrence.Yearly -> RecurrenceSurrogate(RecurrenceType.Yearly, originalYear = value.originalYear)
            Recurrence.Monthly -> RecurrenceSurrogate(RecurrenceType.Monthly)
            Recurrence.Weekly -> RecurrenceSurrogate(RecurrenceType.Weekly)
            is Recurrence.CustomDays -> RecurrenceSurrogate(RecurrenceType.CustomDays, days = value.days)
        }
        encoder.encodeSerializableValue(RecurrenceSurrogate.serializer(), surrogate)
    }

    override fun deserialize(decoder: Decoder): Recurrence {
        val s = decoder.decodeSerializableValue(RecurrenceSurrogate.serializer())
        val yearOk = (s.type == RecurrenceType.Yearly) == (s.originalYear != null)
        val daysOk = (s.type == RecurrenceType.CustomDays) == (s.days != null)
        if (!yearOk || !daysOk) throw SerializationException("recurrence fields do not match its type")
        return when (s.type) {
            RecurrenceType.None -> Recurrence.None
            RecurrenceType.Yearly -> Recurrence.Yearly(s.originalYear!!)
            RecurrenceType.Monthly -> Recurrence.Monthly
            RecurrenceType.Weekly -> Recurrence.Weekly
            RecurrenceType.CustomDays -> Recurrence.CustomDays(s.days!!)
        }
    }
}

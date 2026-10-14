package dev.derek.daysthatmatter.core.model.event

import kotlinx.datetime.LocalTime
import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerializationException
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder

/** `HH:MM:SS`, the API form of `targetTime`. kotlinx-datetime would drop zero seconds. */
object HmsTimeSerializer : KSerializer<LocalTime> {
    private val pattern = Regex("^([01]\\d|2[0-3]):([0-5]\\d):([0-5]\\d)$")

    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("dev.derek.daysthatmatter.HmsTime", PrimitiveKind.STRING)

    override fun serialize(encoder: Encoder, value: LocalTime) {
        encoder.encodeString(format(value))
    }

    override fun deserialize(decoder: Decoder): LocalTime =
        parse(decoder.decodeString()) ?: throw SerializationException("time must be HH:MM:SS")

    fun format(value: LocalTime): String = "${two(value.hour)}:${two(value.minute)}:${two(value.second)}"

    fun parse(text: String): LocalTime? {
        val m = pattern.matchEntire(text) ?: return null
        return LocalTime(m.groupValues[1].toInt(), m.groupValues[2].toInt(), m.groupValues[3].toInt())
    }
}

/** `HH:MM`, the API form of `reminders.time`. */
object HmTimeSerializer : KSerializer<LocalTime> {
    private val pattern = Regex("^([01]\\d|2[0-3]):([0-5]\\d)$")

    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("dev.derek.daysthatmatter.HmTime", PrimitiveKind.STRING)

    override fun serialize(encoder: Encoder, value: LocalTime) {
        encoder.encodeString(format(value))
    }

    override fun deserialize(decoder: Decoder): LocalTime =
        parse(decoder.decodeString()) ?: throw SerializationException("time must be HH:MM")

    fun format(value: LocalTime): String = "${two(value.hour)}:${two(value.minute)}"

    fun parse(text: String): LocalTime? {
        val m = pattern.matchEntire(text) ?: return null
        return LocalTime(m.groupValues[1].toInt(), m.groupValues[2].toInt())
    }
}

private fun two(n: Int): String = n.toString().padStart(2, '0')

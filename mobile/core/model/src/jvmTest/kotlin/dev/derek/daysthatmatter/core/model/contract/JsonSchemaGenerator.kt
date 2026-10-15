package dev.derek.daysthatmatter.core.model.contract

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.descriptors.PolymorphicKind
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.descriptors.SerialKind
import kotlinx.serialization.descriptors.StructureKind
import kotlinx.serialization.descriptors.elementDescriptors
import kotlinx.serialization.descriptors.nonNullOriginal
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonClassDiscriminator
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.util.TreeMap

/**
 * Builds a JSON Schema (draft 2020-12) document from kotlinx-serialization descriptors.
 *
 * Classes, enums and sealed types become named entries in `$defs` and are referenced by `$ref`.
 * A property is required when it has no default value. Nullable values are `anyOf [T, null]`. Sealed
 * types are `oneOf` their subclasses, each with a `const` discriminator. The schema is structural:
 * value rules (lengths, ranges, patterns of free text) are in the validation vectors.
 *
 * Every custom string serializer must be mapped in [stringSchema]; an unknown one fails the build, so a
 * new type is never exported with a wrong shape.
 */
@OptIn(ExperimentalSerializationApi::class)
class JsonSchemaGenerator {
    private val defs = TreeMap<String, JsonObject>()
    private val namesBySerialName = HashMap<String, String>()

    /** Adds [descriptor] and every type it uses to `$defs`. */
    fun add(descriptor: SerialDescriptor) {
        schemaOf(descriptor)
    }

    /** The schema document with every added type, `$defs` sorted by name. */
    fun document(id: String): JsonObject = buildJsonObject {
        put("\$schema", "https://json-schema.org/draft/2020-12/schema")
        put("\$id", id)
        put("\$defs", JsonObject(defs))
    }

    private fun schemaOf(descriptor: SerialDescriptor): JsonObject {
        if (descriptor.isNullable) {
            val inner = schemaOf(descriptor.nonNullOriginal)
            return buildJsonObject { put("anyOf", JsonArray(listOf(inner, NULL))) }
        }
        return when (val kind = descriptor.kind) {
            is PrimitiveKind -> primitive(descriptor, kind)
            SerialKind.ENUM -> named(descriptor) {
                buildJsonObject {
                    put("type", "string")
                    put("enum", JsonArray((0 until descriptor.elementsCount).map { JsonPrimitive(descriptor.getElementName(it)) }))
                }
            }
            StructureKind.CLASS -> named(descriptor) { classSchema(descriptor, discriminator = null) }
            StructureKind.OBJECT -> buildJsonObject { put("type", "object") }
            StructureKind.LIST -> buildJsonObject {
                put("type", "array")
                put("items", schemaOf(descriptor.getElementDescriptor(0)))
            }
            StructureKind.MAP ->
                if (descriptor.serialName == JSON_OBJECT) {
                    buildJsonObject { put("type", "object") }
                } else {
                    buildJsonObject {
                        put("type", "object")
                        put("additionalProperties", schemaOf(descriptor.getElementDescriptor(1)))
                    }
                }
            PolymorphicKind.SEALED ->
                if (descriptor.serialName == JSON_ELEMENT) JsonObject(emptyMap()) else sealed(descriptor)
            else -> error("No JSON Schema mapping for ${descriptor.serialName} ($kind)")
        }
    }

    private fun primitive(descriptor: SerialDescriptor, kind: PrimitiveKind): JsonObject = when (kind) {
        PrimitiveKind.STRING, PrimitiveKind.CHAR -> stringSchema(descriptor.serialName)
        PrimitiveKind.INT, PrimitiveKind.LONG, PrimitiveKind.SHORT, PrimitiveKind.BYTE -> type("integer")
        PrimitiveKind.FLOAT, PrimitiveKind.DOUBLE -> type("number")
        PrimitiveKind.BOOLEAN -> type("boolean")
    }

    private fun stringSchema(serialName: String): JsonObject = when (serialName) {
        "kotlin.String", "kotlin.Char" -> type("string")
        "kotlinx.datetime.LocalDate" -> buildJsonObject {
            put("type", "string")
            put("format", "date")
        }
        "kotlin.time.Instant", "kotlinx.datetime.Instant" -> buildJsonObject {
            put("type", "string")
            put("format", "date-time")
        }
        "dev.derek.daysthatmatter.HmsTime" -> buildJsonObject {
            put("type", "string")
            put("pattern", "^([01]\\d|2[0-3]):([0-5]\\d):([0-5]\\d)$")
        }
        "dev.derek.daysthatmatter.HmTime" -> buildJsonObject {
            put("type", "string")
            put("pattern", "^([01]\\d|2[0-3]):([0-5]\\d)$")
        }
        else -> error("No JSON Schema mapping for the string type $serialName: add it to JsonSchemaGenerator")
    }

    private fun classSchema(descriptor: SerialDescriptor, discriminator: Pair<String, String>?): JsonObject {
        val properties = LinkedHashMap<String, JsonElement>()
        val required = mutableListOf<String>()
        if (discriminator != null) {
            properties[discriminator.first] = buildJsonObject { put("const", discriminator.second) }
            required += discriminator.first
        }
        for (i in 0 until descriptor.elementsCount) {
            val name = descriptor.getElementName(i)
            properties[name] = schemaOf(descriptor.getElementDescriptor(i))
            if (!descriptor.isElementOptional(i)) required += name
        }
        return buildJsonObject {
            put("type", "object")
            put("properties", JsonObject(properties))
            if (required.isNotEmpty()) put("required", JsonArray(required.map(::JsonPrimitive)))
        }
    }

    private fun sealed(descriptor: SerialDescriptor): JsonObject = named(descriptor) {
        val parent = defName(descriptor.serialName)
        val key = descriptor.annotations.filterIsInstance<JsonClassDiscriminator>().firstOrNull()?.discriminator ?: "type"
        val subclasses = descriptor.getElementDescriptor(1).elementDescriptors.map { sub ->
            val name = parent + sub.serialName.substringAfterLast('.').replaceFirstChar { it.uppercase() }
            putDef(sub.serialName, name) { classSchema(sub, key to sub.serialName) }
        }
        buildJsonObject { put("oneOf", JsonArray(subclasses)) }
    }

    private fun named(descriptor: SerialDescriptor, build: () -> JsonObject): JsonObject =
        putDef(descriptor.serialName, defName(descriptor.serialName), build)

    private fun putDef(serialName: String, name: String, build: () -> JsonObject): JsonObject {
        val ref = buildJsonObject { put("\$ref", "#/\$defs/$name") }
        val known = namesBySerialName[serialName]
        if (known != null) return ref
        check(name !in namesBySerialName.values) { "Two types map to the schema name $name" }
        namesBySerialName[serialName] = name
        defs[name] = build()
        return ref
    }

    private fun defName(serialName: String): String =
        RENAMES[serialName] ?: serialName.substringAfterLast('.')

    private companion object {
        const val JSON_OBJECT = "kotlinx.serialization.json.JsonObject"
        const val JSON_ELEMENT = "kotlinx.serialization.json.JsonElement"
        val NULL: JsonObject = type("null")

        /** Serial names whose schema name is not their simple name. */
        val RENAMES: Map<String, String> = mapOf(
            "dev.derek.daysthatmatter.core.model.event.RecurrenceSurrogate" to "Recurrence",
        )

        fun type(name: String): JsonObject = buildJsonObject { put("type", name) }
    }
}

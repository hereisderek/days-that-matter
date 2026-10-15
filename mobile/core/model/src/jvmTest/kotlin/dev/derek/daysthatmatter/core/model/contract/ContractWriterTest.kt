package dev.derek.daysthatmatter.core.model.contract

import dev.derek.daysthatmatter.core.model.api.ApiErrorCode
import dev.derek.daysthatmatter.core.model.event.EventDoc
import dev.derek.daysthatmatter.core.model.plan.Feature
import dev.derek.daysthatmatter.core.model.plan.PlanTable
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.serializer
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

@Serializable
private data class WithChar(val c: Char)

class ContractWriterTest {
    private val schema = apiSchema()
    private val defs = schema.getValue("\$defs").jsonObject

    private fun def(name: String) = defs.getValue(name).jsonObject

    private fun props(name: String) = def(name).getValue("properties").jsonObject

    private fun required(name: String) = def(name)["required"]?.jsonArray?.map { it.jsonPrimitive.content }.orEmpty()

    @Test
    fun eventDocRequiresOnlyFieldsWithoutDefaults() {
        assertEquals(listOf("id", "title", "targetDate", "theme"), required("EventDoc"))
        assertEquals(
            JsonObject(mapOf("\$ref" to JsonPrimitive("#/\$defs/UnitMode"))),
            props("EventDoc").getValue("unitMode"),
        )
    }

    @Test
    fun nullableFieldsAllowNull() {
        val emoji = props("EventDoc").getValue("emoji").jsonObject
        assertEquals(listOf("string", "null"), emoji.getValue("anyOf").jsonArray.map { it.jsonObject.getValue("type").jsonPrimitive.content })
    }

    @Test
    fun timesAndDatesHaveTheirFormats() {
        val eventProps = props("EventDoc")
        assertEquals("date", eventProps.getValue("targetDate").jsonObject.getValue("format").jsonPrimitive.content)
        val time = eventProps.getValue("targetTime").jsonObject.getValue("anyOf").jsonArray[0].jsonObject
        assertTrue(time.getValue("pattern").jsonPrimitive.content.contains("[0-5]\\d):([0-5]\\d)$"))
        val updated = eventProps.getValue("updatedAt").jsonObject.getValue("anyOf").jsonArray[0].jsonObject
        assertEquals("date-time", updated.getValue("format").jsonPrimitive.content)
        assertEquals("^([01]\\d|2[0-3]):([0-5]\\d)$", props("Reminders").getValue("time").jsonObject.getValue("pattern").jsonPrimitive.content)
    }

    @Test
    fun audioIsOneOfItsKindsWithAConstDiscriminator() {
        val refs = def("Audio").getValue("oneOf").jsonArray.map { it.jsonObject.getValue("\$ref").jsonPrimitive.content }
        assertEquals(listOf("#/\$defs/AudioCustom", "#/\$defs/AudioLibrary", "#/\$defs/AudioSpotify"), refs)
        assertEquals("custom", props("AudioCustom").getValue("kind").jsonObject.getValue("const").jsonPrimitive.content)
        assertEquals(listOf("kind", "mediaId", "title"), required("AudioCustom"))
        assertEquals(listOf("kind", "url"), required("AudioSpotify"))
    }

    @Test
    fun recurrenceUsesTheFlatApiObject() {
        assertEquals(listOf("type", "originalYear", "days"), props("Recurrence").keys.toList())
        assertEquals(listOf("type"), required("Recurrence"))
    }

    @Test
    fun enumsListTheirApiValues() {
        val modes = def("UnitMode").getValue("enum").jsonArray.map { it.jsonPrimitive.content }
        assertEquals(listOf("auto", "days", "weeks", "hours", "calendar", "workdays"), modes)
        assertEquals(ApiErrorCode.entries.size, def("ApiErrorCode").getValue("enum").jsonArray.size)
    }

    @Test
    fun jsonObjectsAndElementsAreOpen() {
        assertEquals(JsonObject(mapOf("type" to JsonPrimitive("object"))), props("PatchRequest").getValue("patch"))
        assertEquals(JsonObject(emptyMap()), props("FieldChange").getValue("from").jsonObject.getValue("anyOf").jsonArray[0])
    }

    @Test
    fun unknownStringTypesFail() {
        JsonSchemaGenerator().add(serializer<WithChar>().descriptor)
        assertFailsWith<IllegalStateException> {
            JsonSchemaGenerator().add(serializer<kotlinx.datetime.LocalTime>().descriptor)
        }
    }

    @Test
    fun errorCodesCarryTheirStatus() {
        val codes = errorCodes().getValue("codes").jsonObject
        assertEquals(400, codes.getValue("invalid_payload").jsonPrimitive.int)
        assertEquals(503, codes.getValue("service_unavailable").jsonPrimitive.int)
        assertEquals(ApiErrorCode.entries.size, codes.size)
    }

    @Test
    fun planTableMatchesTheModel() {
        val limits = planTable().getValue("limits").jsonObject
        assertEquals(PlanTable.FREE.ownedEvents, limits.getValue("free").jsonObject.getValue("events").jsonPrimitive.int)
        assertEquals("null", limits.getValue("premium").jsonObject.getValue("spotify_events").toString())
        assertEquals(0, limits.getValue("free").jsonObject.getValue(Feature.PremiumAudio.key).jsonPrimitive.int)
        assertEquals(listOf("free", "premium", "premium_plus"), limits.keys.toList())
    }

    @Test
    fun fixedLimitsHoldEveryConstant() {
        val limits = fixedLimits().getValue("limits").jsonObject
        assertEquals(16_384, limits.getValue("EVENT_DOC_MAX_BYTES").jsonPrimitive.int)
        assertEquals("0.8", limits.getValue("DIM_MAX").jsonPrimitive.content)
        assertEquals(limits.keys.sorted(), limits.keys.toList())
    }

    @Test
    fun validationVectorsRecordValuesAndErrors() {
        val vectors = validationVectors().getValue("vectors").jsonArray.associateBy { it.jsonObject.getValue("name").jsonPrimitive.content }
        val minimal = vectors.getValue("event-minimal").jsonObject.getValue("expected").jsonObject
        assertTrue(minimal.getValue("valid").jsonPrimitive.boolean)
        val bad = vectors.getValue("title-101").jsonObject.getValue("expected").jsonObject
        assertFalse(bad.getValue("valid").jsonPrimitive.boolean)
        val body = bad.getValue("body").jsonObject.getValue("error").jsonObject
        assertEquals("invalid_payload", body.getValue("code").jsonPrimitive.content)
        assertEquals("title", body.getValue("details").jsonObject.getValue("field").jsonPrimitive.content)
        assertEquals(ContractCases.validation.size, vectors.size, "case names must be unique")
    }

    @Test
    fun mergeVectorsHaveUniqueNamesAndExpectations() {
        val vectors = mergeVectors().getValue("vectors").jsonArray
        assertEquals(ContractCases.merge.size, vectors.map { it.jsonObject.getValue("name") }.toSet().size)
        val archive = vectors.first { it.jsonObject.getValue("name").jsonPrimitive.content == "event-archive-clears-pin" }
        val applied = archive.jsonObject.getValue("expected").jsonObject.getValue("applied").jsonObject
        assertEquals("null", applied.getValue("pinnedAt").toString())
    }

    @Test
    fun outputIsDeterministic() {
        assertEquals(contractFiles(), contractFiles())
        Json.parseToJsonElement(contractFiles().getValue("api.schema.json"))
        assertTrue(contractFiles().keys.containsAll(listOf("api.schema.json", "plans.json", "validation-vectors.json", "merge-vectors.json")))
    }

    @Test
    fun everyApiTypeIsInTheSchema() {
        for (name in listOf("EventDoc", "PublicEvent", "Memo", "ConfigResponse", "StorageReport", "ApiErrorResponse", "LinkViewResponse")) {
            assertTrue(name in defs, name)
        }
        assertEquals(EventDoc.serializer().descriptor.elementsCount, props("EventDoc").size)
        assertTrue(schema.getValue("\$defs") !is JsonArray)
    }
}

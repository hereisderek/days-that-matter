package dev.derek.daysthatmatter.core.model

import kotlinx.datetime.LocalDate
import kotlinx.serialization.Serializable
import kotlin.test.Test
import kotlin.test.assertEquals

class ModelJsonTest {

    @Serializable
    private data class Sample(
        val id: String,
        val date: LocalDate,
        val note: String? = null,
        val count: Int = 0,
    )

    @Test
    fun unknownFieldsAreIgnoredOnRead() {
        val json = """{"id":"a","date":"2028-02-29","addedByNewerClient":{"x":1}}"""

        assertEquals(Sample(id = "a", date = LocalDate(2028, 2, 29)), ModelJson.decodeFromString<Sample>(json))
    }

    @Test
    fun defaultsAndNullsAreNotWritten() {
        val sample = Sample(id = "a", date = LocalDate(2026, 10, 14))

        assertEquals("""{"id":"a","date":"2026-10-14"}""", ModelJson.encodeToString(sample))
    }

    @Test
    fun roundTripKeepsEveryField() {
        val sample = Sample(id = "b", date = LocalDate(2030, 1, 1), note = "n", count = 3)

        assertEquals(sample, ModelJson.decodeFromString<Sample>(ModelJson.encodeToString(sample)))
    }
}

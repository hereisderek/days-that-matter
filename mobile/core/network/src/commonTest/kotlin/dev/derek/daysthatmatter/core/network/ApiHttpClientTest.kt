package dev.derek.daysthatmatter.core.network

import io.ktor.client.call.body
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.request.get
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.Serializable
import kotlin.test.Test
import kotlin.test.assertEquals

class ApiHttpClientTest {

    @Serializable
    private data class Config(val region: String, val memoBadge: String = "top-right")

    @Test
    fun requestsAreResolvedAgainstTheBaseUrlAndBodiesUseModelJson() = runTest {
        var requestedUrl = ""
        val engine = MockEngine { request ->
            requestedUrl = request.url.toString()
            respond(
                content = """{"region":"global","addedLater":true}""",
                status = HttpStatusCode.OK,
                headers = headersOf(HttpHeaders.ContentType, "application/json"),
            )
        }
        val client = createApiHttpClient(baseUrl = "https://api.example.test/v1", engine = engine)

        val config = client.get("config").body<Config>()

        assertEquals("https://api.example.test/v1/config", requestedUrl)
        assertEquals(Config(region = "global"), config)
    }
}

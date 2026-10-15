package dev.derek.daysthatmatter.core.network

import dev.derek.daysthatmatter.core.model.ModelJson
import io.ktor.client.HttpClient
import io.ktor.client.HttpClientConfig
import io.ktor.client.engine.HttpClientEngine
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.defaultRequest
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json

/**
 * Creates the HTTP client for the backend API at [baseUrl]. Bodies use [ModelJson], the JSON
 * configuration shared with the backend. Pass [engine] in tests; the app uses [platformHttpEngine].
 */
fun createApiHttpClient(
    baseUrl: String,
    engine: HttpClientEngine = platformHttpEngine(),
    configure: HttpClientConfig<*>.() -> Unit = {},
): HttpClient = HttpClient(engine) {
    expectSuccess = false
    install(ContentNegotiation) {
        json(ModelJson)
    }
    defaultRequest {
        url(baseUrl.trimEnd('/') + "/")
        contentType(ContentType.Application.Json)
    }
    configure()
}

/** OkHttp on Android, Darwin (NSURLSession) on iOS. */
expect fun platformHttpEngine(): HttpClientEngine

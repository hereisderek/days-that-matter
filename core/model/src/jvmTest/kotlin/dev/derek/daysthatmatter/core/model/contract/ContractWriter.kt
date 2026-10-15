package dev.derek.daysthatmatter.core.model.contract

import dev.derek.daysthatmatter.core.model.api.ApiErrorCode
import dev.derek.daysthatmatter.core.model.api.ApiErrorResponse
import dev.derek.daysthatmatter.core.model.api.ApplePurchaseRequest
import dev.derek.daysthatmatter.core.model.api.AudioCatalog
import dev.derek.daysthatmatter.core.model.api.ChildrenResponse
import dev.derek.daysthatmatter.core.model.api.ConfigResponse
import dev.derek.daysthatmatter.core.model.api.CreateInviteRequest
import dev.derek.daysthatmatter.core.model.api.CreateInviteResponse
import dev.derek.daysthatmatter.core.model.api.CreateLinkRequest
import dev.derek.daysthatmatter.core.model.api.DeviceRegistration
import dev.derek.daysthatmatter.core.model.api.EmailStartRequest
import dev.derek.daysthatmatter.core.model.api.EmailVerifyRequest
import dev.derek.daysthatmatter.core.model.api.FetchEventsRequest
import dev.derek.daysthatmatter.core.model.api.GooglePurchaseRequest
import dev.derek.daysthatmatter.core.model.api.HealthResponse
import dev.derek.daysthatmatter.core.model.api.InviteStatusResponse
import dev.derek.daysthatmatter.core.model.api.JoinResponse
import dev.derek.daysthatmatter.core.model.api.LibraryResponse
import dev.derek.daysthatmatter.core.model.api.LibraryUploadResponse
import dev.derek.daysthatmatter.core.model.api.LinkViewResponse
import dev.derek.daysthatmatter.core.model.api.LiveMessage
import dev.derek.daysthatmatter.core.model.api.MediaKind
import dev.derek.daysthatmatter.core.model.api.MediaUploadResponse
import dev.derek.daysthatmatter.core.model.api.PatchRequest
import dev.derek.daysthatmatter.core.model.api.PatchResponse
import dev.derek.daysthatmatter.core.model.api.PurchaseResponse
import dev.derek.daysthatmatter.core.model.api.RestoreRequest
import dev.derek.daysthatmatter.core.model.api.Revision
import dev.derek.daysthatmatter.core.model.api.SetMemberRoleRequest
import dev.derek.daysthatmatter.core.model.api.SharingResponse
import dev.derek.daysthatmatter.core.model.api.StorageReport
import dev.derek.daysthatmatter.core.model.api.SyncManifest
import dev.derek.daysthatmatter.core.model.api.TokenSignInRequest
import dev.derek.daysthatmatter.core.model.event.EventDoc
import dev.derek.daysthatmatter.core.model.event.Memo
import dev.derek.daysthatmatter.core.model.event.Membership
import dev.derek.daysthatmatter.core.model.event.PublicEvent
import dev.derek.daysthatmatter.core.model.merge.PatchMerge
import dev.derek.daysthatmatter.core.model.merge.RevisionFields
import dev.derek.daysthatmatter.core.model.plan.Feature
import dev.derek.daysthatmatter.core.model.plan.Plan
import dev.derek.daysthatmatter.core.model.plan.PlanTable
import dev.derek.daysthatmatter.core.model.validation.EventValidation
import dev.derek.daysthatmatter.core.model.validation.Limits
import dev.derek.daysthatmatter.core.model.validation.MemoValidation
import dev.derek.daysthatmatter.core.model.validation.MembershipValidation
import dev.derek.daysthatmatter.core.model.validation.SharingValidation
import dev.derek.daysthatmatter.core.model.validation.Validated
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import kotlinx.serialization.json.put
import kotlinx.serialization.serializer
import java.io.File
import java.lang.reflect.Modifier
import kotlin.time.Instant

@OptIn(ExperimentalSerializationApi::class)
private val contractJson = Json {
    prettyPrint = true
    prettyPrintIndent = "  "
}

private const val GENERATED_BY = "./gradlew :core:model:generateContract (do not edit by hand)"

/**
 * Writes the backend contract (task 2.8 of the change pluggable-backend-live-sharing) into the
 * directory `args[0]`, replacing every file there. Run by `:core:model:generateContract`; CI runs
 * `:core:model:checkContract`, which fails when the committed files differ from a fresh generation.
 */
fun main(args: Array<String>) {
    require(args.size == 1) { "usage: ContractWriter <output directory>" }
    val dir = File(args[0])
    dir.mkdirs()
    dir.listFiles()?.filter { it.isFile }?.forEach { it.delete() }
    for ((name, content) in contractFiles()) File(dir, name).writeText(content)
}

/** Every contract file by name. Output is deterministic. */
fun contractFiles(): Map<String, String> = linkedMapOf(
    "README.md" to README,
    "api.schema.json" to pretty(apiSchema()),
    "errors.json" to pretty(errorCodes()),
    "plans.json" to pretty(planTable()),
    "limits.json" to pretty(fixedLimits()),
    "validation-vectors.json" to pretty(validationVectors()),
    "merge-vectors.json" to pretty(mergeVectors()),
)

private fun pretty(element: JsonElement): String = contractJson.encodeToString(JsonElement.serializer(), element) + "\n"

private val README = """
    |# Backend contract (generated)
    |
    |Generated from `:core:model` by `$GENERATED_BY`. CI runs `./gradlew :core:model:checkContract` and fails
    |when these files differ from a fresh generation. Change the Kotlin model or the cases in
    |`core/model/src/jvmTest/.../contract/ContractCases.kt`, then regenerate.
    |
    |- `api.schema.json`: JSON Schema (draft 2020-12) of the API request and response types.
    |  `backend/core/src/contract/api.ts` is generated from it (`npm run contract:types` in `backend/core`).
    |- `errors.json`: API error codes and their HTTP status.
    |- `plans.json`: the plan table. A limit of 0 means the plan does not include the feature; null means no limit.
    |- `limits.json`: fixed limits for every plan.
    |- `validation-vectors.json`: inputs and the normalized value or errors that `:core:model` validation gives.
    |- `merge-vectors.json`: patch apply, inverse, overwritten-field detection and revert.
    |""".trimMargin()

/** Every API type of BACKEND.md section 7, plus the event, memo and membership documents. */
private val API_TYPES: List<KSerializer<*>> = listOf(
    serializer<HealthResponse>(),
    serializer<ConfigResponse>(),
    serializer<TokenSignInRequest>(),
    serializer<EmailStartRequest>(),
    serializer<EmailVerifyRequest>(),
    serializer<SyncManifest>(),
    serializer<FetchEventsRequest>(),
    serializer<EventDoc>(),
    serializer<PublicEvent>(),
    serializer<Memo>(),
    serializer<Membership>(),
    serializer<PatchRequest>(),
    serializer<PatchResponse>(),
    serializer<ChildrenResponse>(),
    serializer<SharingResponse>(),
    serializer<CreateLinkRequest>(),
    serializer<CreateInviteRequest>(),
    serializer<CreateInviteResponse>(),
    serializer<InviteStatusResponse>(),
    serializer<JoinResponse>(),
    serializer<SetMemberRoleRequest>(),
    serializer<LinkViewResponse>(),
    serializer<LiveMessage>(),
    serializer<MediaKind>(),
    serializer<MediaUploadResponse>(),
    serializer<AudioCatalog>(),
    serializer<LibraryResponse>(),
    serializer<LibraryUploadResponse>(),
    serializer<ApplePurchaseRequest>(),
    serializer<GooglePurchaseRequest>(),
    serializer<PurchaseResponse>(),
    serializer<DeviceRegistration>(),
    serializer<Revision>(),
    serializer<RestoreRequest>(),
    serializer<StorageReport>(),
    serializer<ApiErrorResponse>(),
    serializer<Feature>(),
)

fun apiSchema(): JsonObject {
    val generator = JsonSchemaGenerator()
    API_TYPES.forEach { generator.add(it.descriptor) }
    return JsonObject(
        mapOf("generatedBy" to JsonPrimitive(GENERATED_BY)) +
            generator.document("https://daysthatmatter.app/contract/api.schema.json"),
    )
}

fun errorCodes(): JsonObject = buildJsonObject {
    put("generatedBy", GENERATED_BY)
    put(
        "codes",
        buildJsonObject {
            for (code in ApiErrorCode.entries) put(apiName(ApiErrorCode.serializer(), code), code.httpStatus)
        },
    )
}

fun planTable(): JsonObject = buildJsonObject {
    put("generatedBy", GENERATED_BY)
    put("plans", JsonArray(Plan.entries.map { JsonPrimitive(apiName(Plan.serializer(), it)) }))
    put("features", JsonArray(Feature.entries.map { JsonPrimitive(it.key) }))
    put(
        "limits",
        buildJsonObject {
            for (plan in Plan.entries) {
                val limits = PlanTable.limits(plan)
                put(apiName(Plan.serializer(), plan), buildJsonObject { Feature.entries.forEach { put(it.key, limits.limit(it)) } })
            }
        },
    )
}

/** The constants of [Limits], sorted by name. */
fun fixedLimits(): JsonObject = buildJsonObject {
    put("generatedBy", GENERATED_BY)
    val fields = Limits::class.java.declaredFields
        .filter { Modifier.isStatic(it.modifiers) && Modifier.isFinal(it.modifiers) && it.name != "INSTANCE" }
        .sortedBy { it.name }
    put(
        "limits",
        buildJsonObject {
            for (field in fields) {
                when (val value = field.get(null)) {
                    is Int -> put(field.name, value)
                    is Double -> put(field.name, value)
                    else -> error("Unsupported limit type for ${field.name}")
                }
            }
        },
    )
}

fun validationVectors(): JsonObject = buildJsonObject {
    put("generatedBy", GENERATED_BY)
    put("now", ContractCases.NOW)
    put(
        "rules",
        "Each vector runs one validator on input. valid=true gives the normalized value; valid=false gives every " +
            "field error in order and the 400 body, which names the first. Sharing vectors are validated at now. " +
            "eventDocSize checks a stored document: valid=true with value null, or one error.",
    )
    put(
        "vectors",
        buildJsonArray {
            for (case in ContractCases.validation) {
                add(
                    buildJsonObject {
                        put("name", case.name)
                        put("kind", case.kind.key)
                        put("input", case.input)
                        put("expected", validate(case))
                    },
                )
            }
        },
    )
}

private fun validate(case: ValidationCase): JsonObject {
    val now = Instant.parse(ContractCases.NOW)
    val result: Validated<JsonObject> = when (case.kind) {
        ValidationKind.EventNew -> EventValidation.validateNew(case.input)
        ValidationKind.EventPatch -> EventValidation.validatePatch(case.input)
        ValidationKind.EventDocSize -> EventValidation.checkDocumentSize(case.input)
            ?.let { Validated.Invalid(listOf(it)) } ?: Validated.Valid(case.input)
        ValidationKind.MemoNew -> MemoValidation.validateNew(case.input)
        ValidationKind.MemoPatch -> MemoValidation.validatePatch(case.input)
        ValidationKind.LinkNew -> SharingValidation.validateNewLink(case.input, now)
        ValidationKind.LinkPatch -> SharingValidation.validateLinkPatch(case.input, now)
        ValidationKind.InviteNew -> SharingValidation.validateNewInvite(case.input, now)
        ValidationKind.InvitePatch -> SharingValidation.validateInvitePatch(case.input, now)
        ValidationKind.MembershipPatch -> MembershipValidation.validatePatch(case.input)
    }
    return when (result) {
        is Validated.Valid -> buildJsonObject {
            put("valid", true)
            put("value", if (case.kind == ValidationKind.EventDocSize) JsonNull else result.value)
        }
        is Validated.Invalid -> buildJsonObject {
            put("valid", false)
            put(
                "errors",
                JsonArray(
                    result.errors.map {
                        buildJsonObject {
                            put("field", it.field)
                            put("reason", it.reason)
                        }
                    },
                ),
            )
            val error = result.toApiError()
            put(
                "body",
                buildJsonObject {
                    put(
                        "error",
                        buildJsonObject {
                            put("code", apiName(ApiErrorCode.serializer(), error.code))
                            put("message", error.message)
                            put("details", error.details ?: JsonNull)
                        },
                    )
                },
            )
        }
    }
}

fun mergeVectors(): JsonObject = buildJsonObject {
    put("generatedBy", GENERATED_BY)
    put(
        "rules",
        "apply: patch values replace top-level fields, null clears, equal values are skipped, nested objects are " +
            "replaced whole; applied holds the changed fields, inverse their old values (null = was absent). " +
            "applyToEvent: as apply, and setting archivedAt also clears pinnedAt. overwritten: changed fields that a " +
            "revision after baseRev by another or deleted account also changed, sorted. revertTo: current with the " +
            "inverses of every revision after targetRev applied, newest first.",
    )
    put(
        "vectors",
        buildJsonArray {
            for (case in ContractCases.merge) {
                add(
                    buildJsonObject {
                        put("name", case.name)
                        put("kind", case.kind)
                        put("input", case.input)
                        put("expected", merge(case))
                    },
                )
            }
        },
    )
}

private fun merge(case: MergeCase): JsonElement {
    val input = case.input
    return when (case.kind) {
        "apply", "applyToEvent" -> {
            val doc = input.getValue("doc").jsonObject
            val patch = input.getValue("patch").jsonObject
            val result = if (case.kind == "apply") PatchMerge.apply(doc, patch) else PatchMerge.applyToEvent(doc, patch)
            buildJsonObject {
                put("doc", result.doc)
                put("applied", result.applied)
                put("inverse", result.inverse)
            }
        }
        "overwritten" -> {
            val revisions = input.getValue("revisions").jsonArray.map { r ->
                val o = r.jsonObject
                RevisionFields(
                    rev = o.getValue("rev").jsonPrimitive.long,
                    authorId = (o.getValue("authorId") as? JsonPrimitive)?.takeIf { it !is JsonNull }?.content,
                    fields = o.getValue("fields").jsonArray.map { it.jsonPrimitive.content }.toSet(),
                )
            }
            val fields = PatchMerge.overwrittenFields(
                changedFields = input.getValue("changedFields").jsonArray.map { it.jsonPrimitive.content }.toSet(),
                baseRev = input.getValue("baseRev").jsonPrimitive.long,
                revisionsSinceBase = revisions,
                writerId = input.getValue("writerId").jsonPrimitive.content,
            )
            JsonArray(fields.map(::JsonPrimitive))
        }
        "revertTo" -> PatchMerge.revertTo(
            current = input.getValue("current").jsonObject,
            targetRev = input.getValue("targetRev").jsonPrimitive.long,
            later = input.getValue("later").jsonArray.map {
                it.jsonObject.getValue("rev").jsonPrimitive.long to it.jsonObject.getValue("inverse").jsonObject
            },
        )
        else -> error("Unknown merge kind ${case.kind}")
    }
}

/** The serial (API) name of an enum value. */
private fun <T : Enum<T>> apiName(serializer: KSerializer<T>, value: T): String =
    serializer.descriptor.getElementName(value.ordinal)

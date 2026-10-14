package dev.derek.daysthatmatter.core.model.api

import dev.derek.daysthatmatter.core.model.ModelJson
import dev.derek.daysthatmatter.core.model.event.MemberRole
import dev.derek.daysthatmatter.core.model.event.PublicEvent
import dev.derek.daysthatmatter.core.model.event.Role
import dev.derek.daysthatmatter.core.model.event.Theme
import dev.derek.daysthatmatter.core.model.plan.Plan
import kotlinx.datetime.LocalDate
import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.time.Instant

/** JSON round trips of the API types, using the bodies of BACKEND.md section 7 where it shows them. */
class ApiTypesJsonTest {
    private val at = Instant.parse("2026-10-12T15:04:05Z")

    private fun <T> roundTrip(serializer: KSerializer<T>, value: T) {
        val json = ModelJson.encodeToString(serializer, value)
        assertEquals(value, ModelJson.decodeFromString(serializer, json), json)
    }

    private fun <T> decodes(serializer: KSerializer<T>, json: String, expected: T) {
        assertEquals(expected, ModelJson.decodeFromString(serializer, json))
    }

    @Test
    fun configMatchesTheContractAndDefaults() {
        decodes(
            ConfigResponse.serializer(),
            """{"region":"global","live":"ws","signIn":["apple","google","email"],"stores":["apple","google"],"features":{"spotify":true},"ui":{"memoBadge":"top-right"}}""",
            ConfigResponse(
                region = "global",
                live = LiveMode.Ws,
                signIn = listOf(SignInMethod.Apple, SignInMethod.Google, SignInMethod.Email),
                stores = listOf(PurchaseStore.Apple, PurchaseStore.Google),
                features = ConfigFeatures(spotify = true),
                ui = ConfigUi(MemoBadgePosition.TopRight),
            ),
        )
        val minimal = ModelJson.decodeFromString(ConfigResponse.serializer(), """{"region":"cn","live":"poll","unknown":1}""")
        assertEquals(MemoBadgePosition.TopRight, minimal.ui.memoBadge)
        assertEquals(false, minimal.features.spotify)
        roundTrip(ConfigResponse.serializer(), minimal.copy(ui = ConfigUi(MemoBadgePosition.TopLeft)))
    }

    @Test
    fun syncAndPatchBodies() {
        decodes(
            SyncManifest.serializer(),
            """{"events":[{"id":"a","rev":3,"role":"editor","childSeq":0}]}""",
            SyncManifest(listOf(ManifestEntry("a", 3, Role.Editor, 0))),
        )
        val patch = ModelJson.decodeFromString(PatchRequest.serializer(), """{"baseRev": 9, "patch": {"title": "Our wedding day", "backdrop": null}}""")
        assertEquals(9, patch.baseRev)
        assertEquals(setOf("title", "backdrop"), patch.patch.keys)
        roundTrip(PatchRequest.serializer(), patch)
        roundTrip(FetchEventsRequest.serializer(), FetchEventsRequest(listOf("a", "b")))
        assertEquals(100, FetchEventsRequest.MAX_IDS)
    }

    @Test
    fun childrenBodyFromTheContract() {
        decodes(
            ChildrenResponse.serializer(),
            """{"memos": [{"id": "5c1f", "seq": 39, "deleted": false, "content": "x"}, {"id": "7a2e", "seq": 41, "deleted": true}], "seq": 41, "reset": false}""",
            ChildrenResponse(listOf(MemoChange("5c1f", 39, content = "x"), MemoChange("7a2e", 41, deleted = true)), 41),
        )
    }

    @Test
    fun sharingBodiesFromTheContract() {
        decodes(
            SharingResponse.serializer(),
            """
            {
              "links": [{"id": "l1", "label": "Instagram", "url": "https://d/e/t", "expiresAt": null}],
              "invites": [{"id": "i1", "url": "https://d/i/t", "role": "editor", "maxUses": 5, "useCount": 2, "expiresAt": "2026-11-11T15:04:05Z"}],
              "members": [{"accountId": "a1", "name": "Mum", "role": "editor", "joinedVia": "i1"}],
              "removed": [{"accountId": "a2", "name": "Ex"}]
            }
            """.trimIndent(),
            SharingResponse(
                links = listOf(LinkInfo("l1", "Instagram", "https://d/e/t", null)),
                invites = listOf(InviteInfo("i1", "https://d/i/t", MemberRole.Editor, 5, 2, Instant.parse("2026-11-11T15:04:05Z"))),
                members = listOf(MemberInfo("a1", "Mum", MemberRole.Editor, "i1")),
                removed = listOf(RemovedMember("a2", "Ex")),
            ),
        )
        roundTrip(CreateLinkRequest.serializer(), CreateLinkRequest("Family chat", at))
        roundTrip(CreateInviteRequest.serializer(), CreateInviteRequest(MemberRole.Viewer, null, null))
        roundTrip(CreateInviteResponse.serializer(), CreateInviteResponse("i1", "https://d/i/t"))
        roundTrip(SetMemberRoleRequest.serializer(), SetMemberRoleRequest(MemberRole.Viewer))
        roundTrip(JoinResponse.serializer(), JoinResponse("e1", "https://d/s/e1"))
        for (state in InviteState.entries) {
            roundTrip(InviteStatusResponse.serializer(), InviteStatusResponse(state, "Our wedding", "Derek", MemberRole.Editor))
        }
        decodes(
            InviteStatusResponse.serializer(),
            """{"state":"full"}""",
            InviteStatusResponse(InviteState.Full),
        )
    }

    @Test
    fun linkViewAndLiveMessages() {
        val event = PublicEvent(rev = 10, title = "t", targetDate = LocalDate(2027, 6, 12), theme = Theme("a", "b", "c"))
        roundTrip(LinkViewResponse.serializer(), LinkViewResponse(event, at, LiveInfo(LiveMode.Ws, "wss://d/api/v1/live?link=x")))
        decodes(LiveMessage.serializer(), """{"type":"rev","rev":13}""", LiveMessage(LiveMessageType.Rev, rev = 13))
        decodes(LiveMessage.serializer(), """{"type":"children","seq":41}""", LiveMessage(LiveMessageType.Children, seq = 41))
        decodes(LiveMessage.serializer(), """{"type":"access"}""", LiveMessage(LiveMessageType.Access))
    }

    @Test
    fun audioLibraryAndCatalogBodies() {
        decodes(
            LibraryResponse.serializer(),
            """{"audio": [{"mediaId": "Qm7", "title": "First dance", "durationSec": 214, "bytes": 2580000, "createdAt": "2026-10-12T15:04:05Z", "usedBy": 2}]}""",
            LibraryResponse(listOf(LibraryItem("Qm7", "First dance", 214, 2_580_000, at, 2))),
        )
        decodes(
            AudioCatalog.serializer(),
            """{"tracks": [{"id": "calm-lofi", "title": "Calm Lo-Fi", "artist": "x", "durationSec": 184, "tier": "free", "bytes": 2950000}]}""",
            AudioCatalog(listOf(CatalogTrack("calm-lofi", "Calm Lo-Fi", "x", 184, TrackTier.Free, 2_950_000))),
        )
        roundTrip(LibraryUploadResponse.serializer(), LibraryUploadResponse("Qm7"))
        roundTrip(MediaUploadResponse.serializer(), MediaUploadResponse("Pz8", "https://media/m/Pz8.jpg"))
        assertEquals("\"motion\"", ModelJson.encodeToString(MediaKind.serializer(), MediaKind.Motion))
    }

    @Test
    fun authPurchaseAndDeviceBodies() {
        roundTrip(TokenSignInRequest.serializer(), TokenSignInRequest(SignInMethod.Google, "id", "n"))
        roundTrip(EmailStartRequest.serializer(), EmailStartRequest("a@b.c"))
        roundTrip(EmailVerifyRequest.serializer(), EmailVerifyRequest("a@b.c", "123456"))
        roundTrip(ApplePurchaseRequest.serializer(), ApplePurchaseRequest(listOf("jws")))
        roundTrip(GooglePurchaseRequest.serializer(), GooglePurchaseRequest("premium_monthly", "token"))
        decodes(PurchaseResponse.serializer(), """{"plan":"premium_plus","expiresAt":"2026-10-12T15:04:05Z"}""", PurchaseResponse(Plan.PremiumPlus, at))
        roundTrip(
            DeviceRegistration.serializer(),
            DeviceRegistration(DevicePlatform.Android, "t", "en-NZ", "Pacific/Auckland", listOf(PushKind.Changes, PushKind.Offers)),
        )
        roundTrip(HealthResponse.serializer(), HealthResponse("ok", "1.0.0"))
    }

    @Test
    fun revisionAndRestoreBodies() {
        decodes(
            Revision.serializer(),
            """{"rev": 10, "author": {"name": "Mum"}, "at": "2026-10-12T15:04:05Z", "changes": [{"field": "title", "from": "Our wedding", "to": "Our wedding day"}], "overwrote": [], "restoredFrom": null}""",
            Revision(10, RevisionAuthor("Mum"), at, listOf(FieldChange("title", JsonPrimitive("Our wedding"), JsonPrimitive("Our wedding day")))),
        )
        roundTrip(RestoreRequest.serializer(), RestoreRequest(7))
        roundTrip(Revision.serializer(), Revision(11, null, at, emptyList(), listOf("targetTime"), restoredFrom = 7))
    }

    @Test
    fun storageReportFromTheContract() {
        decodes(
            StorageReport.serializer(),
            """{"rows": [{"accountId": "a", "displayName": "Mum", "plan": "premium", "files": {"still": 41, "motion": 12, "audio": 7}, "bytes": {"media": 98123456, "documents": 412000}, "totalBytes": 98535456, "lastActiveAt": "2026-10-11T08:00:00Z"}], "next": "n"}""",
            StorageReport(
                listOf(
                    StorageRow(
                        "a", "Mum", Plan.Premium, StorageFiles(41, 12, 7), StorageBytes(98_123_456, 412_000), 98_535_456,
                        Instant.parse("2026-10-11T08:00:00Z"),
                    ),
                ),
                "n",
            ),
        )
    }

    @Test
    fun errorBodyFromTheContract() {
        val json = """{"error": {"code": "invalid_payload", "message": "title: too long", "details": {"field": "title"}}}"""
        decodes(
            ApiErrorResponse.serializer(),
            json,
            ApiErrorResponse(ApiErrorBody(ApiErrorCode.InvalidPayload, "title: too long", buildJsonObject { put("field", JsonPrimitive("title")) })),
        )
        for (code in ApiErrorCode.entries) roundTrip(ApiErrorResponse.serializer(), ApiErrorResponse(ApiErrorBody(code, "m")))
        assertEquals(402, ApiErrorCode.PremiumRequired.httpStatus)
        assertEquals(403, ApiErrorCode.FieldNotAllowed.httpStatus)
        assertEquals(429, ApiErrorCode.QuotaExceeded.httpStatus)
        assertEquals(410, ApiErrorCode.InviteFull.httpStatus)
    }
}

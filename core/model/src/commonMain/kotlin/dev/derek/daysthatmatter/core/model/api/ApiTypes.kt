package dev.derek.daysthatmatter.core.model.api

import dev.derek.daysthatmatter.core.model.event.EventDoc
import dev.derek.daysthatmatter.core.model.event.MemberRole
import dev.derek.daysthatmatter.core.model.event.PublicEvent
import dev.derek.daysthatmatter.core.model.event.Role
import dev.derek.daysthatmatter.core.model.plan.Plan
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlin.time.Instant

// Request and response bodies of BACKEND.md section 7. Bodies the document does not show yet
// (sign-in response, GET /me, the POST /events/fetch and revisions page wrappers, the memo PATCH
// wrapper) are added with the backend core (tasks 3.x).

/** `GET /health`. */
@Serializable
data class HealthResponse(val status: String, val version: String)

/** Live update transport of a deployment. */
@Serializable
enum class LiveMode {
    @SerialName("ws") Ws,
    @SerialName("poll") Poll,
}

@Serializable
enum class SignInMethod {
    @SerialName("apple") Apple,
    @SerialName("google") Google,
    @SerialName("email") Email,
}

@Serializable
enum class PurchaseStore {
    @SerialName("apple") Apple,
    @SerialName("google") Google,
}

/** Where the memo badge sits on an owner's card (`ui.memoBadge`). */
@Serializable
enum class MemoBadgePosition {
    @SerialName("top-left") TopLeft,
    @SerialName("top-right") TopRight,
}

/** `GET /config`: what the region offers. Missing values read as the defaults. */
@Serializable
data class ConfigResponse(
    val region: String,
    val live: LiveMode,
    val signIn: List<SignInMethod> = emptyList(),
    val stores: List<PurchaseStore> = emptyList(),
    val features: ConfigFeatures = ConfigFeatures(),
    val ui: ConfigUi = ConfigUi(),
)

@Serializable
data class ConfigFeatures(val spotify: Boolean = false)

@Serializable
data class ConfigUi(val memoBadge: MemoBadgePosition = MemoBadgePosition.TopRight)

/** `POST /auth/token` for Google and Apple. Also the body of `POST /me/identities`. */
@Serializable
data class TokenSignInRequest(val provider: SignInMethod, val idToken: String, val nonce: String)

/** `POST /auth/email/start`. */
@Serializable
data class EmailStartRequest(val email: String)

/** `POST /auth/email/verify`. */
@Serializable
data class EmailVerifyRequest(val email: String, val code: String)

/** One row of the sync manifest. */
@Serializable
data class ManifestEntry(val id: String, val rev: Long, val role: Role, val childSeq: Long)

/** `GET /sync`. */
@Serializable
data class SyncManifest(val events: List<ManifestEntry>)

/** `POST /events/fetch`: at most [MAX_IDS] ids. */
@Serializable
data class FetchEventsRequest(val ids: List<String>) {
    companion object {
        const val MAX_IDS: Int = 100
    }
}

/** `PATCH /events/{id}`: new values of top-level fields, null clears (design D5). */
@Serializable
data class PatchRequest(val baseRev: Long, val patch: JsonObject)

/** Answer to a patch: the document and the fields where the write replaced someone else's newer change. */
@Serializable
data class PatchResponse(val event: EventDoc, val overwritten: List<String> = emptyList())

/** One memo change in `GET /events/{id}/children`; deleted memos carry only id and seq. */
@Serializable
data class MemoChange(
    val id: String,
    val seq: Long,
    val deleted: Boolean = false,
    val content: String? = null,
    val milestoneTag: String? = null,
    val createdAt: Instant? = null,
    val updatedAt: Instant? = null,
)

/** `GET /events/{id}/children?after=`: [reset] means the client is too far behind and refetches all. */
@Serializable
data class ChildrenResponse(val memos: List<MemoChange>, val seq: Long, val reset: Boolean = false)

/** A public link as its owner sees it. */
@Serializable
data class LinkInfo(val id: String, val label: String? = null, val url: String, val expiresAt: Instant? = null)

/** An invite as its owner sees it. [maxUses] null = unlimited. */
@Serializable
data class InviteInfo(
    val id: String,
    val url: String,
    val role: MemberRole,
    val maxUses: Int? = null,
    val useCount: Int = 0,
    val expiresAt: Instant? = null,
)

/** A member as the owner sees them on the sharing screen. */
@Serializable
data class MemberInfo(val accountId: String, val name: String, val role: MemberRole, val joinedVia: String? = null)

/** A removed member, blocked from rejoining until the owner allows them again. */
@Serializable
data class RemovedMember(val accountId: String, val name: String)

/** `GET /events/{id}/sharing` (owner only). */
@Serializable
data class SharingResponse(
    val links: List<LinkInfo> = emptyList(),
    val invites: List<InviteInfo> = emptyList(),
    val members: List<MemberInfo> = emptyList(),
    val removed: List<RemovedMember> = emptyList(),
)

/** `POST /events/{id}/links`: [expiresAt] null = never. */
@Serializable
data class CreateLinkRequest(val label: String? = null, val expiresAt: Instant? = null)

/** `POST /events/{id}/invites`: [maxUses] null = unlimited, [expiresAt] null = never. */
@Serializable
data class CreateInviteRequest(val role: MemberRole, val maxUses: Int? = null, val expiresAt: Instant? = null)

/** Answer to [CreateInviteRequest]. */
@Serializable
data class CreateInviteResponse(val inviteId: String, val url: String)

/** State of an invite for the account opening it. */
@Serializable
enum class InviteState {
    @SerialName("open") Open,
    @SerialName("full") Full,
    @SerialName("expired") Expired,
    @SerialName("revoked") Revoked,
    @SerialName("member") Member,
    @SerialName("owner") Owner,
    @SerialName("removed") Removed,
}

/** `GET /invites/{token}`: uses nothing. */
@Serializable
data class InviteStatusResponse(
    val state: InviteState,
    val eventTitle: String? = null,
    val ownerName: String? = null,
    val role: MemberRole? = null,
)

/** `POST /invites/{token}/join`: [url] is the member link `/s/{eventId}`. */
@Serializable
data class JoinResponse(val eventId: String, val url: String)

/** `PUT /events/{id}/members/{accountId}`. */
@Serializable
data class SetMemberRoleRequest(val role: MemberRole)

/** Where a public link page subscribes to live changes. */
@Serializable
data class LiveInfo(val mode: LiveMode, val url: String? = null)

/** `GET /links/{token}`. */
@Serializable
data class LinkViewResponse(val event: PublicEvent, val serverTime: Instant, val live: LiveInfo)

/** Live change notice; carries no event data (design D7). */
@Serializable
data class LiveMessage(val type: LiveMessageType, val rev: Long? = null, val seq: Long? = null)

@Serializable
enum class LiveMessageType {
    @SerialName("rev") Rev,
    @SerialName("children") Children,
    @SerialName("access") Access,
}

/** `POST /events/{id}/media`. */
@Serializable
data class MediaUploadResponse(val mediaId: String, val url: String? = null)

/** Backdrop upload kinds (`X-Media-Kind`). */
@Serializable
enum class MediaKind {
    @SerialName("still") Still,
    @SerialName("motion") Motion,
    @SerialName("audio") Audio,
}

/** Whether a built-in track is free or needs `premium_audio`. */
@Serializable
enum class TrackTier {
    @SerialName("free") Free,
    @SerialName("premium") Premium,
}

/** One built-in track of `GET /audio/catalog`. */
@Serializable
data class CatalogTrack(
    val id: String,
    val title: String,
    val artist: String? = null,
    val durationSec: Int,
    val tier: TrackTier,
    val bytes: Long,
)

/** `GET /audio/catalog`. */
@Serializable
data class AudioCatalog(val tracks: List<CatalogTrack>)

/** One custom audio file in the caller's library; [usedBy] counts days that use it. */
@Serializable
data class LibraryItem(
    val mediaId: String,
    val title: String,
    val durationSec: Int,
    val bytes: Long,
    val createdAt: Instant,
    val usedBy: Int = 0,
)

/** `GET /me/library`, newest first. */
@Serializable
data class LibraryResponse(val audio: List<LibraryItem>)

/** `POST /me/library`. */
@Serializable
data class LibraryUploadResponse(val mediaId: String)

/** `POST /purchases/apple`: JWS of each current StoreKit 2 entitlement. */
@Serializable
data class ApplePurchaseRequest(val signedTransactions: List<String>)

/** `POST /purchases/google`. */
@Serializable
data class GooglePurchaseRequest(val productId: String, val purchaseToken: String)

/** Answer to a purchase or restore. */
@Serializable
data class PurchaseResponse(val plan: Plan, val expiresAt: Instant? = null)

@Serializable
enum class DevicePlatform {
    @SerialName("ios") Ios,
    @SerialName("android") Android,
}

/** Push notification kinds a device accepts. */
@Serializable
enum class PushKind {
    @SerialName("changes") Changes,
    @SerialName("added") Added,
    @SerialName("offers") Offers,
}

/** `PUT /me/devices/{installId}`. */
@Serializable
data class DeviceRegistration(
    val platform: DevicePlatform,
    val pushToken: String,
    val locale: String,
    val timeZone: String,
    val kinds: List<PushKind>,
)

/** Who made a revision; null once the author deleted their account. */
@Serializable
data class RevisionAuthor(val name: String)

/** One changed field of a revision. */
@Serializable
data class FieldChange(val field: String, val from: JsonElement? = null, val to: JsonElement? = null)

/** One entry of `GET /events/{id}/revisions`. */
@Serializable
data class Revision(
    val rev: Long,
    val author: RevisionAuthor? = null,
    val at: Instant,
    val changes: List<FieldChange>,
    val overwrote: List<String> = emptyList(),
    val restoredFrom: Long? = null,
)

/** `POST /events/{id}/restore`. */
@Serializable
data class RestoreRequest(val rev: Long)

/** Storage report row counts per media kind. */
@Serializable
data class StorageFiles(val still: Int = 0, val motion: Int = 0, val audio: Int = 0)

@Serializable
data class StorageBytes(val media: Long = 0, val documents: Long = 0)

@Serializable
data class StorageRow(
    val accountId: String,
    val displayName: String,
    val plan: Plan,
    val files: StorageFiles,
    val bytes: StorageBytes,
    val totalBytes: Long,
    val lastActiveAt: Instant,
)

/** `GET /admin/storage` (operator only). */
@Serializable
data class StorageReport(val rows: List<StorageRow>, val next: String? = null)

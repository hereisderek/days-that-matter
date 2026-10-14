// Generated from backend/core/contract/api.schema.json by `npm run contract:types`. Do not edit.
// The schema itself is generated from :core:model (./gradlew :core:model:generateContract).

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  details?: Record<string, unknown> | null;
}

export type ApiErrorCode = "invalid_payload" | "invalid_code" | "unauthorized" | "premium_required" | "forbidden" | "field_not_allowed" | "not_found" | "conflict" | "revoked" | "expired" | "deleted" | "invite_full" | "invite_expired" | "invite_revoked" | "payload_too_large" | "unsupported_media_type" | "rate_limited" | "quota_exceeded" | "internal_error" | "service_unavailable";

export interface ApiErrorResponse {
  error: ApiErrorBody;
}

export interface ApplePurchaseRequest {
  signedTransactions: string[];
}

export type Audio = AudioCustom | AudioLibrary | AudioSpotify;

export interface AudioCatalog {
  tracks: CatalogTrack[];
}

export interface AudioCustom {
  kind: "custom";
  mediaId: string;
  title: string;
}

export interface AudioLibrary {
  kind: "library";
  trackId: string;
}

export interface AudioSpotify {
  kind: "spotify";
  url: string;
  title?: string | null;
  artist?: string | null;
}

export interface Backdrop {
  kind: BackdropKind;
  stillId: string;
  motionId?: string | null;
  dim: number;
  blur?: number;
  stillUrl?: string | null;
  motionUrl?: string | null;
}

export type BackdropKind = "still" | "animated";

export type CardSize = "small" | "medium" | "large";

export interface CatalogTrack {
  id: string;
  title: string;
  artist?: string | null;
  durationSec: number;
  tier: TrackTier;
  bytes: number;
}

export interface ChildrenResponse {
  memos: MemoChange[];
  seq: number;
  reset?: boolean;
}

export interface ConfigFeatures {
  spotify?: boolean;
}

export interface ConfigResponse {
  region: string;
  live: LiveMode;
  signIn?: SignInMethod[];
  stores?: PurchaseStore[];
  features?: ConfigFeatures;
  ui?: ConfigUi;
}

export interface ConfigUi {
  memoBadge?: MemoBadgePosition;
}

export interface CreateInviteRequest {
  role: MemberRole;
  maxUses?: number | null;
  expiresAt?: string | null;
}

export interface CreateInviteResponse {
  inviteId: string;
  url: string;
}

export interface CreateLinkRequest {
  label?: string | null;
  expiresAt?: string | null;
}

export type DevicePlatform = "ios" | "android";

export interface DeviceRegistration {
  platform: DevicePlatform;
  pushToken: string;
  locale: string;
  timeZone: string;
  kinds: PushKind[];
}

export interface EmailStartRequest {
  email: string;
}

export interface EmailVerifyRequest {
  email: string;
  code: string;
}

export interface EventDoc {
  id: string;
  rev?: number;
  role?: Role | null;
  title: string;
  emoji?: string | null;
  /** Format: date. */
  targetDate: string;
  targetTime?: string | null;
  timeZone?: string | null;
  unitMode?: UnitMode;
  recurrence?: Recurrence;
  theme: Theme;
  backdrop?: Backdrop | null;
  audio?: Audio | null;
  notes?: string | null;
  pinnedAt?: string | null;
  categoryId?: string | null;
  archivedAt?: string | null;
  reminders?: Reminders | null;
  updatedAt?: string | null;
  members?: MemberName[] | null;
  archived?: boolean | null;
}

export type Feature = "events" | "photos" | "animated_backdrop" | "premium_audio" | "custom_audio" | "spotify_events";

export interface FetchEventsRequest {
  ids: string[];
}

export interface FieldChange {
  field: string;
  from?: unknown | null;
  to?: unknown | null;
}

export interface GooglePurchaseRequest {
  productId: string;
  purchaseToken: string;
}

export interface HealthResponse {
  status: string;
  version: string;
}

export interface InviteInfo {
  id: string;
  url: string;
  role: MemberRole;
  maxUses?: number | null;
  useCount?: number;
  expiresAt?: string | null;
}

export type InviteState = "open" | "full" | "expired" | "revoked" | "member" | "owner" | "removed";

export interface InviteStatusResponse {
  state: InviteState;
  eventTitle?: string | null;
  ownerName?: string | null;
  role?: MemberRole | null;
}

export interface JoinResponse {
  eventId: string;
  url: string;
}

export interface LibraryItem {
  mediaId: string;
  title: string;
  durationSec: number;
  bytes: number;
  /** Format: date-time. */
  createdAt: string;
  usedBy?: number;
}

export interface LibraryResponse {
  audio: LibraryItem[];
}

export interface LibraryUploadResponse {
  mediaId: string;
}

export interface LinkInfo {
  id: string;
  label?: string | null;
  url: string;
  expiresAt?: string | null;
}

export interface LinkViewResponse {
  event: PublicEvent;
  /** Format: date-time. */
  serverTime: string;
  live: LiveInfo;
}

export interface LiveInfo {
  mode: LiveMode;
  url?: string | null;
}

export interface LiveMessage {
  type: LiveMessageType;
  rev?: number | null;
  seq?: number | null;
}

export type LiveMessageType = "rev" | "children" | "access";

export type LiveMode = "ws" | "poll";

export interface ManifestEntry {
  id: string;
  rev: number;
  role: Role;
  childSeq: number;
}

export type MediaKind = "still" | "motion" | "audio";

export interface MediaUploadResponse {
  mediaId: string;
  url?: string | null;
}

export interface MemberInfo {
  accountId: string;
  name: string;
  role: MemberRole;
  joinedVia?: string | null;
}

export interface MemberName {
  name: string;
  role: Role;
}

export type MemberRole = "editor" | "viewer";

export interface Membership {
  archivedAt?: string | null;
  reminders?: Reminders | null;
}

export interface Memo {
  id: string;
  eventId: string;
  seq?: number;
  content: string;
  milestoneTag?: string | null;
  /** Format: date-time. */
  createdAt: string;
  updatedAt?: string | null;
}

export type MemoBadgePosition = "top-left" | "top-right";

export interface MemoChange {
  id: string;
  seq: number;
  deleted?: boolean;
  content?: string | null;
  milestoneTag?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface PatchRequest {
  baseRev: number;
  patch: Record<string, unknown>;
}

export interface PatchResponse {
  event: EventDoc;
  overwritten?: string[];
}

export type Plan = "free" | "premium" | "premium_plus";

export interface PublicEvent {
  rev: number;
  title: string;
  emoji?: string | null;
  /** Format: date. */
  targetDate: string;
  targetTime?: string | null;
  timeZone?: string | null;
  unitMode?: UnitMode;
  recurrence?: Recurrence;
  theme: Theme;
  backdrop?: Backdrop | null;
  audio?: Audio | null;
}

export interface PurchaseResponse {
  plan: Plan;
  expiresAt?: string | null;
}

export type PurchaseStore = "apple" | "google";

export type PushKind = "changes" | "added" | "offers";

export interface Recurrence {
  type: RecurrenceType;
  originalYear?: number | null;
  days?: number | null;
}

export type RecurrenceType = "none" | "yearly" | "monthly" | "weekly" | "customDays";

export interface Reminders {
  daysBefore: number[];
  /** Pattern: `^([01]\d|2[0-3]):([0-5]\d)$`. */
  time?: string;
}

export interface RemovedMember {
  accountId: string;
  name: string;
}

export interface RestoreRequest {
  rev: number;
}

export interface Revision {
  rev: number;
  author?: RevisionAuthor | null;
  /** Format: date-time. */
  at: string;
  changes: FieldChange[];
  overwrote?: string[];
  restoredFrom?: number | null;
}

export interface RevisionAuthor {
  name: string;
}

export type Role = "owner" | "editor" | "viewer";

export interface SetMemberRoleRequest {
  role: MemberRole;
}

export interface SharingResponse {
  links?: LinkInfo[];
  invites?: InviteInfo[];
  members?: MemberInfo[];
  removed?: RemovedMember[];
}

export type SignInMethod = "apple" | "google" | "email";

export interface StorageBytes {
  media?: number;
  documents?: number;
}

export interface StorageFiles {
  still?: number;
  motion?: number;
  audio?: number;
}

export interface StorageReport {
  rows: StorageRow[];
  next?: string | null;
}

export interface StorageRow {
  accountId: string;
  displayName: string;
  plan: Plan;
  files: StorageFiles;
  bytes: StorageBytes;
  totalBytes: number;
  /** Format: date-time. */
  lastActiveAt: string;
}

export interface SyncManifest {
  events: ManifestEntry[];
}

export interface Theme {
  paletteId: string;
  cardStyle: string;
  typography: string;
  gradient?: string[] | null;
  size?: CardSize;
}

export interface TokenSignInRequest {
  provider: SignInMethod;
  idToken: string;
  nonce: string;
}

export type TrackTier = "free" | "premium";

export type UnitMode = "auto" | "days" | "weeks" | "hours" | "calendar" | "workdays";

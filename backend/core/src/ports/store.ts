// The Store port (BACKEND.md section 4, design D2): use-case level, one call is one transaction.
// Implementations: SqlStore over an SqlDriver (D1, node:sqlite, libSQL), FirestoreStore later, and
// MemoryStore for core tests. Every implementation must pass the store conformance suite
// (src/store/conformance.ts).
//
// The foundation set (tasks 3.2 to 3.4): accounts, event documents, patches with their revisions,
// tombstones and history pages. Task 3.5 added identities, email codes, sessions, the account usage
// counts and account deletion; task 3.6 the manifest, reads by role, the owned-event limit, memos with
// their child sequence and tombstones, and the members a reader sees; task 3.7 restore markers,
// pruning and display names; task 3.8 links, invites with join, and member changes. Later tasks add media
// (3.10), purchases (3.11), rate counters and the rest of the purge (3.13), grants, exports and
// devices (3.16 to 3.18). Times are Unix seconds.
import type { Plan, Role, SignInMethod } from '../contract/index.ts';
import type { JsonObject } from '../rules/merge.ts';

export interface AccountRecord {
  readonly id: string;
  readonly displayName: string;
  readonly plan: Plan;
  readonly planExpiresAt: number | null;
  readonly audioBlocked: boolean;
  readonly mediaBytes: number;
  readonly mediaFiles: number;
  readonly lastActiveAt: number;
  readonly inactiveNotice1At: number | null;
  readonly inactiveNotice2At: number | null;
  readonly createdAt: number;
}

export interface NewAccount {
  readonly id: string;
  readonly displayName: string;
  readonly now: number;
}

export type CreateAccountResult =
  | { readonly status: 'created'; readonly account: AccountRecord }
  | { readonly status: 'exists'; readonly account: AccountRecord };

export type AudioKind = 'library' | 'custom' | 'spotify';

export interface EventRecord {
  readonly id: string;
  readonly ownerId: string;
  readonly rev: number;
  /** Shared and owner-only fields; cleared fields are absent. */
  readonly doc: JsonObject;
  readonly audioKind: AudioKind | null;
  /** The account that set the current audio (the Spotify count goes by setter). */
  readonly audioSetBy: string | null;
  /** Custom audio: the library file the event uses. */
  readonly audioMediaId: string | null;
  readonly childSeq: number;
  readonly childPurgedSeq: number;
  readonly updatedAt: number;
  readonly deletedAt: number | null;
  /** Set when written by an import (design D20, task 12.1); null for normal creates. */
  readonly importedAt: number | null;
}

/** A new event, validated by the caller. It starts at rev 1 without a revision row. */
export interface NewEvent {
  readonly id: string;
  readonly ownerId: string;
  readonly doc: JsonObject;
  readonly now: number;
  /** The owner's owned-event limit (not deleted events); absent or null = no limit. */
  readonly maxOwned?: number | null;
}

export interface ImportMemoItem {
  readonly id: string;
  readonly doc: JsonObject;
}

export interface ImportEventItem {
  readonly id: string;
  readonly doc: JsonObject;
  readonly memos?: readonly ImportMemoItem[];
}

export interface ImportInput {
  readonly ownerId: string;
  readonly events: readonly ImportEventItem[];
  readonly now: number;
}

export interface ImportedEventSummary {
  readonly id: string;
  readonly unstoredFields: readonly string[];
}

export type ImportOutcome =
  | { readonly status: 'ok'; readonly imported: readonly ImportedEventSummary[] }
  | { readonly status: 'conflict' };

export type CreateEventResult =
  | { readonly status: 'created'; readonly event: EventRecord }
  /** The id exists with the same owner: the current record (repeating a create is safe). */
  | { readonly status: 'exists'; readonly event: EventRecord }
  /** The id belongs to another account. */
  | { readonly status: 'conflict' }
  /** The owner already has `maxOwned` events; nothing was written. */
  | { readonly status: 'limit' };

/** A validated patch by `authorId`, whose role the caller checked. */
export interface PatchInput {
  readonly eventId: string;
  readonly authorId: string;
  readonly baseRev: number;
  readonly patch: JsonObject;
  readonly now: number;
  /** Refuse (`too_large`) when the merged document is larger than this in UTF-8 JSON bytes. */
  readonly maxDocBytes?: number;
  /** A restore (task 3.7): the rev whose values the patch brings back, recorded as the revision's `restoredFrom`. */
  readonly restoredFrom?: number;
  /**
   * Keep only this many newest revisions of the event: older ones are deleted in the same write as the
   * new revision (BACKEND.md section 11.2, "Revisions kept"). Absent = keep all.
   */
  readonly keepRevisions?: number;
}

export type PatchOutcome =
  | {
      readonly status: 'ok';
      readonly event: EventRecord;
      /** The fields really changed; empty when the patch changed nothing (no new rev, no revision). */
      readonly applied: JsonObject;
      /** Changed fields that replaced a newer change by someone else (design D5), sorted. */
      readonly overwritten: readonly string[];
    }
  | { readonly status: 'not_found' }
  | { readonly status: 'deleted' }
  /** The merged document would exceed `maxDocBytes`; nothing was written. */
  | { readonly status: 'too_large' };

export interface RevisionRecord {
  readonly eventId: string;
  readonly rev: number;
  /** Null once the author deleted their account. */
  readonly authorId: string | null;
  readonly createdAt: number;
  readonly patch: JsonObject;
  readonly inverse: JsonObject;
  readonly overwrote: readonly string[];
  readonly restoredFrom: number | null;
}

export interface RevisionQuery {
  /** Only revisions below this rev; all when absent. */
  readonly before?: number;
  readonly limit: number;
}

// ---- Accounts (task 3.5) ----

/** A sign-in identity as a provider verified it. `subject` is the OIDC `sub`, or the normalized email. */
export interface IdentityInput {
  readonly provider: SignInMethod;
  readonly subject: string;
  /** Lower-case; null when the provider gave none. */
  readonly email: string | null;
  /** Only verified emails link identities to an existing account. */
  readonly emailVerified: boolean;
}

export interface IdentityRecord extends IdentityInput {
  readonly accountId: string;
  readonly createdAt: number;
}

export interface SignInInput {
  readonly identity: IdentityInput;
  /** Used only when no account matches: the id and display name of the account to create. */
  readonly newAccount: NewAccount;
}

/**
 * `existing`: the identity was known. `linked`: its verified email matched another identity's verified
 * email, and the identity joined that account. `created`: a new account with this identity.
 */
export interface SignInOutcome {
  readonly status: 'existing' | 'linked' | 'created';
  readonly account: AccountRecord;
}

export interface AddIdentityInput {
  readonly accountId: string;
  readonly identity: IdentityInput;
  readonly now: number;
}

/** `exists`: already this account's; `conflict`: the identity belongs to another account. */
export type AddIdentityOutcome = 'added' | 'exists' | 'conflict';

export interface EmailCodeInput {
  readonly emailHash: string;
  readonly codeMac: string;
  readonly expiresAt: number;
}

export interface SessionRecord {
  readonly tokenHash: string;
  readonly accountId: string;
  readonly createdAt: number;
  readonly lastUsedAt: number;
}

/** What an account uses of each counted plan limit (BACKEND.md section 11.1). */
export interface AccountUsage {
  /** Owned events, not deleted. */
  readonly events: number;
  /** Backdrop stills in use uploaded by the account. */
  readonly photos: number;
  /** Backdrop motion files in use uploaded by the account. */
  readonly animatedBackdrop: number;
  /** Custom audio files in the library or used by a day. */
  readonly customAudio: number;
  /** Events, not deleted, whose Spotify link the account set. */
  readonly spotifyEvents: number;
}

export type MediaKindValue = 'still' | 'motion' | 'audio';

export interface MediaRef {
  readonly id: string;
  readonly kind: MediaKindValue;
  readonly contentType: string;
}

/** What deleting an account removed, so the core can delete blob files and send notices. */
export interface AccountDeletion {
  /** Owned events, now tombstones with an empty document: their links answer 410 until the purge. */
  readonly ownedEventIds: readonly string[];
  /** Events the account was a member of. */
  readonly memberEventIds: readonly string[];
  /** Media rows removed: the account's uploads and the files of its owned events. */
  readonly media: readonly MediaRef[];
}

// ---- Members and reads by role (task 3.6; links, invites and join come with 3.8) ----

export type MemberRoleValue = 'viewer' | 'editor';

export interface MemberRecord {
  readonly eventId: string;
  readonly accountId: string;
  /** `removed` blocks rejoining. */
  readonly role: MemberRoleValue | 'removed';
  readonly inviteId: string | null;
  /** The member's own archive and reminders; never shown to others. */
  readonly archivedAt: number | null;
  readonly reminders: JsonObject | null;
  readonly createdAt: number;
}

export interface PutMemberInput {
  readonly eventId: string;
  readonly accountId: string;
  readonly role: MemberRoleValue | 'removed';
  readonly inviteId: string | null;
  readonly now: number;
}

export interface ManifestRow {
  readonly id: string;
  readonly rev: number;
  readonly role: Role;
  /** The owner's child sequence; 0 for members, who never see memos. */
  readonly childSeq: number;
}

/** A display name and role of a person on an event, for the member view. */
export interface PersonOnEvent {
  readonly name: string;
  readonly role: Role;
}

/** An event as one reader may see it. */
export interface ReaderEvent {
  readonly event: EventRecord;
  readonly role: Role;
  /** Members only: the reader's own membership. */
  readonly membership: MemberRecord | null;
  /** Members only: the owner and the members (not removed), owner first, then by joining time. */
  readonly people: readonly PersonOnEvent[];
}

// ---- Memos (task 3.6) ----

export interface MemoRecord {
  readonly id: string;
  readonly eventId: string;
  readonly authorId: string;
  /** The event's child sequence at the memo's last write. */
  readonly seq: number;
  /** content, milestoneTag, createdAt; empty once deleted. */
  readonly doc: JsonObject;
  readonly updatedAt: number;
  readonly deletedAt: number | null;
}

export interface PutMemoInput {
  readonly eventId: string;
  readonly memoId: string;
  readonly authorId: string;
  readonly doc: JsonObject;
  readonly now: number;
  /** Live memos an event may have. */
  readonly maxMemos: number;
}

export type PutMemoOutcome =
  | { readonly status: 'created'; readonly memo: MemoRecord }
  /** The id exists on this event: the current memo, tombstone included (repeating a create is safe). */
  | { readonly status: 'exists'; readonly memo: MemoRecord }
  /** The id is used on another event. */
  | { readonly status: 'conflict' }
  | { readonly status: 'limit' }
  /** The event is unknown or deleted. */
  | { readonly status: 'event_missing' };

export interface PatchMemoInput {
  readonly eventId: string;
  readonly memoId: string;
  readonly patch: JsonObject;
  readonly now: number;
}

export type MemoWriteOutcome =
  /** `changed` false: the patch changed nothing and the seq stayed. */
  | { readonly status: 'ok'; readonly memo: MemoRecord; readonly changed: boolean }
  /** Unknown on this event, or deleted. */
  | { readonly status: 'not_found' };

export interface ChildrenPage {
  /** Live memos and tombstones with a seq above the asked one, by seq. */
  readonly memos: readonly MemoRecord[];
  readonly seq: number;
  /** Highest seq of purged tombstones: a client behind it must reset. */
  readonly purgedSeq: number;
}

// ---- Sharing (task 3.8) ----

/** A public, view-only link. The token is stored in clear (design D10). */
export interface LinkRecord {
  readonly id: string;
  readonly token: string;
  readonly eventId: string;
  readonly label: string | null;
  readonly createdAt: number;
  /** Null = never. */
  readonly expiresAt: number | null;
  readonly revokedAt: number | null;
}

export interface NewLink {
  readonly id: string;
  readonly token: string;
  readonly eventId: string;
  readonly label: string | null;
  readonly expiresAt: number | null;
  readonly now: number;
  /** Active links (not revoked, not expired at `now`) the event may have. */
  readonly maxActive: number;
}

export type CreateLinkOutcome =
  | { readonly status: 'created'; readonly link: LinkRecord }
  /** The event has `maxActive` active links; nothing was written. */
  | { readonly status: 'limit' }
  /** The id or token is taken: the caller retries with new ones. */
  | { readonly status: 'taken' };

/** Changes to a link; an absent member stays as it is. */
export interface LinkChanges {
  readonly label?: string | null;
  readonly expiresAt?: number | null;
}

/** An invite link. The token is stored as SHA-256 hex and as AES-GCM ciphertext (design D10). */
export interface InviteRecord {
  readonly id: string;
  readonly tokenHash: string;
  readonly tokenEnc: string;
  readonly eventId: string;
  readonly role: MemberRoleValue;
  /** Null = unlimited. */
  readonly maxUses: number | null;
  readonly useCount: number;
  readonly createdAt: number;
  readonly expiresAt: number | null;
  readonly revokedAt: number | null;
}

export interface NewInvite {
  readonly id: string;
  readonly tokenHash: string;
  readonly tokenEnc: string;
  readonly eventId: string;
  readonly role: MemberRoleValue;
  readonly maxUses: number | null;
  readonly expiresAt: number | null;
  readonly now: number;
  /** Active invites (not revoked, not expired at `now`; full ones count) the event may have. */
  readonly maxActive: number;
}

export type CreateInviteOutcome =
  | { readonly status: 'created'; readonly invite: InviteRecord }
  | { readonly status: 'limit' }
  | { readonly status: 'taken' };

export interface InviteChanges {
  readonly role?: MemberRoleValue;
  readonly maxUses?: number | null;
  readonly expiresAt?: number | null;
}

export interface JoinInput {
  readonly tokenHash: string;
  readonly accountId: string;
  readonly now: number;
  /** Members (viewers and editors) an event may have. */
  readonly maxMembers: number;
}

/**
 * What opening or joining an invite means for one account (`inviteAccess` in records.ts decides it the
 * same way for every store). `joined`: the account became a member and one use was taken. `owner`,
 * `member`: nothing changes and no use is taken. The others refuse.
 */
export type InviteAccess = 'open' | 'owner' | 'member' | 'removed' | 'revoked' | 'expired' | 'full' | 'deleted' | 'members_limit';

export type JoinOutcome =
  | { readonly status: 'not_found' }
  | { readonly status: 'joined'; readonly invite: InviteRecord; readonly member: MemberRecord }
  | { readonly status: Exclude<InviteAccess, 'open'>; readonly invite: InviteRecord };

/** A person on an event as the owner's sharing screen lists them, removed ones included. */
export interface MemberListing {
  readonly accountId: string;
  readonly name: string;
  readonly role: MemberRoleValue | 'removed';
  readonly inviteId: string | null;
  readonly createdAt: number;
}

export interface Store {
  /** Creates an account, or returns the existing one with that id. */
  createAccount(input: NewAccount): Promise<CreateAccountResult>;
  getAccount(id: string): Promise<AccountRecord | null>;

  createEvent(input: NewEvent): Promise<CreateEventResult>;
  /**
   * Imports local events and their memos atomically (design D20, task 12.1): skips the owned-event limit,
   * marks written events with `imported_at`, and is idempotent by event id (identical content succeeds,
   * conflicting content fails the whole import with `conflict`).
   */
  importEvents(input: ImportInput): Promise<ImportOutcome>;
  /** The event, tombstoned ones included; null when the id is unknown. */
  getEvent(id: string): Promise<EventRecord | null>;
  /**
   * Applies a patch with the event rules of `:core:model` (archiving clears the pin), bumps the rev,
   * appends the revision `{patch, inverse, overwrote}` and returns the overwritten fields. Concurrent
   * patches are applied one after another; none is lost.
   */
  applyPatch(input: PatchInput): Promise<PatchOutcome>;
  /** Tombstones an event. False when it is unknown or already deleted. */
  deleteEvent(eventId: string, now: number): Promise<boolean>;
  /** Revisions of an event, newest first. */
  listRevisions(eventId: string, query: RevisionQuery): Promise<RevisionRecord[]>;
  /** Display names of the accounts of `ids` that exist (history authors, sharing lists). */
  displayNames(ids: readonly string[]): Promise<ReadonlyMap<string, string>>;

  // Accounts (task 3.5)

  /**
   * Signs in with a verified identity: the identity's account; else, for a verified email, the account
   * of the oldest verified identity with that email (the identity joins it); else a new account.
   * Concurrent first sign-ins of one identity end in one account.
   */
  signIn(input: SignInInput): Promise<SignInOutcome>;
  /** Adds a sign-in method to an account. */
  addIdentity(input: AddIdentityInput): Promise<AddIdentityOutcome>;
  /** The account's identities, oldest first. */
  listIdentities(accountId: string): Promise<IdentityRecord[]>;
  updateDisplayName(accountId: string, displayName: string): Promise<AccountRecord | null>;
  usage(accountId: string): Promise<AccountUsage>;
  /**
   * Deletes an account (BACKEND.md section 8): owned events become tombstones with an empty document,
   * and their revisions, memos, invites, members and media go (links stay and answer 410); the account's memberships, uploads, identities,
   * sessions, grants, exports and devices go; revisions it wrote on other events keep a null author.
   * Null when the account is unknown.
   */
  deleteAccount(accountId: string, now: number): Promise<AccountDeletion | null>;

  /** Stores the code of an email address, replacing an earlier one with a fresh attempt count. */
  putEmailCode(input: EmailCodeInput): Promise<void>;
  /**
   * Counts one attempt and returns the code MAC to compare, or null when there is no live code
   * (none, expired at `now`, or out of its `maxAttempts`). Counting before comparing keeps parallel
   * guesses inside the limit.
   */
  takeEmailCodeAttempt(emailHash: string, now: number, maxAttempts: number): Promise<string | null>;
  /** Deletes the code if it still has this MAC; true when it did, so a code signs in once. */
  consumeEmailCode(emailHash: string, codeMac: string): Promise<boolean>;

  createSession(session: SessionRecord): Promise<void>;
  getSession(tokenHash: string): Promise<SessionRecord | null>;
  /**
   * Records signed-in use: the session's `last_used_at`, and the account's `last_active_at` with its
   * inactive notices cleared. The caller does this at most once a day per session.
   */
  markActive(tokenHash: string, accountId: string, now: number): Promise<void>;
  /** Ends a session. False when it is unknown. */
  deleteSession(tokenHash: string): Promise<boolean>;

  // Sync (task 3.6)

  /** Owned events and events the account is a viewer or editor of, not deleted, by id. */
  manifest(accountId: string): Promise<ManifestRow[]>;
  /** The events of `ids` the account owns or is a viewer or editor of, deleted ones included, in no particular order. */
  readEvents(accountId: string, ids: readonly string[]): Promise<ReaderEvent[]>;
  /** Adds or changes a membership; a new row keeps no archive or reminders. */
  putMember(input: PutMemberInput): Promise<void>;
  getMember(eventId: string, accountId: string): Promise<MemberRecord | null>;

  /** Creates a memo and bumps the event's child sequence. */
  putMemo(input: PutMemoInput): Promise<PutMemoOutcome>;
  /** Merges a validated patch into a memo (null clears); a change bumps the child sequence. */
  patchMemo(input: PatchMemoInput): Promise<MemoWriteOutcome>;
  /** Tombstones a memo: empty document, `deleted_at`, a new seq. */
  deleteMemo(eventId: string, memoId: string, now: number): Promise<MemoWriteOutcome>;
  getMemo(memoId: string): Promise<MemoRecord | null>;
  // Sharing (task 3.8)

  /** Creates a public link unless the event already has `maxActive` active links. */
  createLink(input: NewLink): Promise<CreateLinkOutcome>;
  getLink(id: string): Promise<LinkRecord | null>;
  getLinkByToken(token: string): Promise<LinkRecord | null>;
  /** The event's active links (not revoked, not expired at `now`), oldest first. */
  listLinks(eventId: string, now: number): Promise<LinkRecord[]>;
  /** Changes a link while it is active at `now`; returns the link as stored afterwards, null when unknown. */
  updateLink(id: string, changes: LinkChanges, now: number): Promise<LinkRecord | null>;
  /** Revokes a link for good. False when it is unknown or already revoked. */
  revokeLink(id: string, now: number): Promise<boolean>;

  /** Creates an invite unless the event already has `maxActive` active invites. */
  createInvite(input: NewInvite): Promise<CreateInviteOutcome>;
  getInvite(id: string): Promise<InviteRecord | null>;
  getInviteByHash(tokenHash: string): Promise<InviteRecord | null>;
  /** The event's active invites (not revoked, not expired at `now`, full ones included), oldest first. */
  listInvites(eventId: string, now: number): Promise<InviteRecord[]>;
  /** Changes an invite while it is active at `now`; returns the invite as stored afterwards, null when unknown. */
  updateInvite(id: string, changes: InviteChanges, now: number): Promise<InviteRecord | null>;
  /** Revokes an invite for good. False when it is unknown or already revoked. */
  revokeInvite(id: string, now: number): Promise<boolean>;
  /**
   * Joins an event through an invite: when its state for the account is `open`, adds the account as a
   * member with the invite's role and takes one use, atomically, so concurrent joins never pass
   * `maxUses` or `maxMembers`. Owners, members and refused states write nothing.
   */
  joinInvite(input: JoinInput): Promise<JoinOutcome>;

  /** Members and removed members of an event with their display names, by joining time. */
  listMembers(eventId: string): Promise<MemberListing[]>;
  /** Changes the role of a viewer or editor. False when the account is not one. */
  setMemberRole(eventId: string, accountId: string, role: MemberRoleValue): Promise<boolean>;
  /** Removes a viewer or editor and blocks rejoining (`removed`). False when the account is not one. */
  removeMember(eventId: string, accountId: string): Promise<boolean>;
  /**
   * Deletes a membership row: `active` for a viewer or editor who leaves, `removed` to lift a block
   * ("allow again"). False when there was no such row.
   */
  deleteMember(eventId: string, accountId: string, which: 'active' | 'removed'): Promise<boolean>;

  /** Memo changes after `after`; null when the event is unknown. */
  listChildren(eventId: string, after: number): Promise<ChildrenPage | null>;
  /** All live memos of an event, by seq (a reset). */
  listMemos(eventId: string): Promise<MemoRecord[]>;
  /**
   * Removes memo tombstones deleted before `before` (at most `limit`) and raises each event's
   * `child_purged_seq` to the highest seq removed. Returns how many it removed. Used by the daily job.
   */
  purgeMemoTombstones(before: number, limit: number): Promise<number>;
}

/** The store could not apply a write after retrying (heavy contention); the core answers 503. */
export class StoreBusyError extends Error {
  constructor() {
    super('store busy');
    this.name = 'StoreBusyError';
  }
}

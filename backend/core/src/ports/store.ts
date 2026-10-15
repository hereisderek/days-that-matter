// The Store port (BACKEND.md section 4, design D2): use-case level, one call is one transaction.
// Implementations: SqlStore over an SqlDriver (D1, node:sqlite, libSQL), FirestoreStore later, and
// MemoryStore for core tests. Every implementation must pass the store conformance suite
// (src/store/conformance.ts).
//
// This is the foundation set (tasks 3.2 to 3.4): accounts, event documents, patches with their
// revisions, tombstones and history pages. Later tasks add identities and sessions (3.5), memos and the
// manifest (3.6), restore and pruning (3.7), links, invites and members (3.8), media (3.10),
// purchases (3.11), rate counters and purge (3.13), grants, exports and devices (3.16 to 3.18).
// Times are Unix seconds.
import type { Plan } from '../contract/index.ts';
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
}

/** A new event, validated by the caller. It starts at rev 1 without a revision row. */
export interface NewEvent {
  readonly id: string;
  readonly ownerId: string;
  readonly doc: JsonObject;
  readonly now: number;
}

export type CreateEventResult =
  | { readonly status: 'created'; readonly event: EventRecord }
  /** The id exists with the same owner: the current record (repeating a create is safe). */
  | { readonly status: 'exists'; readonly event: EventRecord }
  /** The id belongs to another account. */
  | { readonly status: 'conflict' };

/** A validated patch by `authorId`, whose role the caller checked. */
export interface PatchInput {
  readonly eventId: string;
  readonly authorId: string;
  readonly baseRev: number;
  readonly patch: JsonObject;
  readonly now: number;
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
  | { readonly status: 'deleted' };

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

export interface Store {
  /** Creates an account, or returns the existing one with that id. */
  createAccount(input: NewAccount): Promise<CreateAccountResult>;
  getAccount(id: string): Promise<AccountRecord | null>;

  createEvent(input: NewEvent): Promise<CreateEventResult>;
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
}

/** The store could not apply a write after retrying (heavy contention); the core answers 503. */
export class StoreBusyError extends Error {
  constructor() {
    super('store busy');
    this.name = 'StoreBusyError';
  }
}

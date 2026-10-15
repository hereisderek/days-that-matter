// Rules every Store implementation shares, so SqlStore, MemoryStore and later FirestoreStore derive
// the same columns and outcomes.
import type { Json, JsonObject } from '../rules/merge.ts';
import { isJsonObject } from '../rules/merge.ts';
import type { AudioKind, InviteAccess, InviteRecord } from '../ports/store.ts';

export interface AudioColumns {
  readonly audioKind: AudioKind | null;
  readonly audioSetBy: string | null;
  readonly audioMediaId: string | null;
}

/** The audio columns of an event whose `audio` field was set by `setter` (BACKEND.md sections 6.1 and 10.4). */
export function audioColumns(doc: JsonObject, setter: string): AudioColumns {
  const audio = doc['audio'];
  if (!isJsonObject(audio)) return { audioKind: null, audioSetBy: null, audioMediaId: null };
  const kind = audio['kind'];
  const audioKind = kind === 'library' || kind === 'custom' || kind === 'spotify' ? kind : null;
  const mediaId = audioKind === 'custom' && typeof audio['mediaId'] === 'string' ? audio['mediaId'] : null;
  return { audioKind, audioSetBy: audioKind === null ? null : setter, audioMediaId: mediaId };
}

/** Attempts of an optimistic write before the store reports StoreBusyError. */
export const WRITE_ATTEMPTS = 20;

/** A deep copy of a JSON value, so callers never share a store's state. */
export function copyJson<T extends Json>(value: T): T {
  return structuredClone(value);
}

/** Size of a stored event document: UTF-8 bytes of its JSON (EventValidation.checkDocumentSize). */
export function docBytes(doc: JsonObject): number {
  return new TextEncoder().encode(JSON.stringify(doc)).byteLength;
}

/** A document without its null members: null means absent in stored documents. */
export function withoutNulls(doc: JsonObject): JsonObject {
  return Object.fromEntries(Object.entries(doc).filter(([, v]) => v !== null));
}

/** Seconds in a day: activity and session use are written at most once per day. */
export const DAY_SECONDS = 86_400;

/** True while a link or invite is usable at `now`: not revoked and not past its expiry. */
export function isActive(x: { readonly revokedAt: number | null; readonly expiresAt: number | null }, now: number): boolean {
  return x.revokedAt === null && (x.expiresAt === null || x.expiresAt > now);
}

/**
 * What an invite means for `accountId` at `now` (event-sharing spec, design D11), the same in every
 * store and in the core. The event comes first (deleted), then who the account is (owner, member,
 * removed: owners and members open the event whatever the invite's state), then the invite itself
 * (revoked, expired, full) and the event's member limit.
 */
export function inviteAccess(
  invite: InviteRecord,
  event: { readonly ownerId: string; readonly deletedAt: number | null },
  member: { readonly role: string } | null,
  accountId: string,
  now: number,
  activeMembers: number,
  maxMembers: number,
): InviteAccess {
  if (event.deletedAt !== null) return 'deleted';
  if (event.ownerId === accountId) return 'owner';
  if (member !== null) return member.role === 'removed' ? 'removed' : 'member';
  if (invite.revokedAt !== null) return 'revoked';
  if (invite.expiresAt !== null && invite.expiresAt <= now) return 'expired';
  if (invite.maxUses !== null && invite.useCount >= invite.maxUses) return 'full';
  if (activeMembers >= maxMembers) return 'members_limit';
  return 'open';
}

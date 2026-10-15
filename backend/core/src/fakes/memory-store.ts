// In-memory Store for core tests. It passes the same conformance suite as SqlStore. Every method works
// on its maps without awaiting in between, so each call is atomic. It has no media, grants, exports or
// devices yet: those counts read as zero.
import { applyEventPatch, applyPatch, overwrittenFields } from '../rules/merge.ts';
import type { JsonObject } from '../rules/merge.ts';
import type {
  AccountDeletion,
  AccountRecord,
  AccountUsage,
  AddIdentityInput,
  AddIdentityOutcome,
  ChildrenPage,
  CreateAccountResult,
  CreateEventResult,
  EmailCodeInput,
  EventRecord,
  IdentityRecord,
  ManifestRow,
  MemberRecord,
  MemoRecord,
  MemoWriteOutcome,
  NewAccount,
  NewEvent,
  PatchInput,
  PatchMemoInput,
  PatchOutcome,
  PersonOnEvent,
  PutMemberInput,
  PutMemoInput,
  PutMemoOutcome,
  ReaderEvent,
  RevisionQuery,
  RevisionRecord,
  SessionRecord,
  SignInInput,
  SignInOutcome,
  Store,
} from '../ports/store.ts';
import { audioColumns, copyJson, docBytes } from '../store/records.ts';

interface EmailCode {
  codeMac: string;
  expiresAt: number;
  attempts: number;
}

export class MemoryStore implements Store {
  readonly #accounts = new Map<string, AccountRecord>();
  readonly #events = new Map<string, EventRecord>();
  readonly #revisions = new Map<string, RevisionRecord[]>();
  readonly #identities = new Map<string, IdentityRecord>();
  readonly #emailCodes = new Map<string, EmailCode>();
  readonly #sessions = new Map<string, SessionRecord>();
  readonly #members = new Map<string, MemberRecord>();
  readonly #memos = new Map<string, MemoRecord>();
  /** `events.first_upload_at`, which EventRecord does not carry. */
  readonly #firstUploads = new Map<string, number>();

  async createAccount(input: NewAccount): Promise<CreateAccountResult> {
    const existing = this.#accounts.get(input.id);
    if (existing) return { status: 'exists', account: { ...existing } };
    const account = this.#newAccount(input);
    return { status: 'created', account: { ...account } };
  }

  async getAccount(id: string): Promise<AccountRecord | null> {
    const account = this.#accounts.get(id);
    return account ? { ...account } : null;
  }

  async createEvent(input: NewEvent): Promise<CreateEventResult> {
    const existing = this.#events.get(input.id);
    if (existing) {
      return existing.ownerId === input.ownerId ? { status: 'exists', event: copyEvent(existing) } : { status: 'conflict' };
    }
    const first = input.firstUpload !== undefined && this.#firstUploadCount(input.ownerId, input.firstUpload.since) < input.firstUpload.max;
    const within = input.maxOwned === undefined || input.maxOwned === null || this.#ownedCount(input.ownerId) < input.maxOwned;
    if (!first && !within) return { status: 'limit' };
    if (first) this.#firstUploads.set(input.id, input.now);
    const event: EventRecord = {
      id: input.id,
      ownerId: input.ownerId,
      rev: 1,
      doc: copyJson(input.doc),
      ...audioColumns(input.doc, input.ownerId),
      childSeq: 0,
      childPurgedSeq: 0,
      updatedAt: input.now,
      deletedAt: null,
    };
    this.#events.set(event.id, event);
    return { status: 'created', event: copyEvent(event) };
  }

  async getEvent(id: string): Promise<EventRecord | null> {
    const event = this.#events.get(id);
    return event ? copyEvent(event) : null;
  }

  async applyPatch(input: PatchInput): Promise<PatchOutcome> {
    const current = this.#events.get(input.eventId);
    if (!current) return { status: 'not_found' };
    if (current.deletedAt !== null) return { status: 'deleted' };
    const result = applyEventPatch(current.doc, copyJson(input.patch));
    const changed = Object.keys(result.applied);
    if (changed.length === 0) return { status: 'ok', event: copyEvent(current), applied: {}, overwritten: [] };
    if (input.maxDocBytes !== undefined && docBytes(result.doc) > input.maxDocBytes) return { status: 'too_large' };
    const revisions = this.#revisions.get(input.eventId) ?? [];
    const overwritten = overwrittenFields(
      changed,
      input.baseRev,
      revisions.map((r) => ({ rev: r.rev, authorId: r.authorId, fields: Object.keys(r.patch) })),
      input.authorId,
    );
    const rev = current.rev + 1;
    const event: EventRecord = {
      ...current,
      ...('audio' in result.applied ? audioColumns(result.doc, input.authorId) : {}),
      rev,
      doc: result.doc,
      updatedAt: input.now,
    };
    this.#events.set(event.id, event);
    const appended: RevisionRecord[] = [
      ...revisions,
      {
        eventId: input.eventId,
        rev,
        authorId: input.authorId,
        createdAt: input.now,
        patch: result.applied,
        inverse: result.inverse,
        overwrote: overwritten,
        restoredFrom: input.restoredFrom ?? null,
      },
    ];
    const keep = input.keepRevisions;
    this.#revisions.set(input.eventId, keep === undefined ? appended : appended.filter((r) => r.rev > rev - keep));
    return { status: 'ok', event: copyEvent(event), applied: copyJson(result.applied), overwritten };
  }

  async deleteEvent(eventId: string, now: number): Promise<boolean> {
    const event = this.#events.get(eventId);
    if (!event || event.deletedAt !== null) return false;
    this.#events.set(eventId, { ...event, deletedAt: now, updatedAt: now });
    return true;
  }

  async listRevisions(eventId: string, query: RevisionQuery): Promise<RevisionRecord[]> {
    const before = query.before ?? Number.MAX_SAFE_INTEGER;
    return (this.#revisions.get(eventId) ?? [])
      .filter((r) => r.rev < before)
      .sort((a, b) => b.rev - a.rev)
      .slice(0, query.limit)
      .map((r) => ({ ...r, patch: copyJson(r.patch), inverse: copyJson(r.inverse), overwrote: [...r.overwrote] }));
  }

  async displayNames(ids: readonly string[]): Promise<ReadonlyMap<string, string>> {
    const out = new Map<string, string>();
    for (const id of ids) {
      const account = this.#accounts.get(id);
      if (account) out.set(id, account.displayName);
    }
    return out;
  }

  // ---- Accounts ----

  async signIn(input: SignInInput): Promise<SignInOutcome> {
    const { identity, newAccount } = input;
    const known = this.#identities.get(identityKey(identity.provider, identity.subject));
    if (known) return { status: 'existing', account: { ...(this.#accounts.get(known.accountId) as AccountRecord) } };
    const match = identity.emailVerified && identity.email !== null ? this.#verifiedEmailOwner(identity.email) : null;
    const account = match ?? this.#newAccount(newAccount);
    this.#identities.set(identityKey(identity.provider, identity.subject), { ...identity, accountId: account.id, createdAt: newAccount.now });
    return { status: match ? 'linked' : 'created', account: { ...account } };
  }

  async addIdentity(input: AddIdentityInput): Promise<AddIdentityOutcome> {
    const key = identityKey(input.identity.provider, input.identity.subject);
    const known = this.#identities.get(key);
    if (known) return known.accountId === input.accountId ? 'exists' : 'conflict';
    this.#identities.set(key, { ...input.identity, accountId: input.accountId, createdAt: input.now });
    return 'added';
  }

  async listIdentities(accountId: string): Promise<IdentityRecord[]> {
    return [...this.#identities.values()]
      .filter((i) => i.accountId === accountId)
      .sort((a, b) => a.createdAt - b.createdAt || compare(a.provider, b.provider) || compare(a.subject, b.subject))
      .map((i) => ({ ...i }));
  }

  async updateDisplayName(accountId: string, displayName: string): Promise<AccountRecord | null> {
    const account = this.#accounts.get(accountId);
    if (!account) return null;
    const updated = { ...account, displayName };
    this.#accounts.set(accountId, updated);
    return { ...updated };
  }

  async usage(accountId: string): Promise<AccountUsage> {
    let spotifyEvents = 0;
    for (const e of this.#events.values()) {
      if (e.deletedAt === null && e.audioKind === 'spotify' && e.audioSetBy === accountId) spotifyEvents++;
    }
    return { events: this.#ownedCount(accountId), photos: 0, animatedBackdrop: 0, customAudio: 0, spotifyEvents };
  }

  async deleteAccount(accountId: string, now: number): Promise<AccountDeletion | null> {
    if (!this.#accounts.has(accountId)) return null;
    const ownedEventIds: string[] = [];
    for (const e of this.#events.values()) {
      if (e.ownerId !== accountId) continue;
      ownedEventIds.push(e.id);
      this.#events.set(e.id, { ...e, doc: {}, deletedAt: e.deletedAt ?? now, updatedAt: now });
      this.#revisions.delete(e.id);
      for (const [id, m] of this.#memos) if (m.eventId === e.id) this.#memos.delete(id);
      for (const [key, m] of this.#members) if (m.eventId === e.id) this.#members.delete(key);
    }
    const memberEventIds: string[] = [];
    for (const [key, m] of this.#members) {
      if (m.accountId !== accountId) continue;
      if (m.role !== 'removed') memberEventIds.push(m.eventId);
      this.#members.delete(key);
    }
    for (const [eventId, revisions] of this.#revisions) {
      this.#revisions.set(eventId, revisions.map((r) => (r.authorId === accountId ? { ...r, authorId: null } : r)));
    }
    for (const [key, i] of this.#identities) if (i.accountId === accountId) this.#identities.delete(key);
    for (const [key, s] of this.#sessions) if (s.accountId === accountId) this.#sessions.delete(key);
    this.#accounts.delete(accountId);
    return { ownedEventIds: ownedEventIds.sort(), memberEventIds: memberEventIds.sort(), media: [] };
  }

  async putEmailCode(input: EmailCodeInput): Promise<void> {
    this.#emailCodes.set(input.emailHash, { codeMac: input.codeMac, expiresAt: input.expiresAt, attempts: 0 });
  }

  async takeEmailCodeAttempt(emailHash: string, now: number, maxAttempts: number): Promise<string | null> {
    const code = this.#emailCodes.get(emailHash);
    if (!code || code.expiresAt <= now || code.attempts >= maxAttempts) return null;
    code.attempts++;
    return code.codeMac;
  }

  async consumeEmailCode(emailHash: string, codeMac: string): Promise<boolean> {
    if (this.#emailCodes.get(emailHash)?.codeMac !== codeMac) return false;
    return this.#emailCodes.delete(emailHash);
  }

  async createSession(session: SessionRecord): Promise<void> {
    this.#sessions.set(session.tokenHash, { ...session });
  }

  async getSession(tokenHash: string): Promise<SessionRecord | null> {
    const session = this.#sessions.get(tokenHash);
    return session ? { ...session } : null;
  }

  async markActive(tokenHash: string, accountId: string, now: number): Promise<void> {
    const session = this.#sessions.get(tokenHash);
    if (session) this.#sessions.set(tokenHash, { ...session, lastUsedAt: now });
    const account = this.#accounts.get(accountId);
    if (account) this.#accounts.set(accountId, { ...account, lastActiveAt: now, inactiveNotice1At: null, inactiveNotice2At: null });
  }

  async deleteSession(tokenHash: string): Promise<boolean> {
    return this.#sessions.delete(tokenHash);
  }

  // ---- Sync ----

  async manifest(accountId: string): Promise<ManifestRow[]> {
    const rows: ManifestRow[] = [];
    for (const e of this.#events.values()) {
      if (e.deletedAt !== null) continue;
      if (e.ownerId === accountId) {
        rows.push({ id: e.id, rev: e.rev, role: 'owner', childSeq: e.childSeq });
      } else {
        const m = this.#members.get(memberKey(e.id, accountId));
        if (m && m.role !== 'removed') rows.push({ id: e.id, rev: e.rev, role: m.role, childSeq: 0 });
      }
    }
    return rows.sort((a, b) => compare(a.id, b.id));
  }

  async readEvents(accountId: string, ids: readonly string[]): Promise<ReaderEvent[]> {
    const out: ReaderEvent[] = [];
    for (const id of new Set(ids)) {
      const e = this.#events.get(id);
      if (!e) continue;
      if (e.ownerId === accountId) {
        out.push({ event: copyEvent(e), role: 'owner', membership: null, people: [] });
        continue;
      }
      const m = this.#members.get(memberKey(id, accountId));
      if (!m || m.role === 'removed') continue;
      out.push({ event: copyEvent(e), role: m.role, membership: copyMember(m), people: this.#people(e) });
    }
    return out;
  }

  async putMember(input: PutMemberInput): Promise<void> {
    const key = memberKey(input.eventId, input.accountId);
    const existing = this.#members.get(key);
    this.#members.set(
      key,
      existing
        ? { ...existing, role: input.role, inviteId: input.inviteId ?? existing.inviteId }
        : {
            eventId: input.eventId, accountId: input.accountId, role: input.role, inviteId: input.inviteId, archivedAt: null,
            reminders: null, createdAt: input.now,
          },
    );
  }

  async getMember(eventId: string, accountId: string): Promise<MemberRecord | null> {
    const m = this.#members.get(memberKey(eventId, accountId));
    return m ? copyMember(m) : null;
  }

  // ---- Memos ----

  async putMemo(input: PutMemoInput): Promise<PutMemoOutcome> {
    const existing = this.#memos.get(input.memoId);
    if (existing) return existing.eventId === input.eventId ? { status: 'exists', memo: copyMemo(existing) } : { status: 'conflict' };
    const event = this.#events.get(input.eventId);
    if (!event || event.deletedAt !== null) return { status: 'event_missing' };
    let live = 0;
    for (const m of this.#memos.values()) if (m.eventId === input.eventId && m.deletedAt === null) live++;
    if (live >= input.maxMemos) return { status: 'limit' };
    const seq = this.#bumpChildSeq(event);
    const memo: MemoRecord = {
      id: input.memoId, eventId: input.eventId, authorId: input.authorId, seq, doc: copyJson(input.doc), updatedAt: input.now,
      deletedAt: null,
    };
    this.#memos.set(memo.id, memo);
    return { status: 'created', memo: copyMemo(memo) };
  }

  async patchMemo(input: PatchMemoInput): Promise<MemoWriteOutcome> {
    const memo = this.#liveMemo(input.eventId, input.memoId);
    if (!memo) return { status: 'not_found' };
    const result = applyPatch(memo.doc, copyJson(input.patch));
    if (Object.keys(result.applied).length === 0) return { status: 'ok', memo: copyMemo(memo), changed: false };
    const seq = this.#bumpChildSeq(this.#events.get(input.eventId) as EventRecord);
    const updated: MemoRecord = { ...memo, doc: result.doc, seq, updatedAt: input.now };
    this.#memos.set(memo.id, updated);
    return { status: 'ok', memo: copyMemo(updated), changed: true };
  }

  async deleteMemo(eventId: string, memoId: string, now: number): Promise<MemoWriteOutcome> {
    const memo = this.#liveMemo(eventId, memoId);
    if (!memo) return { status: 'not_found' };
    const seq = this.#bumpChildSeq(this.#events.get(eventId) as EventRecord);
    const deleted: MemoRecord = { ...memo, doc: {}, seq, updatedAt: now, deletedAt: now };
    this.#memos.set(memoId, deleted);
    return { status: 'ok', memo: copyMemo(deleted), changed: true };
  }

  async getMemo(memoId: string): Promise<MemoRecord | null> {
    const memo = this.#memos.get(memoId);
    return memo ? copyMemo(memo) : null;
  }

  async listChildren(eventId: string, after: number): Promise<ChildrenPage | null> {
    const event = this.#events.get(eventId);
    if (!event) return null;
    const memos = [...this.#memos.values()].filter((m) => m.eventId === eventId && m.seq > after).sort((a, b) => a.seq - b.seq);
    return { memos: memos.map(copyMemo), seq: event.childSeq, purgedSeq: event.childPurgedSeq };
  }

  async listMemos(eventId: string): Promise<MemoRecord[]> {
    return [...this.#memos.values()]
      .filter((m) => m.eventId === eventId && m.deletedAt === null)
      .sort((a, b) => a.seq - b.seq)
      .map(copyMemo);
  }

  async purgeMemoTombstones(before: number, limit: number): Promise<number> {
    const old = [...this.#memos.values()]
      .filter((m) => m.deletedAt !== null && m.deletedAt < before)
      .sort((a, b) => (a.deletedAt as number) - (b.deletedAt as number) || compare(a.id, b.id))
      .slice(0, limit);
    for (const m of old) {
      this.#memos.delete(m.id);
      const event = this.#events.get(m.eventId);
      if (event && m.seq > event.childPurgedSeq) this.#events.set(event.id, { ...event, childPurgedSeq: m.seq });
    }
    return old.length;
  }

  // ---- Helpers ----

  #newAccount(input: NewAccount): AccountRecord {
    const account: AccountRecord = {
      id: input.id,
      displayName: input.displayName,
      plan: 'free',
      planExpiresAt: null,
      audioBlocked: false,
      mediaBytes: 0,
      mediaFiles: 0,
      lastActiveAt: input.now,
      inactiveNotice1At: null,
      inactiveNotice2At: null,
      createdAt: input.now,
    };
    this.#accounts.set(account.id, account);
    return account;
  }

  #verifiedEmailOwner(email: string): AccountRecord | null {
    const match = [...this.#identities.values()]
      .filter((i) => i.emailVerified && i.email === email)
      .sort((a, b) => a.createdAt - b.createdAt || compare(a.provider, b.provider) || compare(a.subject, b.subject))[0];
    return match ? (this.#accounts.get(match.accountId) ?? null) : null;
  }

  #firstUploadCount(ownerId: string, since: number): number {
    let n = 0;
    for (const [id, at] of this.#firstUploads) if (at >= since && this.#events.get(id)?.ownerId === ownerId) n++;
    return n;
  }

  #ownedCount(ownerId: string): number {
    let n = 0;
    for (const e of this.#events.values()) if (e.ownerId === ownerId && e.deletedAt === null) n++;
    return n;
  }

  #people(event: EventRecord): PersonOnEvent[] {
    const owner = this.#accounts.get(event.ownerId);
    const people: PersonOnEvent[] = owner ? [{ name: owner.displayName, role: 'owner' }] : [];
    const members = [...this.#members.values()]
      .filter((m) => m.eventId === event.id && m.role !== 'removed')
      .sort((a, b) => a.createdAt - b.createdAt || compare(a.accountId, b.accountId));
    for (const m of members) {
      const account = this.#accounts.get(m.accountId);
      if (account && m.role !== 'removed') people.push({ name: account.displayName, role: m.role });
    }
    return people;
  }

  #liveMemo(eventId: string, memoId: string): MemoRecord | null {
    const memo = this.#memos.get(memoId);
    const event = this.#events.get(eventId);
    if (!memo || memo.eventId !== eventId || memo.deletedAt !== null || !event || event.deletedAt !== null) return null;
    return memo;
  }

  #bumpChildSeq(event: EventRecord): number {
    const seq = event.childSeq + 1;
    this.#events.set(event.id, { ...event, childSeq: seq });
    return seq;
  }
}

function identityKey(provider: string, subject: string): string {
  return `${provider}\u0000${subject}`;
}

function memberKey(eventId: string, accountId: string): string {
  return `${eventId}\u0000${accountId}`;
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function copyEvent(event: EventRecord): EventRecord {
  return { ...event, doc: copyJson(event.doc) };
}

function copyMemo(memo: MemoRecord): MemoRecord {
  return { ...memo, doc: copyJson(memo.doc) };
}

function copyMember(m: MemberRecord): MemberRecord {
  return { ...m, reminders: m.reminders === null ? null : copyJson(m.reminders as JsonObject) };
}

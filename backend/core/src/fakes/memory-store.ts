// In-memory Store for core tests. It passes the same conformance suite as SqlStore. Every method works
// on its maps without awaiting in between, so each call is atomic.
import { applyEventPatch, overwrittenFields } from '../rules/merge.ts';
import type {
  AccountRecord,
  CreateAccountResult,
  CreateEventResult,
  EventRecord,
  NewAccount,
  NewEvent,
  PatchInput,
  PatchOutcome,
  RevisionQuery,
  RevisionRecord,
  Store,
} from '../ports/store.ts';
import { audioColumns, copyJson } from '../store/records.ts';

export class MemoryStore implements Store {
  readonly #accounts = new Map<string, AccountRecord>();
  readonly #events = new Map<string, EventRecord>();
  readonly #revisions = new Map<string, RevisionRecord[]>();

  async createAccount(input: NewAccount): Promise<CreateAccountResult> {
    const existing = this.#accounts.get(input.id);
    if (existing) return { status: 'exists', account: { ...existing } };
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
    this.#revisions.set(input.eventId, [
      ...revisions,
      {
        eventId: input.eventId,
        rev,
        authorId: input.authorId,
        createdAt: input.now,
        patch: result.applied,
        inverse: result.inverse,
        overwrote: overwritten,
        restoredFrom: null,
      },
    ]);
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
}

function copyEvent(event: EventRecord): EventRecord {
  return { ...event, doc: copyJson(event.doc) };
}

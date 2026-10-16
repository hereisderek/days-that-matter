// Sync (task 3.6, design D5 and D6, BACKEND.md sections 7.3 and 7.4): the manifest, batch fetch,
// create with the owned-event limit, field-level patches with revisions, delete, and memos as event
// children with tombstones. Writes are validated with the rules from :core:model (rules/validation.ts)
// and checked against the writer's role; documents leave the core projected by the reader's role.
import { authenticate } from '../auth/session.ts';
import type { Session } from '../auth/session.ts';
import { sha256Hex } from '../auth/crypto.ts';
import { LIMITS, PLANS } from '../contract/index.ts';
import type { ApiErrorBody, ChildrenResponse, EventDoc, Feature, ManifestEntry, Memo, MemoChange, PatchResponse, Plan, SyncManifest } from '../contract/index.ts';
import { nowSeconds } from '../ports/clock.ts';
import type { Ports } from '../ports/index.ts';
import type { MemoRecord, ReaderEvent } from '../ports/store.ts';
import type { RemoteConfigDocument } from '../remote-config/types.ts';
import { isJsonObject } from '../rules/merge.ts';
import type { JsonObject } from '../rules/merge.ts';
import { effectivePlan, resolvePlanLimit } from '../rules/plan.ts';
import type { FieldError } from '../rules/validation.ts';
import {
  MEMO_WRITABLE,
  OWNER_ONLY_FIELDS,
  SHARED_FIELDS,
  WRITABLE,
  checkDocumentSize,
  isoSeconds,
  validateEventPatch,
  validateMemoPatch,
  validateNewEvent,
  validateNewMemo,
} from '../rules/validation.ts';
import { withoutNulls } from '../store/records.ts';
import type { Handler, RequestContext } from './app.ts';
import { readJsonObject } from './body.ts';
import { ApiError, invalidPayload, notFound } from './errors.ts';
import { isUuid, onlyFields, valid } from './input.ts';
import { API } from './paths.ts';
import type { Route } from './router.ts';
import { emptyResponse, jsonResponse } from './types.ts';
import type { HttpResponse } from './types.ts';

export const NO_STORE = { 'Cache-Control': 'no-store' };
const MAX_FETCH_IDS = 100;

export const forbidden = (): ApiError => new ApiError('forbidden', 'Not allowed for your role');
export const deleted = (): ApiError => new ApiError('deleted', 'This day was deleted');

/**
 * The error for a counted limit: `402 premium_required` when a higher plan allows more,
 * `429 quota_exceeded` when no plan does (premium spec "Paid plans have limits too").
 */
export function limitError(feature: Feature, plan: Plan, doc?: RemoteConfigDocument | null): ApiError {
  const current = resolvePlanLimit(doc, plan, feature) ?? Number.POSITIVE_INFINITY;
  const higher = PLANS.some((p) => (resolvePlanLimit(doc, p, feature) ?? Number.POSITIVE_INFINITY) > current);
  return higher
    ? new ApiError('premium_required', 'Your plan does not include this', { feature })
    : new ApiError('quota_exceeded', 'Limit reached', { feature });
}

// ---- Projections (the TypeScript copy of :core:model Projections) ----

/** The document a reader receives: every field for the owner; shared fields, people and the reader's own settings for members. */
export function projectEvent(r: ReaderEvent): EventDoc {
  const head = { id: r.event.id, rev: r.event.rev, role: r.role };
  const updatedAt = isoSeconds(r.event.updatedAt);
  if (r.role === 'owner') return { ...head, ...(r.event.doc as unknown as Omit<EventDoc, 'id'>), updatedAt };
  const doc: JsonObject = Object.fromEntries(Object.entries(r.event.doc).filter(([k]) => SHARED_FIELDS.has(k)));
  const reminders = r.membership?.reminders ?? null;
  if (reminders !== null) doc['reminders'] = reminders;
  return {
    ...head,
    ...(doc as unknown as Omit<EventDoc, 'id'>),
    updatedAt,
    members: r.people.map((p) => ({ name: p.name, role: p.role })),
    archived: r.membership?.archivedAt != null,
  };
}

function memoBody(m: MemoRecord): Memo {
  const out: Memo = {
    id: m.id,
    eventId: m.eventId,
    seq: m.seq,
    content: m.doc['content'] as string,
    createdAt: m.doc['createdAt'] as string,
    updatedAt: isoSeconds(m.updatedAt),
  };
  if (typeof m.doc['milestoneTag'] === 'string') out.milestoneTag = m.doc['milestoneTag'];
  return out;
}

function memoChange(m: MemoRecord): MemoChange {
  if (m.deletedAt !== null) return { id: m.id, seq: m.seq, deleted: true };
  const { eventId: _eventId, ...memo } = memoBody(m);
  return { ...memo, seq: m.seq, deleted: false };
}

// ---- Helpers ----

/**
 * A body's ETag: a hash of `tagged` (the body itself by default). Answers `304` when `If-None-Match`
 * names it. `cacheControl` defaults to `private, no-cache`.
 */
export async function withEtag(ctx: RequestContext, body: unknown, tagged: unknown = body, cacheControl = 'private, no-cache'): Promise<HttpResponse> {
  const etag = `"${(await sha256Hex(JSON.stringify(tagged))).slice(0, 32)}"`;
  const headers = { ETag: etag, 'Cache-Control': cacheControl };
  const match = ctx.req.headers.get('If-None-Match');
  if (match !== null && match.split(',').some((t) => t.trim() === etag || t.trim() === '*')) return emptyResponse(304, headers);
  return jsonResponse(200, body, headers);
}

export function eventId(ctx: RequestContext): string {
  const id = ctx.params['id'] ?? '';
  if (!isUuid(id)) throw notFound();
  return id;
}

/** The event as the caller may read it: `404` when unknown, `403` without access, `410` once deleted. */
export async function readable(ports: Ports, session: Session, id: string): Promise<ReaderEvent> {
  const [r] = await ports.store.readEvents(session.accountId, [id]);
  if (!r) throw (await ports.store.getEvent(id)) ? forbidden() : notFound();
  if (r.event.deletedAt !== null) throw deleted();
  return r;
}

export async function ownerOnly(ports: Ports, session: Session, id: string): Promise<ReaderEvent> {
  const r = await readable(ports, session, id);
  if (r.role !== 'owner') throw forbidden();
  return r;
}

/** The plan and owned-event limit of the writer. */
async function writerPlan(ports: Ports, accountId: string): Promise<Plan> {
  const account = await ports.store.getAccount(accountId);
  if (!account) throw new ApiError('unauthorized', 'Sign in required');
  return effectivePlan(account, nowSeconds(ports.clock));
}

// ---- Bulk Batch and Import (Task 12.1, design D20 and D22, BACKEND.md 7.3 and 8) ----

export interface BulkPolicy {
  readonly route: 'batch' | 'import';
  readonly maxEvents: number;
  readonly maxBytes: number;
  readonly atomic: boolean;
  readonly enforceOwnedLimit: boolean;
  readonly rateLimited: boolean;
}

export const BATCH_POLICY: BulkPolicy = {
  route: 'batch',
  maxEvents: 100,
  maxBytes: 4_194_304,
  atomic: false,
  enforceOwnedLimit: true,
  rateLimited: false,
};

export const IMPORT_POLICY: BulkPolicy = {
  route: 'import',
  maxEvents: 500,
  maxBytes: 4_194_304,
  atomic: true,
  enforceOwnedLimit: false,
  rateLimited: true,
};

const IMPORT_RATE_LIMIT_WINDOW_SECONDS = 3600;
const IMPORT_RATE_LIMIT_MAX_REQUESTS = 10;
const importRequestsByAccount = new Map<string, number[]>();

export function resetImportRateLimitsForTesting(): void {
  importRequestsByAccount.clear();
}

function checkImportRateLimit(ctx: RequestContext, accountId: string, now: number): void {
  const timestamps = importRequestsByAccount.get(accountId) ?? [];
  const cutoff = now - IMPORT_RATE_LIMIT_WINDOW_SECONDS;
  const active = timestamps.filter((t) => t > cutoff);
  if (active.length >= IMPORT_RATE_LIMIT_MAX_REQUESTS) {
    ctx.rateLimited = true;
    const oldest = active[0] ?? now;
    const retryAfter = Math.max(1, oldest + IMPORT_RATE_LIMIT_WINDOW_SECONDS - now);
    throw new ApiError('rate_limited', 'Rate limit exceeded', null, { 'Retry-After': String(retryAfter) });
  }
  active.push(now);
  importRequestsByAccount.set(accountId, active);
}

interface ValidatedEventItem {
  readonly id: string;
  readonly doc: JsonObject;
  readonly memos?: readonly { readonly id: string; readonly doc: JsonObject }[];
}

function validateEventItem(
  item: unknown,
): { valid: true; item: ValidatedEventItem } | { valid: false; error: ApiError } {
  if (!isJsonObject(item)) {
    return { valid: false, error: invalidPayload('', 'must be an object') };
  }
  const id = item['id'];
  if (typeof id !== 'string' || !isUuid(id)) {
    return {
      valid: false,
      error: invalidPayload('id', 'must be a lower-case UUID', typeof id === 'string' ? { eventId: id } : undefined),
    };
  }

  for (const key of Object.keys(item)) {
    if (key !== 'id' && key !== 'memos' && !WRITABLE.has(key)) {
      return { valid: false, error: invalidPayload(key, 'unknown field', { eventId: id }) };
    }
  }

  let validatedMemos: { id: string; doc: JsonObject }[] | undefined;
  if ('memos' in item && item['memos'] !== undefined && item['memos'] !== null) {
    const rawMemos = item['memos'];
    if (!Array.isArray(rawMemos)) {
      return { valid: false, error: invalidPayload('memos', 'must be an array', { eventId: id }) };
    }
    if (rawMemos.length > LIMITS.MEMOS_PER_EVENT) {
      return { valid: false, error: invalidPayload('memos', `must have at most ${LIMITS.MEMOS_PER_EVENT} memos`, { eventId: id }) };
    }
    validatedMemos = [];
    for (const rawMemo of rawMemos) {
      if (!isJsonObject(rawMemo)) {
        return { valid: false, error: invalidPayload('memos', 'must be an object', { eventId: id }) };
      }
      const memoId = rawMemo['id'];
      if (typeof memoId !== 'string' || !isUuid(memoId)) {
        return { valid: false, error: invalidPayload('id', 'must be a lower-case UUID', { eventId: id }) };
      }
      for (const k of Object.keys(rawMemo)) {
        if (k !== 'id' && !MEMO_WRITABLE.has(k)) {
          return { valid: false, error: invalidPayload(k, 'unknown field', { eventId: id }) };
        }
      }
      const memoDoc: JsonObject = {};
      for (const [k, v] of Object.entries(rawMemo)) {
        if (k !== 'id' && v !== undefined) memoDoc[k] = v;
      }
      const valMemo = validateNewMemo(memoDoc);
      if (!valMemo.valid) {
        const firstErr = valMemo.errors[0] as FieldError;
        return { valid: false, error: invalidPayload(firstErr.field, firstErr.reason, { eventId: id }) };
      }
      validatedMemos.push({ id: memoId, doc: withoutNulls(valMemo.value) });
    }
  }

  const eventDoc: JsonObject = {};
  for (const [k, v] of Object.entries(item)) {
    if (k !== 'id' && k !== 'memos' && v !== undefined) eventDoc[k] = v;
  }
  const valEvent = validateNewEvent(eventDoc);
  if (!valEvent.valid) {
    const firstErr = valEvent.errors[0] as FieldError;
    return { valid: false, error: invalidPayload(firstErr.field, firstErr.reason, { eventId: id }) };
  }
  const normalizedDoc = withoutNulls(valEvent.value);
  const tooLarge = checkDocumentSize(normalizedDoc);
  if (tooLarge) {
    return { valid: false, error: invalidPayload(tooLarge.field, tooLarge.reason, { eventId: id }) };
  }

  return {
    valid: true,
    item: {
      id,
      doc: normalizedDoc,
      ...(validatedMemos ? { memos: validatedMemos } : {}),
    },
  };
}

export function bulkEventsHandler(policy: BulkPolicy): Handler {
  return async (ctx) => {
    const { ports, req } = ctx;
    const session = await authenticate(ports, req);
    const now = nowSeconds(ports.clock);

    if (policy.rateLimited) {
      checkImportRateLimit(ctx, session.accountId, now);
    }

    const body = await readJsonObject(req, policy.maxBytes);
    onlyFields(body, ['events']);
    const rawEvents = body['events'];
    if (!Array.isArray(rawEvents)) {
      throw invalidPayload('events', rawEvents === undefined ? 'required' : 'must be an array');
    }
    if (rawEvents.length > policy.maxEvents) {
      throw invalidPayload('events', `must have at most ${policy.maxEvents} events`);
    }

    if (policy.atomic) {
      const validatedEvents: ValidatedEventItem[] = [];
      for (const rawItem of rawEvents) {
        const v = validateEventItem(rawItem);
        if (!v.valid) {
          throw v.error;
        }
        validatedEvents.push(v.item);
      }
      const outcome = await ports.store.importEvents({
        ownerId: session.accountId,
        now,
        events: validatedEvents,
      });
      if (outcome.status === 'conflict') {
        throw new ApiError('conflict', 'This id is used by another account or with different content');
      }
      return jsonResponse(200, { imported: outcome.imported }, NO_STORE);
    }

    // Batch: policy.atomic === false
    const plan = policy.enforceOwnedLimit ? await writerPlan(ports, session.accountId) : null;
    const configDoc = policy.enforceOwnedLimit ? await ports.remoteConfig.getConfig(session.accountId) : null;
    const maxOwned = plan ? resolvePlanLimit(configDoc, plan, 'events') : null;
    const results: ({ id: string; status: 'created' | 'exists' } | { id: string; status: 'error'; error: ApiErrorBody })[] = [];

    for (const rawItem of rawEvents) {
      const v = validateEventItem(rawItem);
      if (!v.valid) {
        const id = isJsonObject(rawItem) && typeof rawItem['id'] === 'string' ? rawItem['id'] : '';
        results.push({ id, status: 'error', error: v.error.body().error });
        continue;
      }

      const outcome = await ports.store.createEvent({
        id: v.item.id,
        ownerId: session.accountId,
        doc: v.item.doc,
        now,
        maxOwned,
      });

      switch (outcome.status) {
        case 'conflict':
          results.push({
            id: v.item.id,
            status: 'error',
            error: { code: 'conflict', message: 'This id is used by another account', details: null },
          });
          break;
        case 'limit':
          results.push({
            id: v.item.id,
            status: 'error',
            error: limitError('events', plan ?? 'free', configDoc).body().error,
          });
          break;
        case 'exists':
          if (outcome.event.deletedAt !== null) {
            results.push({
              id: v.item.id,
              status: 'error',
              error: deleted().body().error,
            });
          } else {
            results.push({ id: v.item.id, status: 'exists' });
          }
          break;
        case 'created':
          if (v.item.memos && v.item.memos.length > 0) {
            for (const m of v.item.memos) {
              await ports.store.putMemo({
                eventId: v.item.id,
                memoId: m.id,
                authorId: session.accountId,
                doc: m.doc,
                now,
                maxMemos: LIMITS.MEMOS_PER_EVENT,
              });
            }
          }
          results.push({ id: v.item.id, status: 'created' });
          break;
      }
    }

    return jsonResponse(200, { results }, NO_STORE);
  };
}

// ---- Handlers ----

const manifest: Handler = async (ctx) => {
  const session = await authenticate(ctx.ports, ctx.req);
  const rows = await ctx.ports.store.manifest(session.accountId);
  const body: SyncManifest = { events: rows.map((r): ManifestEntry => ({ id: r.id, rev: r.rev, role: r.role, childSeq: r.childSeq })) };
  return withEtag(ctx, body);
};

const fetchEvents: Handler = async ({ ports, req }) => {
  const session = await authenticate(ports, req);
  const body = await readJsonObject(req);
  onlyFields(body, ['ids']);
  const ids = body['ids'];
  if (!Array.isArray(ids)) throw invalidPayload('ids', ids === undefined ? 'required' : 'must be an array');
  if (ids.length > MAX_FETCH_IDS) throw invalidPayload('ids', `must have at most ${MAX_FETCH_IDS} ids`);
  if (!ids.every((id) => typeof id === 'string')) throw invalidPayload('ids', 'must be strings');
  const wanted = (ids as string[]).filter(isUuid);
  const read = await ports.store.readEvents(session.accountId, wanted);
  const events = read.filter((r) => r.event.deletedAt === null).sort((a, b) => (a.event.id < b.event.id ? -1 : 1)).map(projectEvent);
  return jsonResponse(200, { events }, NO_STORE);
};

const getEvent: Handler = async (ctx) => {
  const session = await authenticate(ctx.ports, ctx.req);
  return withEtag(ctx, projectEvent(await readable(ctx.ports, session, eventId(ctx))));
};

const createEvent: Handler = async (ctx) => {
  const { ports, req } = ctx;
  const session = await authenticate(ports, req);
  const id = ctx.params['id'] ?? '';
  if (!isUuid(id)) throw invalidPayload('id', 'must be a lower-case UUID');
  const doc = withoutNulls(valid(validateNewEvent(await readJsonObject(req))));
  const tooLarge = checkDocumentSize(doc);
  if (tooLarge) throw invalidPayload(tooLarge.field, tooLarge.reason);
  const now = nowSeconds(ports.clock);
  const plan = await writerPlan(ports, session.accountId);
  const configDoc = await ports.remoteConfig.getConfig(session.accountId);
  const outcome = await ports.store.createEvent({
    id, ownerId: session.accountId, doc, now, maxOwned: resolvePlanLimit(configDoc, plan, 'events'),
  });
  switch (outcome.status) {
    case 'conflict':
      throw new ApiError('conflict', 'This id is used by another account');
    case 'limit':
      throw limitError('events', plan, configDoc);
    case 'exists':
      if (outcome.event.deletedAt !== null) throw deleted();
      return jsonResponse(200, projectEvent({ event: outcome.event, role: 'owner', membership: null, people: [] }), NO_STORE);
    case 'created':
      return jsonResponse(201, projectEvent({ event: outcome.event, role: 'owner', membership: null, people: [] }), NO_STORE);
  }
};

const patchEvent: Handler = async (ctx) => {
  const { ports, req } = ctx;
  const session = await authenticate(ports, req);
  const id = eventId(ctx);
  const body = await readJsonObject(req);
  onlyFields(body, ['baseRev', 'patch']);
  const baseRev = body['baseRev'];
  if (typeof baseRev !== 'number' || !Number.isSafeInteger(baseRev) || baseRev < 0) throw invalidPayload('baseRev', 'must be a whole number');
  if (!isJsonObject(body['patch'])) throw invalidPayload('patch', body['patch'] === undefined ? 'required' : 'must be an object');
  const patch = valid(validateEventPatch(body['patch']));
  const access = await readable(ports, session, id);
  return jsonResponse(200, await writeEvent(ports, session, access, baseRev, patch), NO_STORE);
};

/**
 * The one write path for event changes, used by `PATCH /events/{id}` and by restores (task 3.7): role
 * checks, the merge with its revision, pruning past the revisions kept, and the live notice. `patch`
 * is already validated. Plan gates on patches (tasks 3.10, 3.12) belong here, so restores get them too.
 */
export async function writeEvent(
  ports: Ports,
  session: Session,
  access: ReaderEvent,
  baseRev: number,
  patch: JsonObject,
  restoredFrom?: number,
): Promise<PatchResponse> {
  if (access.role === 'viewer') throw forbidden();
  if (access.role === 'editor' && Object.keys(patch).some((f) => OWNER_ONLY_FIELDS.has(f))) {
    throw new ApiError('field_not_allowed', 'Only the owner can change this field');
  }
  const id = access.event.id;
  const outcome = await ports.store.applyPatch({
    eventId: id, authorId: session.accountId, baseRev, patch, now: nowSeconds(ports.clock), maxDocBytes: LIMITS.EVENT_DOC_MAX_BYTES,
    keepRevisions: LIMITS.REVISIONS_KEPT, ...(restoredFrom === undefined ? {} : { restoredFrom }),
  });
  switch (outcome.status) {
    case 'not_found':
      throw notFound();
    case 'deleted':
      throw deleted();
    case 'too_large':
      throw invalidPayload('', `event document exceeds ${LIMITS.EVENT_DOC_MAX_BYTES} bytes`);
    case 'ok':
      if (Object.keys(outcome.applied).length > 0) await ports.live.publish(id, { type: 'rev', rev: outcome.event.rev });
      return { event: projectEvent({ ...access, event: outcome.event }), overwritten: [...outcome.overwritten] };
  }
}

const deleteEvent: Handler = async (ctx) => {
  const { ports, req } = ctx;
  const session = await authenticate(ports, req);
  const id = eventId(ctx);
  const [r] = await ports.store.readEvents(session.accountId, [id]);
  if (!r) throw (await ports.store.getEvent(id)) ? forbidden() : notFound();
  if (r.role !== 'owner') throw forbidden();
  if (await ports.store.deleteEvent(id, nowSeconds(ports.clock))) await ports.live.publish(id, { type: 'access' });
  return emptyResponse(204, NO_STORE);
};

const children: Handler = async (ctx) => {
  const { ports, req } = ctx;
  const session = await authenticate(ports, req);
  const id = eventId(ctx);
  await ownerOnly(ports, session, id);
  const raw = req.query.get('after') ?? '0';
  if (!/^\d{1,15}$/.test(raw)) throw invalidPayload('after', 'must be a whole number');
  const after = Number(raw);
  const page = await ports.store.listChildren(id, after);
  if (!page) throw notFound();
  // A client behind purged tombstones cannot learn what was deleted: it gets every live memo and resets.
  const reset = after < page.purgedSeq;
  const memos = reset ? await ports.store.listMemos(id) : page.memos;
  const body: ChildrenResponse = { memos: memos.map(memoChange), seq: page.seq, reset };
  return jsonResponse(200, body, NO_STORE);
};

function memoId(ctx: RequestContext): string {
  const id = ctx.params['memoId'] ?? '';
  if (!isUuid(id)) throw notFound();
  return id;
}

const putMemo: Handler = async (ctx) => {
  const { ports, req } = ctx;
  const session = await authenticate(ports, req);
  const id = eventId(ctx);
  const mid = memoId(ctx);
  const doc = withoutNulls(valid(validateNewMemo(await readJsonObject(req))));
  await ownerOnly(ports, session, id);
  const outcome = await ports.store.putMemo({
    eventId: id, memoId: mid, authorId: session.accountId, doc, now: nowSeconds(ports.clock), maxMemos: LIMITS.MEMOS_PER_EVENT,
  });
  switch (outcome.status) {
    case 'conflict':
      throw new ApiError('conflict', 'This id is used by another memo');
    case 'limit':
      throw new ApiError('quota_exceeded', 'Limit reached', { limit: 'memos_per_event' });
    case 'event_missing':
      throw deleted();
    case 'exists':
      if (outcome.memo.deletedAt !== null) throw new ApiError('deleted', 'This memo was deleted');
      return jsonResponse(200, memoBody(outcome.memo), NO_STORE);
    case 'created':
      await ports.live.publish(id, { type: 'children', seq: outcome.memo.seq });
      return jsonResponse(201, memoBody(outcome.memo), NO_STORE);
  }
};

const patchMemo: Handler = async (ctx) => {
  const { ports, req } = ctx;
  const session = await authenticate(ports, req);
  const id = eventId(ctx);
  const mid = memoId(ctx);
  const body = await readJsonObject(req);
  onlyFields(body, ['patch']);
  if (!isJsonObject(body['patch'])) throw invalidPayload('patch', body['patch'] === undefined ? 'required' : 'must be an object');
  const patch: JsonObject = valid(validateMemoPatch(body['patch']));
  await ownerOnly(ports, session, id);
  const outcome = await ports.store.patchMemo({ eventId: id, memoId: mid, patch, now: nowSeconds(ports.clock) });
  if (outcome.status === 'not_found') throw notFound();
  if (outcome.changed) await ports.live.publish(id, { type: 'children', seq: outcome.memo.seq });
  return jsonResponse(200, memoBody(outcome.memo), NO_STORE);
};

const deleteMemo: Handler = async (ctx) => {
  const { ports, req } = ctx;
  const session = await authenticate(ports, req);
  const id = eventId(ctx);
  const mid = memoId(ctx);
  await ownerOnly(ports, session, id);
  const outcome = await ports.store.deleteMemo(id, mid, nowSeconds(ports.clock));
  if (outcome.status === 'ok') {
    await ports.live.publish(id, { type: 'children', seq: outcome.memo.seq });
  } else {
    // Deleting twice is fine; an id that never existed here is not.
    const memo = await ports.store.getMemo(mid);
    if (!memo || memo.eventId !== id) throw notFound();
  }
  return emptyResponse(204, NO_STORE);
};

export const syncRoutes: readonly Route<Handler>[] = [
  { method: 'GET', pattern: `${API}/sync`, handler: manifest },
  { method: 'POST', pattern: `${API}/events/fetch`, handler: fetchEvents },
  { method: 'POST', pattern: `${API}/events/batch`, handler: bulkEventsHandler(BATCH_POLICY) },
  { method: 'POST', pattern: `${API}/events/import`, handler: bulkEventsHandler(IMPORT_POLICY) },
  { method: 'GET', pattern: `${API}/events/:id`, handler: getEvent },
  { method: 'PUT', pattern: `${API}/events/:id`, handler: createEvent },
  { method: 'PATCH', pattern: `${API}/events/:id`, handler: patchEvent },
  { method: 'DELETE', pattern: `${API}/events/:id`, handler: deleteEvent },
  { method: 'GET', pattern: `${API}/events/:id/children`, handler: children },
  { method: 'PUT', pattern: `${API}/events/:id/memos/:memoId`, handler: putMemo },
  { method: 'PATCH', pattern: `${API}/events/:id/memos/:memoId`, handler: patchMemo },
  { method: 'DELETE', pattern: `${API}/events/:id/memos/:memoId`, handler: deleteMemo },
];

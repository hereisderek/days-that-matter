// History (task 3.7, `event-history` spec, design D5, BACKEND.md sections 7.3 and 7.4): revision pages
// for owners and editors, and restoring the shared fields of an earlier revision as a new revision.
// Editors never see changes to owner-only fields; viewers and public links see no history at all.
import { authenticate } from '../auth/session.ts';
import type { FieldChange, Revision, RevisionsPage } from '../contract/index.ts';
import type { RevisionRecord } from '../ports/store.ts';
import { jsonEquals, revertTo } from '../rules/merge.ts';
import type { Json, JsonObject } from '../rules/merge.ts';
import { SHARED_FIELDS, isoSeconds, validateEventPatch } from '../rules/validation.ts';
import type { Handler } from './app.ts';
import { readJsonObject } from './body.ts';
import { invalidPayload } from './errors.ts';
import { onlyFields, valid } from './input.ts';
import { API } from './paths.ts';
import type { Route } from './router.ts';
import { NO_STORE, eventId, forbidden, readable, writeEvent } from './sync.ts';
import { jsonResponse } from './types.ts';

/** Revisions per page, at most and by default (BACKEND.md section 7.3). */
export const REVISIONS_PAGE_MAX = 50;

/**
 * Fields that cannot be cleared read as their `:core:model` defaults while absent (`EventDoc`), so a
 * restore to a rev without them writes the default instead of null.
 */
const ABSENT_MEANS: Readonly<Record<string, Json>> = { unitMode: 'auto', recurrence: { type: 'none' } };

function wholeNumber(raw: string | null, name: string, min: number, max: number): number | null {
  if (raw === null) return null;
  if (!/^\d{1,15}$/.test(raw)) throw invalidPayload(name, 'must be a whole number');
  const n = Number(raw);
  if (n < min || n > max) throw invalidPayload(name, `must be ${min} to ${max}`);
  return n;
}

/** A revision as `owner` (every field) or an editor (shared fields only) sees it; null when it shows nothing. */
function revisionView(r: RevisionRecord, owner: boolean, names: ReadonlyMap<string, string>): Revision | null {
  const visible = (field: string): boolean => owner || SHARED_FIELDS.has(field);
  const changes: FieldChange[] = Object.keys(r.patch)
    .filter(visible)
    .map((field) => ({ field, from: (r.inverse[field] ?? null) as Json, to: r.patch[field] as Json }));
  if (changes.length === 0) return null;
  const name = r.authorId === null ? undefined : names.get(r.authorId);
  return {
    rev: r.rev,
    author: name === undefined ? null : { name },
    at: isoSeconds(r.createdAt),
    changes,
    overwrote: r.overwrote.filter(visible),
    restoredFrom: r.restoredFrom,
  };
}

const listRevisions: Handler = async (ctx) => {
  const { ports, req } = ctx;
  const session = await authenticate(ports, req);
  const id = eventId(ctx);
  const before = wholeNumber(req.query.get('before'), 'before', 1, Number.MAX_SAFE_INTEGER);
  const limit = wholeNumber(req.query.get('limit'), 'limit', 1, REVISIONS_PAGE_MAX) ?? REVISIONS_PAGE_MAX;
  const access = await readable(ports, session, id);
  if (access.role === 'viewer') throw forbidden();
  const owner = access.role === 'owner';

  // Editors skip owner-only revisions, so read until the page and one more visible revision are found.
  const found: RevisionRecord[] = [];
  let cursor = before ?? undefined;
  while (found.length <= limit) {
    const batch = await ports.store.listRevisions(id, { ...(cursor === undefined ? {} : { before: cursor }), limit: REVISIONS_PAGE_MAX });
    for (const r of batch) if (owner || Object.keys(r.patch).some((f) => SHARED_FIELDS.has(f))) found.push(r);
    if (batch.length < REVISIONS_PAGE_MAX) break;
    cursor = (batch.at(-1) as RevisionRecord).rev;
  }
  const page = found.slice(0, limit);
  const authors = page.map((r) => r.authorId).filter((a): a is string => a !== null);
  const names = await ports.store.displayNames(authors);
  const body: RevisionsPage = {
    revisions: page.map((r) => revisionView(r, owner, names) as Revision),
    next: found.length > limit ? (page.at(-1) as RevisionRecord).rev : null,
  };
  return jsonResponse(200, body, NO_STORE);
};

const restore: Handler = async (ctx) => {
  const { ports, req } = ctx;
  const session = await authenticate(ports, req);
  const id = eventId(ctx);
  const body = await readJsonObject(req);
  onlyFields(body, ['rev']);
  const rev = body['rev'];
  if (typeof rev !== 'number' || !Number.isSafeInteger(rev) || rev < 1) throw invalidPayload('rev', rev === undefined ? 'required' : 'must be a whole number');
  const access = await readable(ports, session, id);
  if (access.role === 'viewer') throw forbidden();
  const current = access.event;
  if (rev > current.rev) throw invalidPayload('rev', 'not in history');

  // The document at `rev` is the current one with the inverses of every later revision applied; all
  // of them must still be kept (pruning drops the oldest first).
  const later = rev === current.rev ? [] : await ports.store.listRevisions(id, { limit: current.rev - rev });
  if (later.length !== current.rev - rev || (later.length > 0 && (later.at(-1) as RevisionRecord).rev !== rev + 1)) {
    throw invalidPayload('rev', 'not in history');
  }
  const target = revertTo(current.doc, rev, later);
  // Only shared fields come back, for the owner too (`event-history` spec "Restore a revision").
  const patch: JsonObject = {};
  for (const field of SHARED_FIELDS) {
    const then = (target[field] ?? ABSENT_MEANS[field] ?? null) as Json;
    if (!jsonEquals(then, (current.doc[field] ?? ABSENT_MEANS[field] ?? null) as Json)) patch[field] = then;
  }
  const checked = valid(validateEventPatch(patch));
  return jsonResponse(200, await writeEvent(ports, session, access, current.rev, checked, rev), NO_STORE);
};

export const historyRoutes: readonly Route<Handler>[] = [
  { method: 'GET', pattern: `${API}/events/:id/revisions`, handler: listRevisions },
  { method: 'POST', pattern: `${API}/events/:id/restore`, handler: restore },
];

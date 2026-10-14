// Field-level last-write-wins (design D5), the TypeScript copy of :core:model PatchMerge.
// Checked against backend/core/contract/merge-vectors.json, generated from the Kotlin code.

export type Json = null | boolean | number | string | Json[] | JsonObject;
export interface JsonObject {
  [key: string]: Json;
}

/**
 * Result of applying a patch. `applied` holds the fields the patch really changed with their new
 * values (null = cleared), `inverse` their old values (null = was absent): the revision's patch and inverse.
 */
export interface PatchResult {
  readonly doc: JsonObject;
  readonly applied: JsonObject;
  readonly inverse: JsonObject;
}

/** A revision as far as overwritten-field detection needs it. `authorId` null = deleted account. */
export interface RevisionFields {
  readonly rev: number;
  readonly authorId: string | null;
  readonly fields: Iterable<string>;
}

/** Applies `patch` to `doc`: null clears, equal values are skipped, nested objects are replaced whole. */
export function applyPatch(doc: JsonObject, patch: JsonObject): PatchResult {
  const out: JsonObject = { ...doc };
  const applied: JsonObject = {};
  const inverse: JsonObject = {};
  for (const [field, value] of Object.entries(patch)) {
    const old = Object.hasOwn(doc, field) ? (doc[field] as Json) : null;
    if (jsonEquals(old, value)) continue;
    applied[field] = value;
    inverse[field] = old;
    if (value === null) Reflect.deleteProperty(out, field);
    else out[field] = value;
  }
  return { doc: out, applied, inverse };
}

/** [applyPatch] with the event rule of design-v2 D4: setting `archivedAt` also clears `pinnedAt`. */
export function applyEventPatch(doc: JsonObject, patch: JsonObject): PatchResult {
  return applyPatch(doc, withEventRules(patch));
}

export function withEventRules(patch: JsonObject): JsonObject {
  const archived = patch['archivedAt'];
  if (archived === undefined || archived === null) return patch;
  return { ...patch, pinnedAt: null };
}

/**
 * Fields of a write by `writerId` based on `baseRev` that replaced a newer change by someone else:
 * changed fields that a revision after `baseRev` by another (or a deleted) account also changed. Sorted.
 */
export function overwrittenFields(
  changedFields: Iterable<string>,
  baseRev: number,
  revisionsSinceBase: Iterable<RevisionFields>,
  writerId: string,
): string[] {
  const byOthers = new Set<string>();
  for (const r of revisionsSinceBase) {
    if (r.rev > baseRev && r.authorId !== writerId) for (const f of r.fields) byOthers.add(f);
  }
  return [...new Set(changedFields)].filter((f) => byOthers.has(f)).sort();
}

/** The document at `targetRev`: `current` with the inverses of every later revision applied, newest first. */
export function revertTo(
  current: JsonObject,
  targetRev: number,
  later: Iterable<{ readonly rev: number; readonly inverse: JsonObject }>,
): JsonObject {
  return [...later]
    .filter((r) => r.rev > targetRev)
    .sort((a, b) => b.rev - a.rev)
    .reduce((doc, r) => applyPatch(doc, r.inverse).doc, current);
}

/**
 * Structural equality of JSON values; object key order does not matter, as in kotlinx JsonObject.
 * Kotlin compares numbers by their text (1 and 1.0 differ); JSON.parse cannot tell them apart, so here they are equal.
 */
export function jsonEquals(a: Json, b: Json): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => jsonEquals(v, b[i] as Json));
  }
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((k) => Object.hasOwn(b, k) && jsonEquals(a[k] as Json, b[k] as Json));
}

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

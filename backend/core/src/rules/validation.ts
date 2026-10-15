// Validation of writes, the TypeScript copy of :core:model EventValidation, MemoValidation,
// SharingValidation and MembershipValidation (JsonChecks, TextRules, SpotifyLinks). Checked against
// backend/core/contract/validation-vectors.json, generated from the Kotlin code.
//
// Writes are checked strictly: unknown fields fail. Values come back normalized: single-line texts
// trimmed (and NFC-normalized here, which :core:model leaves to the platform: TextRules KDoc),
// timestamps in UTC, recurrence and theme without null members, reminders with their default time,
// Spotify URLs without query, and server-set `backdrop.*Url` fields removed. Reasons are fixed texts.
import { LIMITS } from '../contract/index.ts';
import type { ApiErrorResponse } from '../contract/index.ts';
import { isJsonObject } from './merge.ts';
import type { Json, JsonObject } from './merge.ts';

export interface FieldError {
  /** Path of the value (`title`, `theme.gradient`); empty for the body itself. */
  readonly field: string;
  readonly reason: string;
}

export type Validated<T> = { readonly valid: true; readonly value: T } | { readonly valid: false; readonly errors: readonly FieldError[] };

export function errorMessage(e: FieldError): string {
  return `${e.field === '' ? '(body)' : e.field}: ${e.reason}`;
}

/** The `400 invalid_payload` body, naming the first failing field. */
export function invalidPayloadBody(errors: readonly FieldError[]): ApiErrorResponse {
  const first = errors[0] as FieldError;
  return { error: { code: 'invalid_payload', message: errorMessage(first), details: { field: first.field } } };
}

// ---- Event fields (EventFields) ----

export const SHARED_FIELDS: ReadonlySet<string> = new Set([
  'title', 'emoji', 'targetDate', 'targetTime', 'timeZone', 'unitMode', 'recurrence', 'theme', 'backdrop', 'audio',
]);
export const OWNER_ONLY_FIELDS: ReadonlySet<string> = new Set(['notes', 'pinnedAt', 'categoryId', 'archivedAt', 'reminders']);
export const WRITABLE: ReadonlySet<string> = new Set([...SHARED_FIELDS, ...OWNER_ONLY_FIELDS]);
const REQUIRED = ['title', 'targetDate', 'theme'] as const;
const NOT_NULL: ReadonlySet<string> = new Set([...REQUIRED, 'unitMode', 'recurrence']);

const UNIT_MODES = new Set(['auto', 'days', 'weeks', 'hours', 'calendar', 'workdays']);
const RECURRENCE_TYPES = new Set(['none', 'yearly', 'monthly', 'weekly', 'customDays']);
const CARD_SIZES = new Set(['small', 'medium', 'large']);
const BACKDROP_KINDS = new Set(['still', 'animated']);
const AUDIO_KINDS = new Set(['library', 'custom', 'spotify']);
const ROLES = new Set(['viewer', 'editor']);

export const MEMO_WRITABLE: ReadonlySet<string> = new Set(['content', 'milestoneTag', 'createdAt']);
const MEMO_REQUIRED = ['content', 'createdAt'] as const;

const ID = /^[a-z0-9_-]{1,32}$/;
const MEDIA_ID = /^[A-Za-z0-9_-]{22}$/;
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ZONE = /^[A-Za-z][A-Za-z0-9_+\-/]{0,63}$/;
const HMS = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;
const HM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const INSTANT = /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,9}))?(Z|z|[+-]\d{2}:\d{2})$/;
const SPOTIFY = /^https:\/\/open\.spotify\.com\/(intl-[a-z]{2}\/)?(track|album|playlist)\/([A-Za-z0-9]{22})\/?(\?[^#\s]*)?(#\S*)?$/;

/** Collects errors while checking one body. Each check returns the normalized value, or undefined after recording an error. */
class Checks {
  readonly errors: FieldError[] = [];

  fail(field: string, reason: string): undefined {
    this.errors.push({ field, reason });
    return undefined;
  }

  result<T>(value: T): Validated<T> {
    return this.errors.length === 0 ? { valid: true, value } : { valid: false, errors: this.errors };
  }

  obj(path: string, value: Json, allowed: ReadonlySet<string>): JsonObject | undefined {
    if (!isJsonObject(value)) return this.fail(path, 'must be an object');
    if (!Object.keys(value).every((k) => allowed.has(k))) return this.fail(path, 'unknown field');
    return value;
  }

  required<T>(o: JsonObject, path: string, key: string, check: (path: string, value: Json) => T | undefined): T | undefined {
    const value = o[key];
    if (value === undefined || value === null) return this.fail(`${path}.${key}`, 'required');
    return check(`${path}.${key}`, value);
  }

  string(path: string, value: Json): string | undefined {
    if (typeof value !== 'string') return this.fail(path, 'must be a string');
    if (hasLoneSurrogate(value)) return this.fail(path, 'invalid unicode');
    return value;
  }

  line(path: string, value: Json, min: number, max: number): string | undefined {
    const raw = this.string(path, value);
    if (raw === undefined) return undefined;
    const text = raw.trim().normalize('NFC');
    const length = codePointCount(text);
    if (length < min || length > max) return this.fail(path, `must be ${min} to ${max} characters`);
    if (hasForbiddenChars(text, false)) return this.fail(path, 'contains forbidden characters');
    return text;
  }

  text(path: string, value: Json, max: number, requireContent: boolean): string | undefined {
    const text = this.string(path, value);
    if (text === undefined) return undefined;
    if (requireContent && isBlank(text)) return this.fail(path, 'must not be empty');
    if (codePointCount(text) > max) return this.fail(path, `must be at most ${max} characters`);
    if (hasForbiddenChars(text, true)) return this.fail(path, 'contains forbidden characters');
    return text;
  }

  emoji(path: string, value: Json): string | undefined {
    const text = this.string(path, value);
    if (text === undefined) return undefined;
    const ok = !hasForbiddenChars(text, false) && utf8Length(text) <= LIMITS.EMOJI_MAX_UTF8_BYTES && graphemeCount(text) === 1;
    return ok ? text : this.fail(path, 'must be a single emoji of at most 16 bytes');
  }

  pattern(path: string, value: Json, re: RegExp, reason: string): string | undefined {
    const text = this.string(path, value);
    if (text === undefined) return undefined;
    return re.test(text) ? text : this.fail(path, reason);
  }

  id = (path: string, value: Json): string | undefined => this.pattern(path, value, ID, 'invalid id');
  mediaId = (path: string, value: Json): string | undefined => this.pattern(path, value, MEDIA_ID, 'invalid media id');

  date(path: string, value: Json): string | undefined {
    const text = this.string(path, value);
    if (text === undefined) return undefined;
    return isDate(text) ? text : this.fail(path, 'invalid date');
  }

  zone(path: string, value: Json): string | undefined {
    const text = this.string(path, value);
    if (text === undefined) return undefined;
    return isTimeZone(text) ? text : this.fail(path, 'invalid time zone');
  }

  /** An ISO-8601 instant with an offset, normalized to UTC. Returns epoch milliseconds and the normalized text. */
  instant(path: string, value: Json): { readonly ms: number; readonly text: string } | undefined {
    const text = this.string(path, value);
    if (text === undefined) return undefined;
    const parsed = parseInstant(text);
    return parsed ?? this.fail(path, 'invalid timestamp');
  }

  int(path: string, value: Json, min: number, max: number): number | undefined {
    if (typeof value !== 'number' || !Number.isInteger(value) || !Number.isSafeInteger(value)) return this.fail(path, 'must be a whole number');
    return value >= min && value <= max ? value : this.fail(path, `must be ${min} to ${max}`);
  }

  number(path: string, value: Json, min: number, max: number): number | undefined {
    if (typeof value !== 'number' || !Number.isFinite(value)) return this.fail(path, 'must be a number');
    return value >= min && value <= max ? value : this.fail(path, `must be ${kotlinDouble(min)} to ${kotlinDouble(max)}`);
  }

  boolean(path: string, value: Json): boolean | undefined {
    return typeof value === 'boolean' ? value : this.fail(path, 'must be true or false');
  }

  choice(path: string, value: Json, values: ReadonlySet<string>): string | undefined {
    const text = this.string(path, value);
    if (text === undefined) return undefined;
    return values.has(text) ? text : this.fail(path, 'unsupported value');
  }

  /** `null` or `{"daysBefore": [...], "time": "HH:MM"}`; the time defaults to 09:00. */
  reminders(path: string, value: Json): Json | undefined {
    if (value === null) return null;
    const o = this.obj(path, value, new Set(['daysBefore', 'time']));
    if (!o) return undefined;
    const days = o['daysBefore'];
    if (days === undefined) return this.fail(`${path}.daysBefore`, 'required');
    if (!Array.isArray(days)) return this.fail(`${path}.daysBefore`, 'must be an array');
    const picked: number[] = [];
    for (const d of days) {
      const n = this.int(`${path}.daysBefore`, d, 0, 7);
      if (n === undefined) return undefined;
      picked.push(n);
    }
    if (!picked.every((n) => n === 0 || n === 1 || n === 7) || new Set(picked).size !== picked.length) {
      return this.fail(`${path}.daysBefore`, 'must be distinct values of 0, 1 and 7');
    }
    let time = '09:00';
    const t = o['time'];
    if (t !== undefined && t !== null) {
      const text = this.string(`${path}.time`, t);
      if (text === undefined) return undefined;
      if (!HM.test(text)) return this.fail(`${path}.time`, 'must be HH:MM');
      time = text;
    }
    return { daysBefore: [...picked].sort((a, b) => a - b), time };
  }
}

// ---- Events ----

/** A new event (`PUT /events/{id}`): required fields present, nothing unknown. */
export function validateNewEvent(fields: JsonObject): Validated<JsonObject> {
  const checks = new Checks();
  const out = eventFields(checks, fields);
  for (const name of REQUIRED) if (!Object.hasOwn(fields, name)) checks.fail(name, 'required');
  return checks.result(out);
}

/** A patch: writable fields only; `null` clears a field, except fields that cannot be cleared. */
export function validateEventPatch(patch: JsonObject): Validated<JsonObject> {
  const checks = new Checks();
  return checks.result(eventFields(checks, patch));
}

/** The size of a stored document (after a merge): at most 16 KB of JSON in UTF-8. */
export function checkDocumentSize(doc: JsonObject): FieldError | null {
  return utf8Length(JSON.stringify(doc)) > LIMITS.EVENT_DOC_MAX_BYTES ? { field: '', reason: 'event document exceeds 16384 bytes' } : null;
}

function eventFields(checks: Checks, fields: JsonObject): JsonObject {
  if (!Object.keys(fields).every((k) => WRITABLE.has(k))) checks.fail('', 'unknown field');
  const out: JsonObject = {};
  for (const [name, value] of Object.entries(fields)) {
    if (!WRITABLE.has(name)) continue;
    if (value === null) {
      if (NOT_NULL.has(name)) checks.fail(name, 'cannot be cleared');
      else out[name] = null;
      continue;
    }
    const checked = eventField(checks, name, value);
    if (checked !== undefined) out[name] = checked;
  }
  return out;
}

function eventField(checks: Checks, name: string, value: Json): Json | undefined {
  switch (name) {
    case 'title': return checks.line(name, value, 1, LIMITS.TITLE_MAX_CHARS);
    case 'emoji': return checks.emoji(name, value);
    case 'targetDate': return checks.date(name, value);
    case 'targetTime': return checks.pattern(name, value, HMS, 'must be HH:MM:SS');
    case 'timeZone': return checks.zone(name, value);
    case 'unitMode': return checks.choice(name, value, UNIT_MODES);
    case 'recurrence': return recurrence(checks, value);
    case 'theme': return theme(checks, value);
    case 'backdrop': return backdrop(checks, value);
    case 'audio': return audio(checks, value);
    case 'notes': return checks.text(name, value, LIMITS.NOTES_MAX_CHARS, false);
    case 'pinnedAt':
    case 'archivedAt': return checks.instant(name, value)?.text;
    case 'categoryId': return checks.id(name, value);
    case 'reminders': return checks.reminders(name, value);
    default: return undefined;
  }
}

function recurrence(checks: Checks, value: Json): JsonObject | undefined {
  const path = 'recurrence';
  const o = checks.obj(path, value, new Set(['type', 'originalYear', 'days']));
  if (!o) return undefined;
  const type = checks.required(o, path, 'type', (p, v) => checks.choice(p, v, RECURRENCE_TYPES));
  if (type === undefined) return undefined;
  let year: number | undefined;
  const y = o['originalYear'];
  if (y !== undefined && y !== null) {
    year = checks.int(`${path}.originalYear`, y, LIMITS.MIN_YEAR, LIMITS.MAX_YEAR);
    if (year === undefined) return undefined;
  }
  let days: number | undefined;
  const d = o['days'];
  if (d !== undefined && d !== null) {
    days = checks.int(`${path}.days`, d, 1, LIMITS.CUSTOM_DAYS_MAX);
    if (days === undefined) return undefined;
  }
  if ((type === 'yearly') !== (year !== undefined)) return checks.fail(`${path}.originalYear`, 'required only for yearly');
  if ((type === 'customDays') !== (days !== undefined)) return checks.fail(`${path}.days`, 'required only for customDays');
  const out: JsonObject = { type };
  if (year !== undefined) out['originalYear'] = year;
  if (days !== undefined) out['days'] = days;
  return out;
}

function theme(checks: Checks, value: Json): JsonObject | undefined {
  const path = 'theme';
  const o = checks.obj(path, value, new Set(['paletteId', 'cardStyle', 'typography', 'gradient', 'size']));
  if (!o) return undefined;
  const out: JsonObject = {};
  for (const key of ['paletteId', 'cardStyle', 'typography']) {
    const id = checks.required(o, path, key, checks.id);
    if (id === undefined) return undefined;
    out[key] = id;
  }
  const g = o['gradient'];
  if (g !== undefined && g !== null) {
    if (!Array.isArray(g) || g.length !== 2) return checks.fail(`${path}.gradient`, 'must be two colours');
    const colours: string[] = [];
    for (const c of g) {
      const colour = checks.pattern(`${path}.gradient`, c, HEX_COLOR, 'must be #RRGGBB');
      if (colour === undefined) return undefined;
      colours.push(colour);
    }
    out['gradient'] = colours;
  }
  const s = o['size'];
  if (s !== undefined && s !== null) {
    const size = checks.choice(`${path}.size`, s, CARD_SIZES);
    if (size === undefined) return undefined;
    out['size'] = size;
  }
  return out;
}

function backdrop(checks: Checks, value: Json): JsonObject | undefined {
  const path = 'backdrop';
  const o = checks.obj(path, value, new Set(['kind', 'stillId', 'motionId', 'dim', 'blur', 'stillUrl', 'motionUrl']));
  if (!o) return undefined;
  const kind = checks.required(o, path, 'kind', (p, v) => checks.choice(p, v, BACKDROP_KINDS));
  if (kind === undefined) return undefined;
  const still = checks.required(o, path, 'stillId', checks.mediaId);
  if (still === undefined) return undefined;
  let motion: string | undefined;
  const m = o['motionId'];
  if (m !== undefined && m !== null) {
    motion = checks.mediaId(`${path}.motionId`, m);
    if (motion === undefined) return undefined;
  }
  if ((kind === 'animated') !== (motion !== undefined)) return checks.fail(`${path}.motionId`, 'required only for animated');
  const dim = checks.required(o, path, 'dim', (p, v) => checks.number(p, v, 0, LIMITS.DIM_MAX));
  if (dim === undefined) return undefined;
  let blur: number | undefined;
  const b = o['blur'];
  if (b !== undefined && b !== null) {
    blur = checks.number(`${path}.blur`, b, 0, LIMITS.BLUR_MAX);
    if (blur === undefined) return undefined;
  }
  const out: JsonObject = { kind, stillId: still };
  if (motion !== undefined) out['motionId'] = motion;
  out['dim'] = dim;
  if (blur !== undefined) out['blur'] = blur;
  return out;
}

function audio(checks: Checks, value: Json): JsonObject | undefined {
  const path = 'audio';
  if (!isJsonObject(value)) return checks.fail(path, 'must be an object');
  const kind = checks.required(value, path, 'kind', (p, v) => checks.choice(p, v, AUDIO_KINDS));
  if (kind === undefined) return undefined;
  if (kind === 'library') {
    const o = checks.obj(path, value, new Set(['kind', 'trackId']));
    if (!o) return undefined;
    const track = checks.required(o, path, 'trackId', checks.id);
    return track === undefined ? undefined : { kind, trackId: track };
  }
  if (kind === 'custom') {
    const o = checks.obj(path, value, new Set(['kind', 'mediaId', 'title']));
    if (!o) return undefined;
    const media = checks.required(o, path, 'mediaId', checks.mediaId);
    if (media === undefined) return undefined;
    const title = checks.required(o, path, 'title', (p, v) => checks.line(p, v, 1, LIMITS.AUDIO_TEXT_MAX_CHARS));
    return title === undefined ? undefined : { kind, mediaId: media, title };
  }
  const o = checks.obj(path, value, new Set(['kind', 'url', 'title', 'artist']));
  if (!o) return undefined;
  const raw = checks.required(o, path, 'url', (p, v) => checks.string(p, v));
  if (raw === undefined) return undefined;
  const url = spotifyUrl(raw);
  if (url === null) return checks.fail(`${path}.url`, 'not a Spotify track, album or playlist link');
  const out: JsonObject = { kind, url };
  for (const key of ['title', 'artist']) {
    const v = o[key];
    if (v === undefined || v === null) continue;
    const text = checks.line(`${path}.${key}`, v, 1, LIMITS.AUDIO_TEXT_MAX_CHARS);
    if (text === undefined) return undefined;
    out[key] = text;
  }
  return out;
}

/** The stored form of a Spotify track, album or playlist link (query and fragment dropped), or null. */
export function spotifyUrl(url: string): string | null {
  const m = SPOTIFY.exec(url);
  if (!m) return null;
  return `https://open.spotify.com/${m[1] ?? ''}${m[2] as string}/${m[3] as string}`;
}

// ---- Memos ----

/** A new memo: `content` (1 to 10,000 characters) and `createdAt` required, `milestoneTag` optional. */
export function validateNewMemo(doc: JsonObject): Validated<JsonObject> {
  const checks = new Checks();
  const out = memoFields(checks, doc);
  for (const name of MEMO_REQUIRED) if (!Object.hasOwn(doc, name)) checks.fail(name, 'required');
  return checks.result(out);
}

/** A memo patch; only `milestoneTag` can be cleared. */
export function validateMemoPatch(patch: JsonObject): Validated<JsonObject> {
  const checks = new Checks();
  return checks.result(memoFields(checks, patch));
}

function memoFields(checks: Checks, fields: JsonObject): JsonObject {
  if (!Object.keys(fields).every((k) => MEMO_WRITABLE.has(k))) checks.fail('', 'unknown field');
  const out: JsonObject = {};
  for (const [name, value] of Object.entries(fields)) {
    if (!MEMO_WRITABLE.has(name)) continue;
    if (value === null) {
      if (name === 'milestoneTag') out[name] = null;
      else checks.fail(name, 'cannot be cleared');
      continue;
    }
    const checked =
      name === 'content' ? checks.text(name, value, LIMITS.MEMO_MAX_CHARS, true)
      : name === 'milestoneTag' ? checks.line(name, value, 1, LIMITS.LABEL_MAX_CHARS)
      : checks.instant(name, value)?.text;
    if (checked !== undefined) out[name] = checked;
  }
  return out;
}

// ---- Links, invites and memberships ----

const DAY_MS = 86_400_000;

/** `POST /events/{id}/links` `{label, expiresAt}`; public links never expire by default. */
export function validateNewLink(body: JsonObject, nowMs: number): Validated<JsonObject> {
  const checks = new Checks();
  const out = linkFields(checks, body, nowMs);
  if (!('expiresAt' in out)) out['expiresAt'] = null;
  return checks.result(out);
}

/** `PATCH /links/{linkId}`: label or expiry. */
export function validateLinkPatch(body: JsonObject, nowMs: number): Validated<JsonObject> {
  const checks = new Checks();
  return checks.result(linkFields(checks, body, nowMs));
}

/** `POST /events/{id}/invites` `{role, maxUses, expiresAt}`; defaults: 1 use, 30 days. */
export function validateNewInvite(body: JsonObject, nowMs: number): Validated<JsonObject> {
  const checks = new Checks();
  const out = inviteFields(checks, body, nowMs);
  if (body['role'] === undefined) checks.fail('role', 'required');
  if (!('maxUses' in out)) out['maxUses'] = 1;
  if (!('expiresAt' in out)) out['expiresAt'] = formatInstant(nowMs + 30 * DAY_MS);
  return checks.result(out);
}

/** `PATCH /invites/{inviteId}`: expiry, use count or role. */
export function validateInvitePatch(body: JsonObject, nowMs: number): Validated<JsonObject> {
  const checks = new Checks();
  return checks.result(inviteFields(checks, body, nowMs));
}

/** `PATCH /events/{id}/membership` `{archived, reminders}`. */
export function validateMembershipPatch(body: JsonObject): Validated<JsonObject> {
  const checks = new Checks();
  const out: JsonObject = {};
  if (checks.obj('', body, new Set(['archived', 'reminders']))) {
    const a = body['archived'];
    if (a !== undefined) {
      const archived = checks.boolean('archived', a);
      if (archived !== undefined) out['archived'] = archived;
    }
    const r = body['reminders'];
    if (r !== undefined) {
      const reminders = checks.reminders('reminders', r);
      if (reminders !== undefined) out['reminders'] = reminders;
    }
  }
  return checks.result(out);
}

function linkFields(checks: Checks, body: JsonObject, nowMs: number): JsonObject {
  const out: JsonObject = {};
  if (!checks.obj('', body, new Set(['label', 'expiresAt']))) return out;
  const label = body['label'];
  if (label === null) out['label'] = null;
  else if (label !== undefined) {
    const text = checks.line('label', label, 1, LIMITS.LABEL_MAX_CHARS);
    if (text !== undefined) out['label'] = text;
  }
  const e = body['expiresAt'];
  if (e !== undefined) {
    const expiry = checkExpiry(checks, e, nowMs);
    if (expiry !== undefined) out['expiresAt'] = expiry;
  }
  return out;
}

function inviteFields(checks: Checks, body: JsonObject, nowMs: number): JsonObject {
  const out: JsonObject = {};
  if (!checks.obj('', body, new Set(['role', 'maxUses', 'expiresAt']))) return out;
  const role = body['role'];
  if (role !== undefined) {
    const r = checks.choice('role', role, ROLES);
    if (r !== undefined) out['role'] = r;
  }
  const uses = body['maxUses'];
  if (uses === null) out['maxUses'] = null;
  else if (uses !== undefined) {
    const n = checks.int('maxUses', uses, 1, LIMITS.INVITE_MAX_USES);
    if (n !== undefined) out['maxUses'] = n;
  }
  const e = body['expiresAt'];
  if (e !== undefined) {
    const expiry = checkExpiry(checks, e, nowMs);
    if (expiry !== undefined) out['expiresAt'] = expiry;
  }
  return out;
}

function checkExpiry(checks: Checks, value: Json, nowMs: number): Json | undefined {
  if (value === null) return null;
  const at = checks.instant('expiresAt', value);
  if (at === undefined) return undefined;
  const max = new Date(nowMs);
  max.setUTCFullYear(max.getUTCFullYear() + LIMITS.EXPIRY_MAX_YEARS);
  if (at.ms <= nowMs || at.ms > max.getTime()) return checks.fail('expiresAt', 'must be after now and at most 5 years ahead');
  return at.text;
}

// ---- Text rules (TextRules) ----

/** C0 and C1 controls, DEL, line and paragraph separators, bidi embeddings, overrides and isolates. */
function isForbidden(cp: number, multiLine: boolean): boolean {
  if (multiLine && (cp === 0x0a || cp === 0x09)) return false;
  return cp <= 0x1f || (cp >= 0x7f && cp <= 0x9f) || cp === 0x2028 || cp === 0x2029 ||
    (cp >= 0x202a && cp <= 0x202e) || (cp >= 0x2066 && cp <= 0x2069);
}

function hasForbiddenChars(text: string, multiLine: boolean): boolean {
  for (const ch of text) if (isForbidden(ch.codePointAt(0) as number, multiLine)) return true;
  return false;
}

function hasLoneSurrogate(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      i++;
    } else if (c >= 0xdc00 && c <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function codePointCount(text: string): number {
  let n = 0;
  for (const _ of text) n++;
  return n;
}

/** Kotlin's isBlank: empty or only whitespace. */
function isBlank(text: string): boolean {
  return text.trim() === '';
}

export function utf8Length(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

const ZWJ = 0x200d;

/** The simplified grapheme count of TextRules.graphemeCount, for the emoji rule. */
function graphemeCount(text: string): number {
  let count = 0;
  let previous = -1;
  let regionalRun = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) as number;
    const joins = previous !== -1 && (isExtend(cp) || cp === ZWJ || (previous === ZWJ && isPictographic(cp)));
    const regional = cp >= 0x1f1e6 && cp <= 0x1f1ff;
    const pairsFlag = regional && regionalRun % 2 === 1;
    if (!joins && !pairsFlag) count++;
    regionalRun = regional ? regionalRun + 1 : 0;
    previous = cp;
  }
  return count;
}

function isPictographic(cp: number): boolean {
  return cp === 0xa9 || cp === 0xae || cp === 0x203c || cp === 0x2049 || cp === 0x2122 || cp === 0x2139 ||
    (cp >= 0x2190 && cp <= 0x2bff) || (cp >= 0x3030 && cp <= 0x303d) || (cp >= 0x1f000 && cp <= 0x1fffd);
}

function isExtend(cp: number): boolean {
  return (cp >= 0x0300 && cp <= 0x036f) || (cp >= 0x1ab0 && cp <= 0x1aff) || (cp >= 0x1dc0 && cp <= 0x1dff) ||
    (cp >= 0x20d0 && cp <= 0x20ff) || (cp >= 0xfe00 && cp <= 0xfe0f) || (cp >= 0xfe20 && cp <= 0xfe2f) ||
    cp === 0x200c || (cp >= 0x1f3fb && cp <= 0x1f3ff) || (cp >= 0xe0020 && cp <= 0xe007f) || (cp >= 0xe0100 && cp <= 0xe01ef);
}

// ---- Dates, zones and instants ----

function isDate(text: string): boolean {
  const m = DATE.exec(text);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < LIMITS.MIN_YEAR || y > LIMITS.MAX_YEAR || mo < 1 || mo > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

/** True for an IANA zone id the runtime's time zone database knows. */
export function isTimeZone(text: string): boolean {
  if (!ZONE.test(text)) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: text });
    return true;
  } catch {
    return false;
  }
}

/** Parses an ISO-8601 instant with seconds and an offset; null when it is not one. */
export function parseInstant(text: string): { readonly ms: number; readonly text: string; readonly nanos: number } | null {
  const m = INSTANT.exec(text);
  if (!m) return null;
  const [y, mo, d, h, mi, s] = [1, 2, 3, 4, 5, 6].map((i) => Number(m[i]));
  if (!isDateParts(y as number, mo as number, d as number) || (h as number) > 23 || (mi as number) > 59 || (s as number) > 59) return null;
  let offsetMs = 0;
  const zone = m[8] as string;
  if (zone !== 'Z' && zone !== 'z') {
    const oh = Number(zone.slice(1, 3));
    const om = Number(zone.slice(4, 6));
    if (oh > 18 || om > 59) return null;
    offsetMs = (zone[0] === '-' ? -1 : 1) * (oh * 3_600_000 + om * 60_000);
  }
  const nanos = Number((m[7] ?? '').padEnd(9, '0') || '0');
  const base = Date.UTC(y as number, (mo as number) - 1, d as number, h as number, mi as number, s as number);
  const ms = base - offsetMs + Math.floor(nanos / 1_000_000);
  return { ms, nanos, text: formatInstant(ms - Math.floor(nanos / 1_000_000), nanos) };
}

function isDateParts(y: number, mo: number, d: number): boolean {
  return mo >= 1 && mo <= 12 && d >= 1 && d <= new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

/** Kotlin's Instant.toString: UTC, `Z`, fraction in groups of 3 digits only when not zero. */
export function formatInstant(ms: number, nanos?: number): string {
  const wholeSecondMs = Math.floor(ms / 1000) * 1000;
  const fraction = nanos ?? (ms - wholeSecondMs) * 1_000_000;
  const base = new Date(wholeSecondMs).toISOString().slice(0, 19);
  if (fraction === 0) return `${base}Z`;
  let digits = String(fraction).padStart(9, '0');
  while (digits.endsWith('000')) digits = digits.slice(0, -3);
  return `${base}.${digits}Z`;
}

/** Unix seconds as the API's timestamp text. */
export function isoSeconds(seconds: number): string {
  return formatInstant(seconds * 1000);
}

/** Kotlin formats whole doubles with `.0`. */
function kotlinDouble(n: number): string {
  return Number.isInteger(n) ? `${n}.0` : String(n);
}

// ---- Accounts ----

/** `PATCH /me` `{displayName}`: the title rule, 1 to 100 characters. */
export function validateMePatch(body: JsonObject): Validated<JsonObject> {
  const checks = new Checks();
  const out: JsonObject = {};
  if (checks.obj('', body, new Set(['displayName']))) {
    const value = body['displayName'];
    if (value === undefined || value === null) checks.fail('displayName', 'required');
    else {
      const name = checks.line('displayName', value, 1, LIMITS.TITLE_MAX_CHARS);
      if (name !== undefined) out['displayName'] = name;
    }
  }
  return checks.result(out);
}

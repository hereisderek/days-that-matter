import { z } from 'zod';
import { ApiError, invalidPayload, payloadTooLarge } from './errors';

export const SUPPORTED_VERSIONS = [1] as const;
export const MAX_BODY_BYTES = 16384;
export const MAX_PAYLOAD_BYTES = 8192;

const FORBIDDEN_CHARS = new RegExp("[\\u0000-\\u001F\\u007F-\\u009F\\u2028\\u2029\\u202A-\\u202E\\u2066-\\u2069]");
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const ID = /^[a-z0-9_-]{1,32}$/;
const encoder = new TextEncoder();

const title = z.string().transform((raw, ctx) => {
  if (LONE_SURROGATE.test(raw)) {
    ctx.addIssue({ code: 'custom', message: 'invalid unicode' });
    return z.NEVER;
  }
  const s = raw.normalize('NFC').trim();
  const length = Array.from(s).length;
  if (length < 1 || length > 100) {
    ctx.addIssue({ code: 'custom', message: 'must be 1 to 100 characters' });
    return z.NEVER;
  }
  if (FORBIDDEN_CHARS.test(s)) {
    ctx.addIssue({ code: 'custom', message: 'contains forbidden characters' });
    return z.NEVER;
  }
  return s;
});

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const emoji = z.string().superRefine((s, ctx) => {
  const bad =
    LONE_SURROGATE.test(s) ||
    FORBIDDEN_CHARS.test(s) ||
    encoder.encode(s).length > 16 ||
    Array.from(graphemes.segment(s)).length !== 1;
  if (bad) ctx.addIssue({ code: 'custom', message: 'must be a single emoji of at most 16 bytes' });
});

function validDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 1900 || y > 2200) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function validZone(s: string): boolean {
  if (!/^[A-Za-z][A-Za-z0-9_+\-/]{0,63}$/.test(s)) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: s });
    return true;
  } catch {
    return false;
  }
}

const year = z.number().int().min(1900).max(2200);
const nullDefault = <T extends z.ZodType>(schema: T) =>
  schema.nullish().transform((v) => (v ?? null) as z.output<T> | null);

const recurrence = z
  .strictObject({
    type: z.enum(['none', 'yearly', 'monthly', 'weekly', 'customDays']),
    originalYear: nullDefault(year),
    days: nullDefault(z.number().int().min(1).max(3650)),
  })
  .superRefine((r, ctx) => {
    if (r.type === 'yearly' ? r.originalYear === null : r.originalYear !== null) {
      ctx.addIssue({ code: 'custom', path: ['originalYear'], message: 'required only for yearly' });
    }
    if (r.type === 'customDays' ? r.days === null : r.days !== null) {
      ctx.addIssue({ code: 'custom', path: ['days'], message: 'required only for customDays' });
    }
  });

const theme = z.strictObject({
  paletteId: z.string().regex(ID),
  cardStyle: z.string().regex(ID),
  typography: z.string().regex(ID),
  gradient: nullDefault(z.tuple([z.string().regex(HEX_COLOR), z.string().regex(HEX_COLOR)])),
});

export const payloadV1 = z.strictObject({
  v: z.literal(1),
  title,
  emoji: nullDefault(emoji),
  targetDate: z.string().refine(validDate, 'invalid date'),
  targetTime: nullDefault(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/)),
  timeZone: nullDefault(z.string().refine(validZone, 'invalid time zone')),
  unitMode: z.enum(['auto', 'days', 'calendar']).default('auto'),
  recurrence: recurrence.default({ type: 'none', originalYear: null, days: null }),
  theme,
});
export type SharePayload = z.output<typeof payloadV1>;

const expiresInDays = z.number().int().min(1).max(365).nullable().optional();
const envelope = z.strictObject({
  schemaVersion: z.number().int(),
  payload: z.unknown(),
  expiresInDays,
});

export interface ParsedShareBody {
  schemaVersion: number;
  payload: SharePayload;
  /** Canonical JSON as stored. */
  payloadJson: string;
  payloadBytes: number;
  /** `undefined` when the key was absent. */
  expiresInDays: number | null | undefined;
}

function describe(error: z.ZodError): ApiError {
  const paths = error.issues.map((i) => i.path.join('.') || '(body)');
  const first = error.issues[0];
  // Built-in zod messages can echo user keys or values, so only static messages are passed through.
  const reason = first.code === 'custom' ? first.message : first.code.replaceAll('_', ' ');
  return invalidPayload(`${paths[0]}: ${reason}`, [...new Set(paths)]);
}

export function parseShareBody(body: unknown): ParsedShareBody {
  const env = envelope.safeParse(body);
  if (!env.success) throw describe(env.error);
  const { schemaVersion } = env.data;
  if (!(SUPPORTED_VERSIONS as readonly number[]).includes(schemaVersion)) {
    throw new ApiError(422, 'unsupported_schema_version', 'Unsupported schema version', {
      supported: [...SUPPORTED_VERSIONS],
    });
  }
  const parsed = payloadV1.safeParse(env.data.payload);
  if (!parsed.success) {
    const err = describe(parsed.error);
    throw invalidPayload(`payload.${err.message}`, (err.details as { fields: string[] }).fields.map((f) => `payload.${f}`));
  }
  const payloadJson = JSON.stringify(parsed.data);
  const payloadBytes = encoder.encode(payloadJson).length;
  if (payloadBytes > MAX_PAYLOAD_BYTES) throw payloadTooLarge('Payload exceeds 8192 bytes');
  return {
    schemaVersion,
    payload: parsed.data,
    payloadJson,
    payloadBytes,
    expiresInDays: env.data.expiresInDays,
  };
}

/** Reads at most MAX_BODY_BYTES, strict UTF-8, JSON. Throws ApiError on any violation. */
export async function readJsonBody(req: Request): Promise<unknown> {
  const type = (req.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase();
  if (type !== 'application/json') {
    throw new ApiError(415, 'unsupported_media_type', 'Content-Type must be application/json');
  }
  const declared = req.headers.get('Content-Length');
  if (declared !== null && Number(declared) > MAX_BODY_BYTES) throw payloadTooLarge('Body exceeds 16384 bytes');
  const chunks: Uint8Array[] = [];
  let total = 0;
  if (req.body) {
    const reader = req.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        throw payloadTooLarge('Body exceeds 16384 bytes');
      }
      chunks.push(value);
    }
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    buf.set(c, off);
    off += c.length;
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(buf));
  } catch {
    throw invalidPayload('Body is not valid JSON');
  }
}

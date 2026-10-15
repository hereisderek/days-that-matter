// Reading request bodies with a size limit (BACKEND.md section 7.1: JSON at most 64 KB).
import { LIMITS } from '../contract/index.ts';
import { isJsonObject } from '../rules/merge.ts';
import type { JsonObject } from '../rules/merge.ts';
import { invalidPayload, payloadTooLarge, unsupportedMediaType } from './errors.ts';
import type { CoreRequest } from './types.ts';

/**
 * The whole body, at most `maxBytes`. A `Content-Length` over the limit fails before reading;
 * a body that grows past it fails as soon as it does.
 */
export async function readBody(req: CoreRequest, maxBytes: number): Promise<Uint8Array> {
  const declared = req.headers.get('Content-Length');
  if (declared !== null && Number(declared) > maxBytes) throw payloadTooLarge();
  if (req.body === null) return new Uint8Array(0);
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = req.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw payloadTooLarge();
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

/** A JSON object body: `application/json`, at most `maxBytes` (default 64 KB), valid UTF-8 and JSON, an object at the top. */
export async function readJsonObject(req: CoreRequest, maxBytes = LIMITS.JSON_BODY_MAX_BYTES): Promise<JsonObject> {
  const type = req.headers.get('Content-Type') ?? '';
  if (!/^application\/json\s*(;|$)/i.test(type)) throw unsupportedMediaType();
  const bytes = await readBody(req, maxBytes);
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw invalidPayload('', 'invalid JSON');
  }
  if (!isJsonObject(value)) throw invalidPayload('', 'must be an object');
  return value;
}

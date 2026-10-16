// The core's own request and response types (BACKEND.md section 2). Each variant converts its
// platform request into a CoreRequest and a CoreResponse back; fetch.ts does it for the Fetch API.
import type { Role } from '../contract/index.ts';

export interface CoreRequest {
  readonly method: string;
  /** Path without query, as sent (percent-encoded), for example `/api/v1/events/abc`. */
  readonly path: string;
  readonly query: URLSearchParams;
  readonly headers: Headers;
  readonly body: ReadableStream<Uint8Array> | null;
  /** The client address as the platform reports it. Used only hashed (rate limits); never logged. */
  readonly clientIp: string | null;
}

export type ResponseBody = string | Uint8Array | ReadableStream<Uint8Array> | null;

export interface HttpResponse {
  readonly kind: 'http';
  readonly status: number;
  readonly headers: Headers;
  readonly body: ResponseBody;
}

/** Who a live socket belongs to: a role on the event, or a public link reader. */
export interface LiveSubscriber {
  readonly role: Role | 'public';
}

/** Tells the variant to open a WebSocket for `eventId` (BACKEND.md section 9). */
export interface LiveUpgrade {
  readonly kind: 'live';
  readonly eventId: string;
  readonly subscriber: LiveSubscriber;
  readonly headers: Headers;
}

export type CoreResponse = HttpResponse | LiveUpgrade;

const JSON_TYPE = 'application/json; charset=utf-8';
const HTML_TYPE = 'text/html; charset=utf-8';

export function jsonResponse(status: number, value: unknown, headers?: Record<string, string>): HttpResponse {
  const h = new Headers(headers);
  h.set('Content-Type', JSON_TYPE);
  return { kind: 'http', status, headers: h, body: JSON.stringify(value) };
}

export function htmlResponse(status: number, body: string, headers?: Record<string, string>): HttpResponse {
  const h = new Headers(headers);
  h.set('Content-Type', HTML_TYPE);
  return { kind: 'http', status, headers: h, body };
}

export function emptyResponse(status: number, headers?: Record<string, string>): HttpResponse {
  return { kind: 'http', status, headers: new Headers(headers), body: null };
}

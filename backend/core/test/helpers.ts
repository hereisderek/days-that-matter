import type { CoreRequest, CoreResponse, HttpResponse } from '../src/http/types.ts';

export interface RequestInit {
  readonly headers?: Record<string, string>;
  readonly body?: string | Uint8Array;
  readonly ip?: string | null;
}

/** A CoreRequest for `url` (path and query). */
export function request(method: string, url: string, init: RequestInit = {}): CoreRequest {
  const u = new URL(url, 'https://dtm.example.test');
  const bytes = typeof init.body === 'string' ? new TextEncoder().encode(init.body) : init.body;
  return {
    method,
    path: u.pathname,
    query: u.searchParams,
    headers: new Headers(init.headers),
    body: bytes === undefined ? null : streamOf(bytes),
    clientIp: init.ip ?? null,
  };
}

export function streamOf(...chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(c);
      controller.close();
    },
  });
}

export function http(res: CoreResponse): HttpResponse {
  if (res.kind !== 'http') throw new Error('expected an HTTP response');
  return res;
}

export async function text(res: CoreResponse): Promise<string> {
  const body = http(res).body;
  if (body === null) return '';
  if (typeof body === 'string') return body;
  if (body instanceof Uint8Array) return new TextDecoder().decode(body);
  return new Response(body).text();
}

export async function json<T = unknown>(res: CoreResponse): Promise<T> {
  return JSON.parse(await text(res)) as T;
}

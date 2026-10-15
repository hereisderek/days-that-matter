// Conversion between the Fetch API (Workers, Vercel, Node's global Request) and the core's types.
import type { CoreRequest, HttpResponse } from './types.ts';

export function fromFetchRequest(request: Request, clientIp: string | null): CoreRequest {
  const url = new URL(request.url);
  return {
    method: request.method,
    path: url.pathname,
    query: url.searchParams,
    headers: request.headers,
    body: request.body,
    clientIp,
  };
}

export function toFetchResponse(res: HttpResponse): Response {
  const noBody = res.status === 204 || res.status === 304 || res.status < 200;
  // A Uint8Array is copied into its own ArrayBuffer, the BodyInit type the DOM and Node typings share.
  const body = noBody || res.body === null ? null : res.body instanceof Uint8Array ? res.body.slice().buffer : res.body;
  return new Response(body, { status: res.status, headers: res.headers });
}

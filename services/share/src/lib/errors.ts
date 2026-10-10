export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details: unknown = null,
    public readonly headers: Record<string, string> = {},
  ) {
    super(message);
  }
}

export function errorResponse(e: ApiError): Response {
  const body = JSON.stringify({ error: { code: e.code, message: e.message, details: e.details } });
  return new Response(body, {
    status: e.status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...e.headers },
  });
}

/** One shared constructor so unknown, malformed, purged and wrong-token 404s are byte-identical. */
export const notFound = () =>
  new ApiError(404, 'not_found', 'Not found', null, { 'Cache-Control': 'no-store' });

export const unauthorized = () =>
  new ApiError(401, 'unauthorized', 'Missing or malformed manage token', null, {
    'WWW-Authenticate': 'Bearer',
  });

export const invalidPayload = (message: string, fields?: string[]) =>
  new ApiError(400, 'invalid_payload', message, fields ? { fields } : null);

export const payloadTooLarge = (message: string) => new ApiError(413, 'payload_too_large', message);

export const gone = (code: 'revoked' | 'expired') =>
  new ApiError(410, code, code === 'revoked' ? 'This share was revoked' : 'This share has expired', null, {
    'Cache-Control': 'public, max-age=60',
  });

export const serviceUnavailable = (message = 'Service temporarily unavailable') =>
  new ApiError(503, 'service_unavailable', message, null, { 'Retry-After': '60' });

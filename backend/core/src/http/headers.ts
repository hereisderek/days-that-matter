// Security headers (BACKEND.md sections 7.1 and 14).

/**
 * Headers every response gets: request id, `nosniff`, `no-referrer`, and `no-store` on errors unless
 * the handler chose a cache policy. No CORS header and no cookie ever leave the core.
 */
export function applyResponseHeaders(headers: Headers, requestId: string, status: number): void {
  headers.set('X-Request-Id', requestId);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'no-referrer');
  if (status >= 400 && !headers.has('Cache-Control')) headers.set('Cache-Control', 'no-store');
  headers.delete('Set-Cookie');
  for (const name of [...headers.keys()]) {
    if (name.startsWith('access-control-')) headers.delete(name);
  }
}

/** Extra headers of HTML pages (public link, landing, export and operator pages). */
export function pageHeaders(origin: string, mediaOrigin: string): Record<string, string> {
  const ws = origin.replace(/^https:/, 'wss:');
  const csp = [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    `img-src 'self' data: ${mediaOrigin}`,
    `media-src 'self' ${mediaOrigin}`,
    "font-src 'self'",
    `connect-src 'self' ${ws}`,
    "form-action 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
  return {
    'Content-Security-Policy': csp,
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow',
    'Strict-Transport-Security': 'max-age=31536000',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };
}

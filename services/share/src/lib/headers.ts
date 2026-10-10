import type { MiddlewareHandler } from 'hono';
import type { Env } from '../env';

export interface Vars {
  reqId: string;
  tokenHashPrefix?: string;
  rateLimited?: boolean;
}
export type AppEnv = { Bindings: Env; Variables: Vars };

/**
 * Request id, security headers and the one JSON log line per request.
 * The log never contains bodies, titles, tokens, Authorization, IPs or install ids: the route is the
 * matched pattern (not the URL) and the token is represented by the first 8 hex chars of its hash.
 */
export const securityHeaders: MiddlewareHandler<AppEnv> = async (c, next) => {
  const reqId = crypto.randomUUID();
  c.set('reqId', reqId);
  await next();
  const h = c.res.headers;
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Referrer-Policy', 'no-referrer');
  h.set('X-Request-Id', reqId);
  if (c.res.status >= 400 && !h.has('Cache-Control')) h.set('Cache-Control', 'no-store');
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      route: c.req.routePath,
      status: c.res.status,
      reqId,
      tokenHashPrefix: c.get('tokenHashPrefix') ?? null,
      rateLimited: c.get('rateLimited') ?? false,
    }),
  );
};

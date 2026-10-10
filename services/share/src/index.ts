import { Hono } from 'hono';
import type { Env } from './env';
import { ApiError, errorResponse, notFound } from './lib/errors';
import { securityHeaders } from './lib/headers';
import type { AppEnv } from './lib/headers';
import { purge } from './lib/purge';
import { nowSeconds } from './lib/time';
import { healthRoutes } from './routes/health';
import { pageRoutes } from './routes/page';
import { shareRoutes } from './routes/shares';

export const app = new Hono<AppEnv>();

app.use('*', securityHeaders);

app.route('/api/v1', healthRoutes);
app.route('/api/v1', shareRoutes);

app.route('/', pageRoutes);

app.notFound(() => errorResponse(notFound()));

const D1_LIMIT = /limit|exceeded|quota|overloaded/i;

app.onError((err, c) => {
  if (err instanceof ApiError) return errorResponse(err);
  const reqId = c.get('reqId');
  // Message is never logged or returned: it may carry SQL or user values.
  const message = err instanceof Error ? err.message : '';
  if (/D1/.test(message) && D1_LIMIT.test(message)) {
    return errorResponse(new ApiError(503, 'service_unavailable', 'Service temporarily unavailable', null, { 'Retry-After': '60' }));
  }
  return errorResponse(new ApiError(500, 'internal_error', 'Internal error', { requestId: reqId }));
});

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(purge(env.DB, nowSeconds()));
  },
} satisfies ExportedHandler<Env>;

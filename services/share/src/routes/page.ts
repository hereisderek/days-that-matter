import { Hono } from 'hono';
import type { Env } from '../env';
import { getShareByToken } from '../lib/db';
import { PAGE_HEADERS } from '../page/headers';
import { renderActive, renderGone, renderNotFound, renderUnavailable } from '../page/render';
import type { PageShare } from '../page/types';

/** Result of the share lookup. Matches `ShareLookup` in docs/architecture/SHARE_SERVICE.md 6.7. */
export type PageLookup =
  | { status: 'ok'; share: PageShare }
  | { status: 'revoked' | 'expired' | 'not_found' };

export type LookupFn = (db: D1Database, token: string, nowSeconds: number) => Promise<PageLookup>;

function respond(body: string, status: 200 | 404 | 410 | 503, extra?: Record<string, string>): Response {
  return new Response(body, { status, headers: { ...PAGE_HEADERS, ...extra } });
}

/** Builds the page routes. `lookup` is `getShareByToken` from src/lib/db.ts. */
export function createPageRoutes(lookup: LookupFn): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();
  app.get('/e/:token', async (c) => {
    const nowMs = Date.now();
    let result: PageLookup;
    try {
      result = await lookup(c.env.DB, c.req.param('token'), Math.floor(nowMs / 1000));
    } catch {
      return respond(renderUnavailable(), 503, { 'Retry-After': '60' });
    }
    switch (result.status) {
      case 'ok':
        return respond(renderActive(result.share, nowMs), 200);
      case 'revoked':
      case 'expired':
        return respond(renderGone(), 410);
      default:
        return respond(renderNotFound(), 404);
    }
  });
  // Any other method on /e/* is a plain 404 with the same headers.
  app.all('/e/:token', () => respond(renderNotFound(), 404));
  return app;
}

/** Mounted by src/index.ts. */
export const pageRoutes = createPageRoutes(getShareByToken);

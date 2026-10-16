// HTTP Handler for GET /api/v1/remote-config (BACKEND.md section 7.6).
import { authenticate } from '../auth/session.ts';
import type { Session } from '../auth/session.ts';
import type { Handler } from '../http/app.ts';
import { API } from '../http/paths.ts';
import type { Route } from '../http/router.ts';
import { withEtag } from '../http/sync.ts';

export const getRemoteConfig: Handler = async (ctx) => {
  const { ports, req } = ctx;

  let session: Session | null = null;
  if (req.headers.has('Authorization')) {
    try {
      session = await authenticate(ports, req);
    } catch {
      session = null;
    }
  }

  const userParam = req.query.get('user');
  let audience = 'local';

  if (session) {
    if (!userParam || userParam === session.accountId) {
      audience = session.accountId;
    } else {
      audience = 'local';
    }
  }

  const doc = await ports.remoteConfig.getConfig(audience);
  const cacheControl = `public, max-age=${doc.ttlSeconds}`;
  return withEtag(ctx, doc, doc, cacheControl);
};

export const remoteConfigRoutes: readonly Route<Handler>[] = [
  {
    method: 'GET',
    pattern: `${API}/remote-config`,
    handler: getRemoteConfig,
  },
];

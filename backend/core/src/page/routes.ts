import { TOKEN_FORMAT } from '../auth/invite-token.ts';
import type { Handler, RequestContext } from '../http/app.ts';
import { pageHeaders } from '../http/headers.ts';
import { htmlResponse } from '../http/types.ts';
import type { Route } from '../http/router.ts';
import { projectPublic } from '../http/resolve.ts';
import type { Ports } from '../ports/index.ts';
import type { PublicEvent } from '../contract/index.ts';
import { renderActive, renderGone, renderInviteLanding, renderMemberLanding, renderNotFound, renderUnavailable } from './render.ts';
import type { PageShare } from './types.ts';

export type PageLookup =
  | { status: 'ok'; share: PageShare | { shareToken: string; event: PublicEvent } }
  | { status: 'revoked' | 'expired' | 'not_found' };

export type LookupFn = (ports: Ports, token: string, nowSeconds: number) => Promise<PageLookup>;

export const defaultLinkLookup: LookupFn = async (ports, token, nowSeconds) => {
  const link = await ports.store.getLinkByToken(token);
  const event = link ? await ports.store.getEvent(link.eventId) : null;
  if (!link || !event) return { status: 'not_found' };
  if (event.deletedAt !== null || link.revokedAt !== null) return { status: 'revoked' };
  if (link.expiresAt !== null && link.expiresAt <= nowSeconds) return { status: 'expired' };
  return { status: 'ok', share: { shareToken: token, event: projectPublic(event) } };
};

export function createPageRoutes(lookup: LookupFn = defaultLinkLookup): readonly Route<Handler>[] {
  const publicLinkHandler: Handler = async (ctx: RequestContext) => {
    const { ports, params } = ctx;
    const token = params['token'] ?? '';
    const origin = ports.config.origin;
    const mediaOrigin = ports.config.mediaOrigin;
    const headers = pageHeaders(origin, mediaOrigin);

    if (!TOKEN_FORMAT.test(token)) {
      return htmlResponse(404, renderNotFound(), headers);
    }

    const nowMs = ports.clock.nowMs();
    let result: PageLookup;
    try {
      result = await lookup(ports, token, Math.floor(nowMs / 1000));
    } catch {
      return htmlResponse(503, renderUnavailable(), { ...headers, 'Retry-After': '60' });
    }

    switch (result.status) {
      case 'ok': {
        const pageHtml = renderActive(result.share, nowMs, {
          origin,
          mediaOrigin,
          appScheme: ports.config.appScheme,
        });
        return htmlResponse(200, pageHtml, headers);
      }
      case 'revoked':
      case 'expired':
        return htmlResponse(410, renderGone(), headers);
      default:
        return htmlResponse(404, renderNotFound(), headers);
    }
  };

  const inviteLandingHandler: Handler = (ctx: RequestContext) => {
    const { ports } = ctx;
    const origin = ports.config.origin;
    const mediaOrigin = ports.config.mediaOrigin;
    const headers = pageHeaders(origin, mediaOrigin);
    const html = renderInviteLanding({
      origin,
      appScheme: ports.config.appScheme,
      stores: ports.config.stores,
      region: ports.config.region,
    });
    return htmlResponse(200, html, headers);
  };

  const memberLandingHandler: Handler = (ctx: RequestContext) => {
    const { ports } = ctx;
    const origin = ports.config.origin;
    const mediaOrigin = ports.config.mediaOrigin;
    const headers = pageHeaders(origin, mediaOrigin);
    const html = renderMemberLanding({
      origin,
      appScheme: ports.config.appScheme,
      stores: ports.config.stores,
      region: ports.config.region,
    });
    return htmlResponse(200, html, headers);
  };

  return [
    { method: 'GET', pattern: '/e/:token', handler: publicLinkHandler },
    { method: 'GET', pattern: '/i/:token', handler: inviteLandingHandler },
    { method: 'GET', pattern: '/s/:id', handler: memberLandingHandler },
  ];
}

export const pageRoutes: readonly Route<Handler>[] = createPageRoutes();

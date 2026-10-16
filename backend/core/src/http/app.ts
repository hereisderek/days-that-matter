// The core's request pipeline: request id, routing, handler, error envelope, security headers and
// one log line. Handlers stay thin and call the ports (design D1).
import type { HealthResponse } from '../contract/index.ts';
import type { Ports } from '../ports/index.ts';
import { StoreBusyError } from '../ports/store.ts';
import { ApiError, errorResponse, internalError, notFound, serviceUnavailable } from './errors.ts';
import { applyResponseHeaders } from './headers.ts';
import { consoleLog, logLine } from './log.ts';
import type { LogSink } from './log.ts';
import { accountRoutes } from './accounts.ts';
import { historyRoutes } from './history.ts';
import { remoteConfigRoutes } from '../remote-config/handler.ts';
import { resolveRoutes } from './resolve.ts';
import { sharingRoutes } from './sharing.ts';
import { API } from './paths.ts';
import { Router } from './router.ts';
import { syncRoutes } from './sync.ts';
import type { Params, Route } from './router.ts';
import { jsonResponse } from './types.ts';
import type { CoreRequest, CoreResponse, HttpResponse } from './types.ts';

export interface RequestContext {
  readonly req: CoreRequest;
  readonly params: Params;
  readonly ports: Ports;
  readonly reqId: string;
  /** Set by a handler that refused a request for its rate limit; recorded in the log line. */
  rateLimited: boolean;
}

export type Handler = (ctx: RequestContext) => Promise<CoreResponse> | CoreResponse;

export interface App {
  handle(req: CoreRequest): Promise<CoreResponse>;
}

export { API };

const healthRoutes: readonly Route<Handler>[] = [
  {
    method: 'GET',
    pattern: `${API}/health`,
    handler: ({ ports }) => {
      const body: HealthResponse = { status: 'ok', version: ports.config.version };
      return jsonResponse(200, body, { 'Cache-Control': 'no-store' });
    },
  },
];

/** The routes of the core so far. Later tasks add theirs here. */
export const coreRoutes: readonly Route<Handler>[] = [
  ...healthRoutes, ...accountRoutes, ...syncRoutes, ...historyRoutes, ...sharingRoutes, ...resolveRoutes, ...remoteConfigRoutes,
];


export interface AppOptions {
  readonly routes?: readonly Route<Handler>[];
  readonly log?: LogSink;
}

export function createApp(ports: Ports, options: AppOptions = {}): App {
  const router = new Router<Handler>();
  for (const r of options.routes ?? coreRoutes) router.add(r.method, r.pattern, r.handler);
  const log = options.log ?? consoleLog;

  return {
    async handle(req) {
      const reqId = ports.random.uuid();
      const match = router.match(req.method, req.path);
      const ctx: RequestContext = { req, params: match?.params ?? {}, ports, reqId, rateLimited: false };
      let res: CoreResponse;
      try {
        res = match ? await match.route.handler(ctx) : errorResponse(notFound());
      } catch (e) {
        // The error message is never logged or returned: it may hold SQL or user values.
        res = errorResponse(e instanceof ApiError ? e : e instanceof StoreBusyError ? serviceUnavailable() : internalError(reqId));
      }
      const status = res.kind === 'http' ? res.status : 101;
      applyResponseHeaders(res.headers, reqId, status);
      if (res.kind === 'http' && req.method.toUpperCase() === 'HEAD') res = withoutBody(res);
      log(
        logLine({
          ts: new Date(ports.clock.nowMs()).toISOString(),
          route: match?.route.pattern ?? null,
          status,
          reqId,
          rateLimited: ctx.rateLimited,
        }),
      );
      return res;
    },
  };
}

function withoutBody(res: HttpResponse): HttpResponse {
  if (res.body instanceof ReadableStream) void res.body.cancel();
  return { ...res, body: null };
}

// One JSON line per request (BACKEND.md section 14). The line has these fields and nothing else, so it
// cannot carry bodies, titles, memo text, emails, codes, tokens, cookies, Authorization values, purchase
// or push tokens, IPs or Spotify URLs. `route` is the matched pattern, never the requested path.

export interface RequestLog {
  readonly ts: string;
  readonly route: string | null;
  readonly status: number;
  readonly reqId: string;
  readonly rateLimited: boolean;
}

/** Where log lines go; console.log by default. */
export type LogSink = (line: string) => void;

export const consoleLog: LogSink = (line) => console.log(line);

export function logLine(entry: RequestLog): string {
  return JSON.stringify({
    ts: entry.ts,
    route: entry.route,
    status: entry.status,
    reqId: entry.reqId,
    rateLimited: entry.rateLimited,
  });
}

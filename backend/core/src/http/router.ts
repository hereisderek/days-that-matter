// A tiny router, written here instead of taking a framework (design D1, BACKEND.md section 1): about
// 50 lines, no dependency, the same behavior on every runtime, and the matched pattern (never the
// URL, which can hold tokens) is what the log line records.

export type Params = Readonly<Record<string, string>>;

export interface Route<H> {
  readonly method: string;
  /** Literal segments and `:name` parameters, for example `/api/v1/events/:id`. */
  readonly pattern: string;
  readonly handler: H;
}

export interface RouteMatch<H> {
  readonly route: Route<H>;
  readonly params: Params;
}

interface Compiled<H> {
  readonly route: Route<H>;
  readonly segments: readonly string[];
}

export class Router<H> {
  readonly #routes: Compiled<H>[] = [];

  add(method: string, pattern: string, handler: H): this {
    if (!pattern.startsWith('/')) throw new Error(`Pattern must start with /: ${pattern}`);
    this.#routes.push({ route: { method: method.toUpperCase(), pattern, handler }, segments: pattern.split('/') });
    return this;
  }

  /** The first route for `method` (HEAD falls back to GET) whose pattern matches `path`, or null. */
  match(method: string, path: string): RouteMatch<H> | null {
    const upper = method.toUpperCase();
    const parts = path.split('/');
    for (const m of upper === 'HEAD' ? ['HEAD', 'GET'] : [upper]) {
      for (const { route, segments } of this.#routes) {
        if (route.method !== m || segments.length !== parts.length) continue;
        const params = matchSegments(segments, parts);
        if (params) return { route, params };
      }
    }
    return null;
  }
}

function matchSegments(segments: readonly string[], parts: readonly string[]): Params | null {
  const params: Record<string, string> = {};
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i] as string;
    const part = parts[i] as string;
    if (segment.startsWith(':')) {
      if (part === '') return null;
      let value: string;
      try {
        value = decodeURIComponent(part);
      } catch {
        return null;
      }
      params[segment.slice(1)] = value;
    } else if (segment !== part) {
      return null;
    }
  }
  return params;
}

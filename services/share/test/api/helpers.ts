import { env } from 'cloudflare:workers';
import { app } from '../../src/index';

export const INSTALL = '4b1d1f0e-6f0a-4c7e-9a52-0c1f1d2e3a4b';

export const validPayload = (over: Record<string, unknown> = {}) => ({
  v: 1,
  title: 'Our wedding',
  emoji: String.fromCodePoint(0x1f48d),
  targetDate: '2027-06-12',
  targetTime: '16:30:00',
  timeZone: 'Europe/Paris',
  unitMode: 'auto',
  recurrence: { type: 'yearly', originalYear: 2027, days: null },
  theme: { paletteId: 'violet', cardStyle: 'glass', typography: 'modern', gradient: ['#8B5CF6', '#3B82F6'] },
  ...over,
});

export const body = (over: Record<string, unknown> = {}) => ({ schemaVersion: 1, payload: validPayload(), ...over });

export interface Opts {
  headers?: Record<string, string>;
  body?: unknown;
  raw?: BodyInit;
  ip?: string;
  db?: D1Database;
  vars?: Record<string, string>;
}

let ipCounter = 0;
/** Unique IP per call so rate limits do not leak between tests unless a test pins one. */
export const freshIp = () => `10.${(ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter++ & 255}`;

export function call(method: string, path: string, o: Opts = {}): Promise<Response> {
  const headers: Record<string, string> = { 'CF-Connecting-IP': o.ip ?? freshIp(), ...o.headers };
  let payload: BodyInit | undefined = o.raw;
  if (o.body !== undefined) {
    payload = JSON.stringify(o.body);
    headers['Content-Type'] ??= 'application/json';
  }
  const e = { ...env, ...(o.db ? { DB: o.db } : {}), ...o.vars } as typeof env;
  return Promise.resolve(app.request(`https://daysthatmatter.app${path}`, { method, headers, body: payload }, e));
}

export interface Created {
  shareToken: string;
  manageToken: string;
  url: string;
  schemaVersion: number;
  createdAt: string;
  expiresAt: string | null;
}

export async function create(over: Record<string, unknown> = {}, o: Opts = {}): Promise<Created> {
  const res = await call('POST', '/api/v1/shares', {
    ...o,
    headers: { 'X-Install-Id': INSTALL, ...o.headers },
    body: body(over),
  });
  if (res.status !== 201) throw new Error(`create failed ${res.status} ${await res.text()}`);
  return res.json();
}

export const auth = (t: Created, extra: Record<string, string> = {}) => ({ Authorization: `Bearer ${t.manageToken}`, ...extra });

export const reqIdStripped = (res: Response) => {
  const h = [...res.headers.entries()].filter(([k]) => k !== 'x-request-id').sort();
  return JSON.stringify(h);
};

class CStmt {
  constructor(readonly inner: D1PreparedStatement, private c: { n: number }) {}
  bind(...a: unknown[]) { return new CStmt(this.inner.bind(...a), this.c); }
  first(...a: unknown[]) { this.c.n++; return (this.inner.first as (...x: unknown[]) => unknown)(...a); }
  run() { this.c.n++; return this.inner.run(); }
  all() { this.c.n++; return this.inner.all(); }
  raw() { this.c.n++; return this.inner.raw(); }
}

/** Wraps D1 and counts round trips (a batch counts as one). */
export function countingDb(real: D1Database = env.DB) {
  const c = { n: 0 };
  const db = {
    prepare: (sql: string) => new CStmt(real.prepare(sql), c),
    batch: (stmts: CStmt[]) => { c.n++; return real.batch(stmts.map((s) => s.inner)); },
  } as unknown as D1Database;
  return { db, count: () => c.n, reset: () => { c.n = 0; } };
}

export const sha = async (s: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))), (b) => b.toString(16).padStart(2, '0')).join('');

// A core app over fake ports with helpers to call it like the app does.
import { createApp } from '../../src/http/app.ts';
import type { App } from '../../src/http/app.ts';
import { API } from '../../src/http/paths.ts';
import { fakePorts } from '../../src/fakes/index.ts';
import type { FakePorts } from '../../src/fakes/index.ts';
import type { Ports } from '../../src/ports/index.ts';
import type { Store } from '../../src/ports/store.ts';
import { http, json, request } from '../helpers.ts';
import { TestIdp } from './idp.ts';

export interface Reply<T = unknown> {
  readonly status: number;
  readonly headers: Headers;
  readonly body: T;
}

export interface CallOptions {
  readonly token?: string;
  readonly body?: unknown;
  readonly headers?: Record<string, string>;
}

export interface Api {
  readonly app: App;
  readonly ports: FakePorts;
  readonly idp: TestIdp;
  call<T = unknown>(method: string, path: string, options?: CallOptions): Promise<Reply<T>>;
  /** Signs in with Google as `sub`; returns the session token and account id. */
  google(sub: string, email?: string, name?: string): Promise<{ token: string; accountId: string; created: boolean }>;
  /** Signs in with an email code as the app does: start, read the mail, verify. */
  emailSignIn(email: string): Promise<{ token: string; accountId: string; created: boolean }>;
  /** The code in the last email sent. */
  lastCode(): string;
}

export async function testApi(overrides: Partial<Ports> & { store?: Store } = {}): Promise<Api> {
  const base = fakePorts();
  const idp = await TestIdp.create(() => base.clock.nowMs());
  const ports = { ...base, keys: idp.keys, ...overrides } as FakePorts;
  const app = createApp(ports, { log: () => {} });

  const call = async <T>(method: string, path: string, o: CallOptions = {}): Promise<Reply<T>> => {
    const headers: Record<string, string> = { ...o.headers };
    if (o.token) headers['Authorization'] = `Bearer ${o.token}`;
    let body: string | undefined;
    if (o.body !== undefined) {
      body = typeof o.body === 'string' ? o.body : JSON.stringify(o.body);
      headers['Content-Type'] ??= 'application/json';
    }
    const res = http(await app.handle(request(method, path.startsWith('/') ? path : `${API}/${path}`, { headers, ...(body !== undefined ? { body } : {}) })));
    const text = res.body === null ? '' : await json<T>(res).catch(() => null as T);
    return { status: res.status, headers: res.headers, body: (res.body === null ? null : text) as T };
  };

  const lastCode = (): string => {
    const mail = ports.mailer.sent.at(-1);
    const m = /(\d{6})/.exec(mail?.text ?? '');
    if (!m) throw new Error('no code mailed');
    return m[1] as string;
  };

  type SignIn = { session: string; account: { id: string }; created: boolean };
  const done = (r: Reply<SignIn>) => {
    if (r.status !== 200) throw new Error(`sign-in failed: ${r.status} ${JSON.stringify(r.body)}`);
    return { token: r.body.session, accountId: r.body.account.id, created: r.body.created };
  };

  return {
    app, ports, idp, call, lastCode,
    async google(sub, email, name) {
      const idToken = await idp.googleToken({ sub, nonce: 'n-1', ...(email ? { email, emailVerified: true } : {}), ...(name ? { name } : {}) });
      return done(await call<SignIn>('POST', 'auth/token', { body: { provider: 'google', idToken, nonce: 'n-1' } }));
    },
    async emailSignIn(email) {
      const start = await call('POST', 'auth/email/start', { body: { email } });
      if (start.status !== 202) throw new Error(`start failed: ${start.status}`);
      return done(await call<SignIn>('POST', 'auth/email/verify', { body: { email, code: lastCode() } }));
    },
  };
}

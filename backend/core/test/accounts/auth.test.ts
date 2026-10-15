// Sign-in providers, email codes, sessions and the account routes (task 3.5).
import { describe, expect, it } from 'vitest';
import { cachedKeyFetcher, staticKeyFetcher } from '../../src/auth/keys.ts';
import { constantTimeEqual, fromBase64Url, hmacSha256Hex, sha256Hex } from '../../src/auth/crypto.ts';
import { verifyIdToken } from '../../src/auth/jwt.ts';
import { GOOGLE_ISSUERS, GOOGLE_JWKS, defaultDisplayName, normalizeEmail, sixDigitCode } from '../../src/auth/providers.ts';
import { FakeClock, FakeRandom, testConfig } from '../../src/fakes/index.ts';
import type { Random } from '../../src/ports/random.ts';
import { testApi } from '../support/api.ts';

type ErrorBody = { error: { code: string; message: string; details: unknown } };
const code = (r: { body: unknown }) => (r.body as ErrorBody).error.code;

describe('Google and Apple ID tokens', () => {
  async function tokenSignIn(api: Awaited<ReturnType<typeof testApi>>, provider: string, idToken: string, nonce = 'n-1') {
    return api.call('POST', 'auth/token', { body: { provider, idToken, nonce } });
  }

  it('accepts a valid Google token and refuses wrong aud, expired, wrong iss, other key, other nonce', async () => {
    const api = await testApi();
    const ok = await tokenSignIn(api, 'google', await api.idp.googleToken({ sub: 's1', nonce: 'n-1' }));
    expect(ok.status).toBe(200);
    const refused = [
      await api.idp.googleToken({ sub: 's1', nonce: 'n-1', aud: 'someone-else.test' }),
      await api.idp.googleToken({ sub: 's1', nonce: 'n-1', expiresIn: -120 }),
      await api.idp.googleToken({ sub: 's1', nonce: 'n-1', iss: 'https://evil.example' }),
      await api.idp.googleToken({ sub: 's1', nonce: 'n-1', foreignKey: true }),
      await api.idp.googleToken({ sub: 's1', nonce: 'other' }),
      await api.idp.googleToken({ sub: 's1', nonce: 'n-1', kid: 'unknown-kid' }),
      'not.a.token',
      'a.b',
    ];
    for (const idToken of refused) {
      const r = await tokenSignIn(api, 'google', idToken);
      expect([r.status, code(r)]).toEqual([401, 'unauthorized']);
      expect((r.body as ErrorBody).error.message).toBe('Sign-in could not be verified');
    }
  });

  it('accepts an array aud that names the client and both Google issuers', async () => {
    const api = await testApi();
    const t1 = await api.idp.googleToken({ sub: 's1', nonce: 'n-1', aud: ['other', 'google-client.test'] });
    const t2 = await api.idp.googleToken({ sub: 's1', nonce: 'n-1', iss: GOOGLE_ISSUERS[1] });
    expect((await tokenSignIn(api, 'google', t1)).status).toBe(200);
    expect((await tokenSignIn(api, 'google', t2)).status).toBe(200);
  });

  it('checks Apple tokens against the hashed nonce and the Apple client ids', async () => {
    const api = await testApi();
    expect((await tokenSignIn(api, 'apple', await api.idp.appleToken({ sub: 'a', nonce: 'raw' }), 'raw')).status).toBe(200);
    expect((await tokenSignIn(api, 'apple', await api.idp.appleToken({ sub: 'a', nonce: 'raw' }), 'other')).status).toBe(401);
    expect((await tokenSignIn(api, 'apple', await api.idp.appleToken({ sub: 'a', nonce: 'raw', aud: 'google-client.test' }), 'raw')).status).toBe(401);
    expect((await tokenSignIn(api, 'apple', await api.idp.appleToken({ sub: 'a', nonce: 'raw', expiresIn: -61 }), 'raw')).status).toBe(401);
    expect((await tokenSignIn(api, 'apple', await api.idp.appleToken({ sub: 'a', nonce: 'raw', iss: GOOGLE_ISSUERS[0] }), 'raw')).status).toBe(401);
    // A Google token is not an Apple token.
    expect((await tokenSignIn(api, 'apple', await api.idp.googleToken({ sub: 'a', nonce: 'raw' }), 'raw')).status).toBe(401);
  });

  it('allows a minute of clock skew on exp', async () => {
    const api = await testApi();
    expect((await tokenSignIn(api, 'google', await api.idp.googleToken({ sub: 's1', nonce: 'n-1', expiresIn: -30 }))).status).toBe(200);
  });

  it('refuses disabled or unknown providers and malformed bodies', async () => {
    const api = await testApi({ config: testConfig({ SIGN_IN: 'email' }) });
    const idToken = await api.idp.googleToken({ sub: 's1', nonce: 'n-1' });
    for (const body of [
      { provider: 'google', idToken, nonce: 'n-1' },
      { provider: 'email', idToken, nonce: 'n-1' },
      { provider: 'facebook', idToken, nonce: 'n-1' },
    ]) {
      const r = await api.call('POST', 'auth/token', { body });
      expect([r.status, (r.body as ErrorBody).error.details]).toEqual([400, { field: 'provider' }]);
    }
    const api2 = await testApi();
    expect((await api2.call('POST', 'auth/token', { body: { provider: 'google', idToken, nonce: 'n-1', extra: 1 } })).status).toBe(400);
    expect((await api2.call('POST', 'auth/token', { body: { provider: 'google', nonce: 'n-1' } })).body).toEqual({
      error: { code: 'invalid_payload', message: 'idToken: required', details: { field: 'idToken' } },
    });
    expect((await api2.call('POST', 'auth/token', { body: { provider: 'google', idToken: 'x'.repeat(8193), nonce: 'n' } })).status).toBe(400);
  });

  it('uses the email only when the provider verified it', async () => {
    const api = await testApi();
    const email = await api.emailSignIn('mum@example.com');
    const unverified = await api.call<{ account: { id: string } }>('POST', 'auth/token', {
      body: { provider: 'google', idToken: await api.idp.googleToken({ sub: 'g', nonce: 'n-1', email: 'mum@example.com', emailVerified: false }), nonce: 'n-1' },
    });
    expect(unverified.body.account.id).not.toBe(email.accountId);
  });

  it('caches keys and refetches once for an unknown key id', async () => {
    const clock = new FakeClock();
    const calls: string[] = [];
    const fetcher = cachedKeyFetcher(async (url) => {
      calls.push(url);
      return { ok: true, json: async () => ({ keys: [{ kty: 'RSA', kid: `k${calls.length}`, n: 'x', e: 'AQAB' }] }) };
    }, clock);
    expect((await fetcher.keys('u', false))[0]?.kid).toBe('k1');
    expect((await fetcher.keys('u', false))[0]?.kid).toBe('k1');
    expect((await fetcher.keys('u', true))[0]?.kid).toBe('k1');
    clock.advance(60_000);
    expect((await fetcher.keys('u', true))[0]?.kid).toBe('k2');
    clock.advance(3_600_000);
    expect((await fetcher.keys('u', false))[0]?.kid).toBe('k3');
    expect(calls).toHaveLength(3);
    const failing = cachedKeyFetcher(async () => ({ ok: false, json: async () => ({}) }), clock);
    await expect(failing.keys('u', false)).rejects.toThrow('key fetch failed');
  });

  it('a JWKS without the key verifies nothing', async () => {
    const claims = await verifyIdToken('a.b.c', staticKeyFetcher({}), {
      jwksUrl: GOOGLE_JWKS, issuers: GOOGLE_ISSUERS, audiences: ['x'], nonce: 'n', nowMs: 0,
    });
    expect(claims).toBeNull();
  });
});

describe('email codes', () => {
  it('normalizes addresses and refuses what is not one', () => {
    expect(normalizeEmail('  Mum@Example.COM ')).toBe('mum@example.com');
    for (const bad of ['', 'mum', 'mum@', '@example.com', 'mum@example', 'a b@example.com', 'mum@exa mple.com', `${'a'.repeat(250)}@x.co`, 'mum\u0007@example.com']) {
      expect(normalizeEmail(bad), bad).toBeNull();
    }
  });

  it('codes are six digits without modulo bias', () => {
    const fixed = (values: number[][]): Random => {
      let i = 0;
      return { bytes: () => new Uint8Array(values[i++] ?? [0, 0, 0, 0]), uuid: () => '' };
    };
    // 0xFFFFFFFF is above the largest multiple of 10^6 below 2^32: it is drawn again.
    expect(sixDigitCode(fixed([[0xff, 0xff, 0xff, 0xff], [0, 0, 0, 42]]))).toBe('000042');
    expect(sixDigitCode(new FakeRandom())).toMatch(/^\d{6}$/);
  });

  it('start always answers 202 and stores only a MAC', async () => {
    const api = await testApi();
    const r = await api.call('POST', 'auth/email/start', { body: { email: 'new@example.com' } });
    expect([r.status, r.body]).toEqual([202, null]);
    const known = await api.emailSignIn('known@example.com');
    expect(known.created).toBe(true);
    expect((await api.call('POST', 'auth/email/start', { body: { email: 'known@example.com' } })).status).toBe(202);
    const codeSent = api.lastCode();
    const hash = await sha256Hex('known@example.com');
    const mac = await api.ports.store.takeEmailCodeAttempt(hash, 1_791_817_445, 5);
    expect(mac).toBe(await hmacSha256Hex('test-email-code-key', `known@example.com${codeSent}`));
    expect(mac).not.toContain(codeSent);
  });

  it('a code expires after 10 minutes', async () => {
    const api = await testApi();
    await api.call('POST', 'auth/email/start', { body: { email: 'mum@example.com' } });
    api.ports.clock.advance(600_000);
    const r = await api.call('POST', 'auth/email/verify', { body: { email: 'mum@example.com', code: api.lastCode() } });
    expect([r.status, code(r)]).toEqual([400, 'invalid_code']);
  });

  it('a code works once and only for its address', async () => {
    const api = await testApi();
    await api.call('POST', 'auth/email/start', { body: { email: 'mum@example.com' } });
    const c = api.lastCode();
    expect((await api.call('POST', 'auth/email/verify', { body: { email: 'dad@example.com', code: c } })).status).toBe(400);
    expect((await api.call('POST', 'auth/email/verify', { body: { email: 'mum@example.com', code: c } })).status).toBe(200);
    expect((await api.call('POST', 'auth/email/verify', { body: { email: 'mum@example.com', code: c } })).status).toBe(400);
  });

  it('a new code replaces the old one', async () => {
    const api = await testApi();
    await api.call('POST', 'auth/email/start', { body: { email: 'mum@example.com' } });
    const old = api.lastCode();
    await api.call('POST', 'auth/email/start', { body: { email: 'mum@example.com' } });
    const fresh = api.lastCode();
    if (old !== fresh) expect((await api.call('POST', 'auth/email/verify', { body: { email: 'mum@example.com', code: old } })).status).toBe(400);
    expect((await api.call('POST', 'auth/email/verify', { body: { email: 'mum@example.com', code: fresh } })).status).toBe(200);
  });

  it('refuses bad input, and the routes are off when email sign-in is off', async () => {
    const api = await testApi();
    expect((await api.call('POST', 'auth/email/start', { body: { email: 'nope' } })).body).toEqual({
      error: { code: 'invalid_payload', message: 'email: invalid email address', details: { field: 'email' } },
    });
    expect((await api.call('POST', 'auth/email/start', { body: { email: 'a@b.co', x: 1 } })).status).toBe(400);
    expect(code(await api.call('POST', 'auth/email/verify', { body: { email: 'a@b.co', code: '12345' } }))).toBe('invalid_code');
    expect(code(await api.call('POST', 'auth/email/verify', { body: { email: 'a@b.co', code: 'abcdef' } }))).toBe('invalid_code');
    expect(api.ports.mailer.sent).toEqual([]);
    const off = await testApi({ config: testConfig({ SIGN_IN: 'google' }) });
    expect((await off.call('POST', 'auth/email/start', { body: { email: 'a@b.co' } })).status).toBe(404);
    expect((await off.call('POST', 'auth/email/verify', { body: { email: 'a@b.co', code: '123456' } })).status).toBe(404);
  });

  it('answers 503 when the mail provider refuses', async () => {
    const api = await testApi();
    api.ports.mailer.failing = true;
    const r = await api.call('POST', 'auth/email/start', { body: { email: 'a@b.co' } });
    expect([r.status, code(r), r.headers.get('Retry-After')]).toEqual([503, 'service_unavailable', '60']);
  });
});

describe('sessions', () => {
  it('tokens are st_ plus 43 base64url characters, stored hashed', async () => {
    const api = await testApi();
    const { token, accountId } = await api.google('s1');
    expect(token).toMatch(/^st_[A-Za-z0-9_-]{43}$/);
    expect(fromBase64Url(token.slice(3))).toHaveLength(32);
    const stored = await api.ports.store.getSession(await sha256Hex(token));
    expect(stored?.accountId).toBe(accountId);
    expect(await api.ports.store.getSession(token)).toBeNull();
  });

  it('refuses malformed and unknown bearer values before or after the store', async () => {
    const api = await testApi();
    for (const header of ['', 'Bearer', 'Bearer st_short', `Basic st_${'a'.repeat(43)}`, `Bearer st_${'a'.repeat(43)}`, `Bearer  st_${'a'.repeat(43)}`]) {
      const r = await api.call('GET', 'me', { headers: header ? { Authorization: header } : {} });
      expect([r.status, code(r)], header).toEqual([401, 'unauthorized']);
    }
  });

  it('records use at most once a day', async () => {
    const api = await testApi();
    const { token, accountId } = await api.google('s1');
    const hash = await sha256Hex(token);
    const startedAt = (await api.ports.store.getSession(hash))?.lastUsedAt as number;
    api.ports.clock.advance(3_600_000);
    await api.call('GET', 'me', { token });
    expect((await api.ports.store.getSession(hash))?.lastUsedAt).toBe(startedAt);
    api.ports.clock.advance(86_400_000);
    await api.call('GET', 'me', { token });
    expect((await api.ports.store.getSession(hash))?.lastUsedAt).toBe(startedAt + 90_000);
    expect((await api.ports.store.getAccount(accountId))?.lastActiveAt).toBe(startedAt + 90_000);
  });

  it('sign-out needs the session', async () => {
    const api = await testApi();
    expect((await api.call('POST', 'auth/signout')).status).toBe(401);
  });
});

describe('the account', () => {
  it('GET /config tells the app what the region offers', async () => {
    const api = await testApi({ config: testConfig({ FEATURE_SPOTIFY: '1' }) });
    const r = await api.call('GET', 'config');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({
      region: 'global', live: 'ws', signIn: ['apple', 'google', 'email'], stores: ['apple', 'google'], features: { spotify: true },
      ui: { memoBadge: 'top-right' },
    });
    expect(r.headers.get('Cache-Control')).toBe('public, max-age=300');
    const left = await testApi({ config: testConfig({ UI_MEMO_BADGE: 'top-left', SIGN_IN: 'email', LIVE_MODE: 'poll' }) });
    expect((await left.call('GET', 'config')).body).toMatchObject({ live: 'poll', signIn: ['email'], ui: { memoBadge: 'top-left' } });
  });

  it('GET /me shows the plan, the methods, usage and limits', async () => {
    const api = await testApi();
    const { token, accountId } = await api.google('s1', 'mum@example.com', 'Mum');
    const me = await api.call('GET', 'me', { token });
    expect(me.body).toEqual({
      id: accountId, displayName: 'Mum', plan: 'free', planExpiresAt: null, identities: [{ provider: 'google', email: 'mum@example.com' }],
      usage: { events: 0, photos: 0, animated_backdrop: 0, custom_audio: 0, spotify_events: 0 },
      limits: { events: 10, photos: 5, animated_backdrop: 0, premium_audio: 0, custom_audio: 0, spotify_events: 3 },
      createdAt: '2026-10-12T15:04:05Z',
    });
    expect(me.headers.get('Cache-Control')).toBe('no-store');
  });

  it('PATCH /me changes the display name with the title rule', async () => {
    const api = await testApi();
    const { token } = await api.google('s1');
    expect((await api.call<{ displayName: string }>('PATCH', 'me', { token, body: { displayName: ' Mum ' } })).body.displayName).toBe('Mum');
    for (const body of [{ displayName: '' }, { displayName: 'x'.repeat(101) }, { displayName: 'a\nb' }, {}, { displayName: 'ok', plan: 'premium' }]) {
      expect((await api.call('PATCH', 'me', { token, body })).status, JSON.stringify(body)).toBe(400);
    }
  });

  it('POST /me/identities adds a method, once, and never another account\'s', async () => {
    const api = await testApi();
    const a = await api.google('s1');
    const b = await api.emailSignIn('other@example.com');
    api.ports.clock.advance(1000);
    await api.call('POST', 'auth/email/start', { body: { email: 'mum@example.com' } });
    const added = await api.call<{ identities: unknown[] }>('POST', 'me/identities', { token: a.token, body: { email: 'mum@example.com', code: api.lastCode() } });
    expect(added.body.identities).toEqual([{ provider: 'google', email: null }, { provider: 'email', email: 'mum@example.com' }]);
    const idToken = await api.idp.googleToken({ sub: 's1', nonce: 'n-1' });
    expect((await api.call('POST', 'me/identities', { token: a.token, body: { provider: 'google', idToken, nonce: 'n-1' } })).status).toBe(200);
    const taken = await api.call('POST', 'me/identities', { token: b.token, body: { provider: 'google', idToken, nonce: 'n-1' } });
    expect([taken.status, code(taken)]).toEqual([409, 'conflict']);
    expect((await api.call('POST', 'me/identities', { token: a.token, body: { provider: 'google', idToken: 'bad', nonce: 'n-1' } })).status).toBe(401);
    expect((await api.call('POST', 'me/identities', { body: { provider: 'google', idToken, nonce: 'n-1' } })).status).toBe(401);
  });

  it('the email method signs in to the same account after adding it', async () => {
    const api = await testApi();
    const a = await api.google('s1');
    await api.call('POST', 'auth/email/start', { body: { email: 'mum@example.com' } });
    await api.call('POST', 'me/identities', { token: a.token, body: { email: 'mum@example.com', code: api.lastCode() } });
    expect((await api.emailSignIn('mum@example.com')).accountId).toBe(a.accountId);
  });

  it('DELETE /me ends every session and frees the sign-in methods', async () => {
    const api = await testApi();
    const a = await api.google('s1');
    const second = await api.google('s1');
    expect((await api.call('DELETE', 'me', { token: a.token })).status).toBe(204);
    expect((await api.call('GET', 'me', { token: second.token })).status).toBe(401);
    expect((await api.google('s1')).created).toBe(true);
  });

  it('default display names come from the provider, the email or a fallback', () => {
    const base = { provider: 'google' as const, subject: 's', emailVerified: true };
    expect(defaultDisplayName({ ...base, email: 'mum@example.com', name: '  Mum  ' })).toBe('Mum');
    expect(defaultDisplayName({ ...base, email: 'mum@example.com', name: null })).toBe('mum');
    expect(defaultDisplayName({ ...base, email: null, name: null })).toBe('Me');
    expect(defaultDisplayName({ ...base, email: null, name: `a‮b${'c'.repeat(200)}` })).toHaveLength(100);
  });

  it('the Apple callback takes form posts only and uses the configured scheme', async () => {
    const api = await testApi({ config: testConfig({ APP_SCHEME: 'dtm-dev' }) });
    const form = { body: 'state=s&error=user_cancelled_authorize', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
    const r = await api.call('POST', '/auth/apple/callback', form);
    expect(r.headers.get('Location')).toBe('intent://auth/apple?state=s&error=user_cancelled_authorize#Intent;scheme=dtm-dev;end');
    expect((await api.call('POST', '/auth/apple/callback', { body: { state: 's' } })).status).toBe(415);
    expect((await api.call('GET', '/auth/apple/callback')).status).toBe(404);
  });
});

describe('crypto helpers', () => {
  it('compare in constant time and decode base64url', async () => {
    expect([constantTimeEqual('abc', 'abc'), constantTimeEqual('abc', 'abd'), constantTimeEqual('abc', 'ab')]).toEqual([true, false, false]);
    expect(fromBase64Url('aGk')).toEqual(new TextEncoder().encode('hi'));
    expect([fromBase64Url('a+b'), fromBase64Url('a')]).toEqual([null, null]);
    expect(await sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});

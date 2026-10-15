// Scenarios of openspec/changes/pluggable-backend-live-sharing/specs/accounts/spec.md that the backend
// core serves, one test per scenario, named after it. Scenarios only the app shows, and those of later
// tasks, are listed in test/spec-coverage.test.ts.
import { describe, expect, it } from 'vitest';
import { testApi } from '../support/api.ts';

const T0 = 1_791_817_445;
const EVENT = '0b8f3c1e-6d0a-4a51-9f61-2f1b3f6d9a10';
const DOC = { title: 'Our wedding', targetDate: '2027-06-12', theme: { paletteId: 'violet', cardStyle: 'glass', typography: 'modern' } };
const DAY_MS = 86_400_000;

describe('accounts scenarios', () => {
  it('Guest creates events offline', async () => {
    // Guests send nothing; a request without a session is refused and stores nothing.
    const api = await testApi();
    expect((await api.call('PUT', `events/${EVENT}`, { body: DOC })).status).toBe(401);
    expect((await api.call('GET', 'sync')).status).toBe(401);
    expect(await api.ports.store.getEvent(EVENT)).toBeNull();
  });

  it('Guest taps Sync', async () => {
    const api = await testApi();
    const res = await api.call('GET', 'sync');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: 'unauthorized', message: 'Sign in required', details: null } });
  });

  it('Create an account on iOS', async () => {
    const api = await testApi();
    const idToken = await api.idp.appleToken({ sub: 'apple-sub-1', nonce: 'raw-nonce', email: 'mum@privaterelay.appleid.com', emailVerified: 'true' });
    const res = await api.call<{ session: string; created: boolean; account: { displayName: string; plan: string } }>('POST', 'auth/token', {
      body: { provider: 'apple', idToken, nonce: 'raw-nonce' },
    });
    expect(res.status).toBe(200);
    expect(res.body.created).toBe(true);
    expect(res.body.session).toMatch(/^st_[A-Za-z0-9_-]{43}$/);
    expect([res.body.account.displayName, res.body.account.plan]).toEqual(['mum', 'free']);
    const me = await api.call<{ identities: unknown[] }>('GET', 'me', { token: res.body.session });
    expect(me.status).toBe(200);
    expect(me.body.identities).toEqual([{ provider: 'apple', email: 'mum@privaterelay.appleid.com' }]);
  });

  it('Sign in with Apple on Android', async () => {
    const api = await testApi();
    const idToken = await api.idp.appleToken({ sub: 'apple-sub-2', nonce: 'android-nonce', aud: 'app.test.web' });
    const form = new URLSearchParams({ code: 'c0de', id_token: idToken, state: 'st4te', user: '{"name":{"firstName":"Mum"}}', extra: 'dropped' });
    const callback = await api.call('POST', '/auth/apple/callback', {
      body: form.toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    expect(callback.status).toBe(303);
    expect(callback.headers.get('Set-Cookie')).toBeNull();
    expect(callback.headers.get('Cache-Control')).toBe('no-store');
    const location = callback.headers.get('Location') as string;
    expect(location).toMatch(/^intent:\/\/auth\/apple\?.*#Intent;scheme=daysthatmatter;end$/);
    const passed = new URLSearchParams(location.slice('intent://auth/apple?'.length, location.indexOf('#')));
    expect([...passed.keys()]).toEqual(['code', 'id_token', 'state', 'user']);
    expect(passed.get('id_token')).toBe(idToken);
    // The callback stored nothing: no account exists until the app signs in with the token.
    expect(await api.ports.store.listIdentities('any')).toEqual([]);
    const signIn = await api.call<{ created: boolean }>('POST', 'auth/token', { body: { provider: 'apple', idToken: passed.get('id_token'), nonce: 'android-nonce' } });
    expect([signIn.status, signIn.body.created]).toEqual([200, true]);
  });

  it('Sign in with email', async () => {
    const api = await testApi();
    const first = await api.emailSignIn('  Mum@Example.com ');
    expect(first.created).toBe(true);
    const mail = api.ports.mailer.sent[0];
    expect(mail?.to).toBe('mum@example.com');
    expect(mail?.text).toMatch(/^Your Days That Matter sign-in code is \d{6}\. It works for 10 minutes\.$/);
    const again = await api.emailSignIn('mum@example.com');
    expect([again.created, again.accountId]).toEqual([false, first.accountId]);
    const me = await api.call<{ displayName: string }>('GET', 'me', { token: again.token });
    expect(me.body.displayName).toBe('mum');
  });

  it('Wrong code five times', async () => {
    const api = await testApi();
    await api.call('POST', 'auth/email/start', { body: { email: 'mum@example.com' } });
    const code = api.lastCode();
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      const r = await api.call('POST', 'auth/email/verify', { body: { email: 'mum@example.com', code: wrong } });
      expect([r.status, (r.body as { error: { code: string } }).error.code]).toEqual([400, 'invalid_code']);
    }
    const right = await api.call('POST', 'auth/email/verify', { body: { email: 'mum@example.com', code } });
    expect([right.status, (right.body as { error: { code: string } }).error.code]).toEqual([400, 'invalid_code']);
    // A new code works.
    expect((await api.emailSignIn('mum@example.com')).created).toBe(true);
  });

  it('Email then Google with the same address', async () => {
    const api = await testApi();
    const email = await api.emailSignIn('mum@example.com');
    await api.ports.store.createEvent({ id: EVENT, ownerId: email.accountId, doc: DOC, now: T0 });
    const google = await api.google('google-sub-1', 'MUM@example.com');
    expect([google.accountId, google.created]).toEqual([email.accountId, false]);
    const manifest = await api.call<{ events: { id: string }[] }>('GET', 'sync', { token: google.token });
    expect(manifest.body.events.map((e) => e.id)).toEqual([EVENT]);
    const me = await api.call<{ identities: { provider: string }[] }>('GET', 'me', { token: google.token });
    expect(me.body.identities.map((i) => i.provider)).toEqual(['email', 'google']);
  });

  it('Session expired', async () => {
    const api = await testApi();
    const { token } = await api.google('google-sub-1');
    api.ports.clock.advance(90 * DAY_MS);
    expect((await api.call('GET', 'me', { token })).status).toBe(200);
    api.ports.clock.advance(90 * DAY_MS + 1000);
    const expired = await api.call('GET', 'me', { token });
    expect([expired.status, (expired.body as { error: { code: string } }).error.code]).toEqual([401, 'unauthorized']);
    expect((await api.call('GET', 'me', { token })).status).toBe(401);
  });

  it('Sign out on one device', async () => {
    const api = await testApi();
    const phone = await api.google('google-sub-1');
    const tablet = await api.google('google-sub-1');
    expect((await api.call('POST', 'auth/signout', { token: phone.token })).status).toBe(204);
    expect((await api.call('GET', 'me', { token: phone.token })).status).toBe(401);
    expect((await api.call('GET', 'me', { token: tablet.token })).status).toBe(200);
  });

  it('Name in history', async () => {
    // The revision records the editor's account; history (task 3.7) shows its display name.
    const api = await testApi();
    const owner = await api.google('owner-sub');
    const editor = await api.google('editor-sub', undefined, 'Someone');
    expect((await api.call('PATCH', 'me', { token: editor.token, body: { displayName: '  Mum ' } })).status).toBe(200);
    await api.ports.store.createEvent({ id: EVENT, ownerId: owner.accountId, doc: DOC, now: T0 });
    await api.ports.store.putMember({ eventId: EVENT, accountId: editor.accountId, role: 'editor', inviteId: null, now: T0 });
    const res = await api.call('PATCH', `events/${EVENT}`, { token: editor.token, body: { baseRev: 1, patch: { targetDate: '2027-06-13' } } });
    expect(res.status).toBe(200);
    const [revision] = await api.ports.store.listRevisions(EVENT, { limit: 1 });
    expect(revision?.authorId).toBe(editor.accountId);
    expect((await api.ports.store.getAccount(revision?.authorId as string))?.displayName).toBe('Mum');
  });

  it('Owner deletes the account', async () => {
    const api = await testApi();
    const owner = await api.google('owner-sub');
    const member = await api.google('member-sub');
    await api.ports.store.createEvent({ id: EVENT, ownerId: owner.accountId, doc: DOC, now: T0 });
    await api.ports.store.putMember({ eventId: EVENT, accountId: member.accountId, role: 'editor', inviteId: null, now: T0 });
    expect((await api.call<{ events: unknown[] }>('GET', 'sync', { token: member.token })).body.events).toHaveLength(1);

    expect((await api.call('DELETE', 'me', { token: owner.token })).status).toBe(204);
    // Links answer for a tombstone: "no longer available" (410), and the event keeps no content.
    const event = await api.ports.store.getEvent(EVENT);
    expect([event?.deletedAt !== null, event?.doc]).toEqual([true, {}]);
    expect((await api.call<{ events: unknown[] }>('GET', 'sync', { token: member.token })).body.events).toEqual([]);
    expect((await api.call('GET', `events/${EVENT}`, { token: member.token })).status).toBe(403);
    expect((await api.call('GET', 'me', { token: owner.token })).status).toBe(401);
    expect(api.ports.live.published).toContainEqual({ eventId: EVENT, message: { type: 'access' } });
  });
});

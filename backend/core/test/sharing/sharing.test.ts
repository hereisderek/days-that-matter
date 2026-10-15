// Sharing handlers beyond the spec scenarios: settings and their validation, owner-only rules, error
// codes, member limits, access notices, and how invite tokens are stored.
import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../../src/auth/crypto.ts';
import { openInviteToken, sealInviteToken } from '../../src/auth/invite-token.ts';
import { FakeRandom, testConfig } from '../../src/fakes/index.ts';
import { testApi } from '../support/api.ts';
import type { Api } from '../support/api.ts';
import { DAY_MS, DOC, pick, sharedEvent, uuid } from '../support/events.ts';
import type { ErrorBody, Person } from '../support/events.ts';

type LinkInfo = { id: string; label: string | null; url: string; expiresAt: string | null };
type InviteInfo = { id: string; url: string; role: string; maxUses: number | null; useCount: number; expiresAt: string | null };
type Sharing = { links: LinkInfo[]; invites: InviteInfo[]; members: { accountId: string; role: string }[]; removed: unknown[] };

const tokenOf = (url: string): string => url.slice(url.lastIndexOf('/') + 1);
const iso = (a: Api, plusMs: number): string => new Date(a.ports.clock.nowMs() + plusMs).toISOString();

async function setup(people: Readonly<Record<string, 'viewer' | 'editor'>> = { Editor: 'editor' }) {
  const a = await testApi();
  const { owner, people: p } = await sharedEvent(a, people);
  return { a, owner, people: p };
}

async function link(a: Api, owner: Person, body: Record<string, unknown> = {}): Promise<LinkInfo> {
  const r = await a.call<LinkInfo>('POST', `events/${uuid(1)}/links`, { token: owner.token, body });
  expect(r.status).toBe(201);
  return r.body;
}

async function invite(a: Api, owner: Person, body: Record<string, unknown> = { role: 'viewer' }): Promise<{ id: string; token: string }> {
  const r = await a.call<{ inviteId: string; url: string }>('POST', `events/${uuid(1)}/invites`, { token: owner.token, body });
  expect(r.status).toBe(201);
  return { id: r.body.inviteId, token: tokenOf(r.body.url) };
}

const sharing = async (a: Api, owner: Person) => (await a.call<Sharing>('GET', `events/${uuid(1)}/sharing`, { token: owner.token })).body;

describe('public links', () => {
  it('change label and expiry, owner only, and refuse revoked and expired links', async () => {
    const { a, owner, people } = await setup();
    const l = await link(a, owner, { label: 'Old', expiresAt: iso(a, 5 * DAY_MS) });
    const changed = await a.call<LinkInfo>('PATCH', `links/${l.id}`, { token: owner.token, body: { label: 'New', expiresAt: null } });
    expect(changed.body).toEqual({ ...l, label: 'New', expiresAt: null });
    expect((await a.call('PATCH', `links/${l.id}`, { token: pick(people, 'Editor').token, body: { label: 'x' } })).status).toBe(403);
    expect((await a.call('DELETE', `links/${l.id}`, { token: pick(people, 'Editor').token })).status).toBe(403);
    expect((await a.call('PATCH', `links/${uuid(77)}`, { token: owner.token, body: {} })).status).toBe(404);
    expect((await a.call('PATCH', 'links/not-an-id', { token: owner.token, body: {} })).status).toBe(404);

    const soon = await link(a, owner, { expiresAt: iso(a, 1000) });
    a.ports.clock.advance(1000);
    expect((await a.call<ErrorBody>('PATCH', `links/${soon.id}`, { token: owner.token, body: { expiresAt: null } })).body.error.code).toBe('expired');
    expect((await a.call('DELETE', `links/${l.id}`, { token: owner.token })).status).toBe(204);
    expect((await a.call('DELETE', `links/${l.id}`, { token: owner.token })).status).toBe(204);
    expect((await a.call<ErrorBody>('PATCH', `links/${l.id}`, { token: owner.token, body: { label: 'Back' } })).body.error.code).toBe('revoked');
    expect((await sharing(a, owner)).links).toEqual([]);
  });

  it('validates labels and expiry choices', async () => {
    const { a, owner } = await setup({});
    const bad = [
      { label: '' }, { label: 'x'.repeat(101) }, { expiresAt: iso(a, -1000) }, { expiresAt: '2031-10-12T15:04:06Z' }, { expiresAt: 'tomorrow' },
      { other: 1 },
    ];
    for (const body of bad) {
      const r = await a.call<ErrorBody>('POST', `events/${uuid(1)}/links`, { token: owner.token, body });
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(r.body.error.code).toBe('invalid_payload');
    }
    expect((await link(a, owner, { expiresAt: '2031-10-12T15:04:05Z' })).expiresAt).toBe('2031-10-12T15:04:05Z');
  });

  it('views drop custom audio and give the live settings of the deployment', async () => {
    const { a, owner } = await setup({});
    await a.ports.store.applyPatch({ eventId: uuid(1), authorId: owner.accountId, baseRev: 1, patch: { audio: { kind: 'custom', mediaId: 'Qm7', title: 'First dance' } }, now: 1 });
    const l = await link(a, owner);
    const view = await a.call<{ event: Record<string, unknown>; serverTime: string; live: unknown }>('GET', `links/${tokenOf(l.url)}`);
    expect(view.body.event).toEqual({ rev: 2, ...DOC });
    expect(view.body.serverTime).toBe('2026-10-12T15:04:05Z');
    expect(view.body.live).toEqual({ mode: 'ws', url: `wss://dtm.example.test/api/v1/live?link=${tokenOf(l.url)}` });

    const poll = await testApi({ config: testConfig({ LIVE_MODE: 'poll' }) });
    const p = await sharedEvent(poll, {});
    const pl = await link(poll, p.owner);
    expect((await poll.call<{ live: unknown }>('GET', `links/${tokenOf(pl.url)}`)).body.live).toEqual({ mode: 'poll', url: null });
  });

  it('answers 410 deleted once the event is deleted', async () => {
    const { a, owner } = await setup({});
    const l = await link(a, owner);
    await a.call('DELETE', `events/${uuid(1)}`, { token: owner.token });
    const r = await a.call<ErrorBody>('GET', `links/${tokenOf(l.url)}`);
    expect([r.status, r.body.error.code]).toEqual([410, 'deleted']);
    expect((await a.call<ErrorBody>('POST', `events/${uuid(1)}/links`, { token: owner.token, body: {} })).body.error.code).toBe('deleted');
  });
});

describe('invites', () => {
  it('default to one use and 30 days, and are stored as a hash and a ciphertext', async () => {
    const { a, owner } = await setup({});
    const i = await invite(a, owner, { role: 'editor' });
    const [listed] = (await sharing(a, owner)).invites;
    expect(listed).toEqual({ id: i.id, url: `https://dtm.example.test/i/${i.token}`, role: 'editor', maxUses: 1, useCount: 0, expiresAt: '2026-11-11T15:04:05Z' });
    const stored = await a.ports.store.getInvite(i.id);
    expect(stored?.tokenHash).toBe(await sha256Hex(i.token));
    expect(stored?.tokenEnc).not.toContain(i.token);
    expect(stored?.tokenEnc).toMatch(/^v1\.[A-Za-z0-9_-]+$/);
  });

  it('change role, use count and expiry; a lowered use count fills the invite', async () => {
    const { a, owner } = await setup({});
    const i = await invite(a, owner, { role: 'viewer', maxUses: 5 });
    const first = await a.google('first-sub');
    await a.call('POST', `invites/${i.token}/join`, { token: first.token });
    const changed = await a.call<InviteInfo>('PATCH', `invites/${i.id}`, { token: owner.token, body: { role: 'editor', maxUses: 1, expiresAt: null } });
    expect(changed.body).toMatchObject({ role: 'editor', maxUses: 1, useCount: 1, expiresAt: null });
    const second = await a.google('second-sub');
    expect((await a.call<ErrorBody>('POST', `invites/${i.token}/join`, { token: second.token })).body.error.code).toBe('invite_full');
    for (const body of [{ maxUses: 0 }, { maxUses: 101 }, { role: 'owner' }, { uses: 2 }]) {
      expect((await a.call('PATCH', `invites/${i.id}`, { token: owner.token, body })).status, JSON.stringify(body)).toBe(400);
    }
    expect((await a.call('PATCH', `invites/${uuid(70)}`, { token: owner.token, body: {} })).status).toBe(404);
  });

  it('refuse revoked and expired invites with their codes and states', async () => {
    const { a, owner } = await setup({});
    const revoked = await invite(a, owner);
    const expiring = await invite(a, owner, { role: 'viewer', expiresAt: iso(a, 1000) });
    expect((await a.call('DELETE', `invites/${revoked.id}`, { token: owner.token })).status).toBe(204);
    a.ports.clock.advance(1000);
    const guest = await a.google('guest-sub');
    for (const [i, state, code] of [[revoked, 'revoked', 'invite_revoked'], [expiring, 'expired', 'invite_expired']] as const) {
      expect((await a.call<{ state: string }>('GET', `invites/${i.token}`, { token: guest.token })).body.state).toBe(state);
      const r = await a.call<ErrorBody>('POST', `invites/${i.token}/join`, { token: guest.token });
      expect([r.status, r.body.error.code]).toEqual([410, code]);
    }
    expect((await a.call<ErrorBody>('PATCH', `invites/${revoked.id}`, { token: owner.token, body: { maxUses: 3 } })).body.error.code).toBe('invite_revoked');
    expect((await a.call<ErrorBody>('PATCH', `invites/${expiring.id}`, { token: owner.token, body: { expiresAt: null } })).body.error.code).toBe('invite_expired');
    expect((await sharing(a, owner)).invites).toEqual([]);
  });

  it('allow at most 20 active invites', async () => {
    const { a, owner } = await setup({});
    for (let i = 0; i < 20; i++) await invite(a, owner);
    const r = await a.call<ErrorBody>('POST', `events/${uuid(1)}/invites`, { token: owner.token, body: { role: 'viewer' } });
    expect([r.status, r.body.error.details]).toEqual([429, { limit: 'invites_per_event' }]);
  });

  it('stop at 100 members', async () => {
    const { a, owner } = await setup({});
    for (let n = 0; n < 100; n++) {
      await a.ports.store.createAccount({ id: `member-${n}`, displayName: `Member ${n}`, now: 0 });
      await a.ports.store.putMember({ eventId: uuid(1), accountId: `member-${n}`, role: 'viewer', inviteId: null, now: 0 });
    }
    const i = await invite(a, owner);
    const late = await a.google('late-sub');
    expect((await a.call<{ state: string }>('GET', `invites/${i.token}`, { token: late.token })).body.state).toBe('full');
    const r = await a.call<ErrorBody>('POST', `invites/${i.token}/join`, { token: late.token });
    expect([r.status, r.body.error.details]).toEqual([429, { limit: 'members_per_event' }]);
  });

  it('of a deleted event answer 410 deleted; unknown and malformed tokens 404', async () => {
    const { a, owner } = await setup({});
    const i = await invite(a, owner);
    const guest = await a.google('guest-sub');
    await a.call('DELETE', `events/${uuid(1)}`, { token: owner.token });
    expect((await a.call<ErrorBody>('GET', `invites/${i.token}`, { token: guest.token })).body.error.code).toBe('deleted');
    expect((await a.call<ErrorBody>('POST', `invites/${i.token}/join`, { token: guest.token })).body.error.code).toBe('deleted');
    expect((await a.call('POST', 'invites/AAAAAAAAAAAAAAAAAAAAAA/join', { token: guest.token })).status).toBe(404);
    expect((await a.call('POST', 'invites/short/join')).status).toBe(404);
    expect((await a.call('GET', 'invites/short')).status).toBe(404);
  });
});

describe('members', () => {
  it('change roles, with the member info back', async () => {
    const { a, owner, people } = await setup({ Viewer: 'viewer' });
    const viewer = pick(people, 'Viewer');
    const r = await a.call('PUT', `events/${uuid(1)}/members/${viewer.accountId}`, { token: owner.token, body: { role: 'editor' } });
    expect(r).toMatchObject({ status: 200, body: { accountId: viewer.accountId, name: 'Viewer', role: 'editor', joinedVia: null } });
    expect((await a.call<{ role: string }>('GET', `events/${uuid(1)}`, { token: viewer.token })).body.role).toBe('editor');
    for (const body of [{ role: 'owner' }, {}, { role: 'viewer', x: 1 }]) {
      expect((await a.call('PUT', `events/${uuid(1)}/members/${viewer.accountId}`, { token: owner.token, body })).status).toBe(400);
    }
    const stranger = await a.google('stranger-sub');
    expect((await a.call('PUT', `events/${uuid(1)}/members/${stranger.accountId}`, { token: owner.token, body: { role: 'viewer' } })).status).toBe(404);
    expect((await a.call('PUT', `events/${uuid(1)}/members/nobody`, { token: owner.token, body: { role: 'viewer' } })).status).toBe(404);
    expect((await a.call('PUT', `events/${uuid(1)}/members/${owner.accountId}`, { token: viewer.token, body: { role: 'viewer' } })).status).toBe(403);
  });

  it('removal is owner only and repeatable; the owner cannot leave', async () => {
    const { a, owner, people } = await setup({ Viewer: 'viewer', Editor: 'editor' });
    const viewer = pick(people, 'Viewer');
    const editor = pick(people, 'Editor');
    expect((await a.call('DELETE', `events/${uuid(1)}/members/${viewer.accountId}`, { token: editor.token })).status).toBe(403);
    expect((await a.call('DELETE', `events/${uuid(1)}/members/me`, { token: owner.token })).status).toBe(403);
    for (let i = 0; i < 2; i++) expect((await a.call('DELETE', `events/${uuid(1)}/members/${viewer.accountId}`, { token: owner.token })).status).toBe(204);
    const stranger = await a.google('stranger-sub');
    expect((await a.call('DELETE', `events/${uuid(1)}/members/${stranger.accountId}`, { token: owner.token })).status).toBe(404);
    expect((await a.call('DELETE', `events/${uuid(1)}/members/me`, { token: stranger.token })).status).toBe(403);
    expect((await a.call('DELETE', `events/${uuid(1)}/members/me`, { token: viewer.token })).status).toBe(403);
    expect((await a.call('DELETE', `events/${uuid(1)}/removed/${viewer.accountId}`, { token: editor.token })).status).toBe(403);
  });
});

describe('access notices', () => {
  it('go out after every link, invite and member change', async () => {
    const { a, owner, people } = await setup({ Viewer: 'viewer' });
    const viewer = pick(people, 'Viewer');
    const notices = (): number => a.ports.live.published.filter((p) => p.message.type === 'access' && p.eventId === uuid(1)).length;
    const steps: [string, () => Promise<unknown>][] = [
      ['create link', () => link(a, owner)],
      ['change link', async () => a.call('PATCH', `links/${(await sharing(a, owner)).links[0]?.id}`, { token: owner.token, body: { label: 'x' } })],
      ['revoke link', async () => a.call('DELETE', `links/${(await sharing(a, owner)).links[0]?.id}`, { token: owner.token })],
      ['create invite', () => invite(a, owner, { role: 'viewer', maxUses: null })],
      ['change invite', async () => a.call('PATCH', `invites/${(await sharing(a, owner)).invites[0]?.id}`, { token: owner.token, body: { role: 'editor' } })],
      ['join', async () => a.call('POST', `invites/${tokenOf((await sharing(a, owner)).invites[0]?.url ?? '')}/join`, { token: (await a.google('joiner-sub')).token })],
      ['role change', () => a.call('PUT', `events/${uuid(1)}/members/${viewer.accountId}`, { token: owner.token, body: { role: 'editor' } })],
      ['remove', () => a.call('DELETE', `events/${uuid(1)}/members/${viewer.accountId}`, { token: owner.token })],
      ['allow again', () => a.call('DELETE', `events/${uuid(1)}/removed/${viewer.accountId}`, { token: owner.token })],
      ['revoke invite', async () => a.call('DELETE', `invites/${(await sharing(a, owner)).invites[0]?.id}`, { token: owner.token })],
    ];
    for (const [name, step] of steps) {
      const before = notices();
      await step();
      expect(notices(), name).toBe(before + 1);
    }
  });
});

describe('invite token sealing', () => {
  it('opens only for the same invite id and key, and every seal differs', async () => {
    const random = new FakeRandom();
    const token = 'AbCdEfGhIjKlMnOpQrStUv';
    const sealed = await sealInviteToken('key-1', 'invite-a', token, random);
    expect(await openInviteToken('key-1', 'invite-a', sealed)).toBe(token);
    expect(await openInviteToken('key-1', 'invite-b', sealed)).toBeNull();
    expect(await openInviteToken('key-2', 'invite-a', sealed)).toBeNull();
    expect(await sealInviteToken('key-1', 'invite-a', token, random)).not.toBe(sealed);
    const tampered = sealed.slice(0, -2) + (sealed.endsWith('AA') ? 'BB' : 'AA');
    expect(await openInviteToken('key-1', 'invite-a', tampered)).toBeNull();
    for (const junk of ['', 'v1.', 'v1.***', 'v2.AAAA', 'v1.AAAA']) expect(await openInviteToken('key-1', 'invite-a', junk)).toBeNull();
  });

  it('a sharing list leaves out an invite sealed under another key', async () => {
    const { a, owner } = await setup({});
    await invite(a, owner);
    const rotated = await testApi({ store: a.ports.store, config: testConfig({ INVITE_KEY: 'another-key' }) });
    const tablet = await rotated.google('owner-sub');
    expect((await rotated.call<Sharing>('GET', `events/${uuid(1)}/sharing`, { token: tablet.token })).body.invites).toEqual([]);
  });
});

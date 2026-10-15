// Scenarios of openspec/changes/pluggable-backend-live-sharing/specs/event-sharing/spec.md that the
// backend core serves, one test per scenario, named after it, against MemoryStore and SqlStore. The
// app parts (screens, deep links) are tasks 7.5 and 11.5, the browser pages 3.14 and 6.3;
// test/spec-coverage.test.ts lists the scenarios the core does not serve.
import { describe, expect, it } from 'vitest';
import { testApi } from '../support/api.ts';
import type { Api } from '../support/api.ts';
import { DAY_MS, DOC, pick, sharedEvent, stores, uuid } from '../support/events.ts';
import type { ErrorBody, Person } from '../support/events.ts';

type LinkInfo = { id: string; label: string | null; url: string; expiresAt: string | null };
type InviteInfo = { id: string; url: string; role: string; maxUses: number | null; useCount: number; expiresAt: string | null };
type Sharing = { links: LinkInfo[]; invites: InviteInfo[]; members: { accountId: string; name: string; role: string; joinedVia: string | null }[]; removed: { accountId: string; name: string }[] };
type InviteStatus = { state: string; eventTitle: string | null; ownerName: string | null; role: string | null };
type Manifest = { events: { id: string; rev: number; role: string }[] };

const tokenOf = (url: string): string => url.slice(url.lastIndexOf('/') + 1);

async function createLink(a: Api, owner: Person, body: Record<string, unknown> = {}): Promise<LinkInfo> {
  const r = await a.call<LinkInfo>('POST', `events/${uuid(1)}/links`, { token: owner.token, body });
  expect(r.status).toBe(201);
  return r.body;
}

async function createInvite(a: Api, owner: Person, body: Record<string, unknown>): Promise<string> {
  const r = await a.call<{ inviteId: string; url: string }>('POST', `events/${uuid(1)}/invites`, { token: owner.token, body });
  expect(r.status).toBe(201);
  return tokenOf(r.body.url);
}

for (const [storeName, newStore] of Object.entries(stores)) {
  describe(`event-sharing scenarios (${storeName})`, () => {
    const api = async (): Promise<Api> => testApi({ store: await newStore() });

    it('Local user taps Share', async () => {
      const a = await api();
      // A guest has no session: nothing to share yet.
      expect((await a.call<ErrorBody>('POST', `events/${uuid(1)}/links`, { body: {} })).status).toBe(401);
      // After sign-in the app uploads the event, then the share screen works.
      const owner = await a.google('owner-sub', undefined, 'Owner');
      expect((await a.call('PUT', `events/${uuid(1)}`, { token: owner.token, body: DOC })).status).toBe(201);
      const link = await createLink(a, owner);
      expect((await a.call<Sharing>('GET', `events/${uuid(1)}/sharing`, { token: owner.token })).body.links).toEqual([link]);
    });

    it('Two public links', async () => {
      const a = await api();
      const { owner } = await sharedEvent(a, {});
      const instagram = await createLink(a, owner, { label: 'Instagram' });
      const family = await createLink(a, owner, { label: 'Family chat' });
      expect([instagram.label, family.label, instagram.expiresAt]).toEqual(['Instagram', 'Family chat', null]);
      expect(instagram.url).toMatch(/^https:\/\/dtm\.example\.test\/e\/[A-Za-z0-9_-]{22}$/);
      for (const link of [instagram, family]) {
        const view = await a.call<{ event: Record<string, unknown> }>('GET', `links/${tokenOf(link.url)}`);
        expect(view.status).toBe(200);
        expect(view.body.event).toEqual({ rev: 1, ...DOC });
        expect(view.body.event).not.toHaveProperty('role');
      }
      // View only: without a session nothing can be written.
      expect((await a.call('PATCH', `events/${uuid(1)}`, { body: { baseRev: 1, patch: { title: 'x' } } })).status).toBe(401);
    });

    it('Eleventh link', async () => {
      const a = await api();
      const { owner } = await sharedEvent(a, {});
      for (let i = 0; i < 10; i++) await createLink(a, owner, { label: `Link ${i}` });
      const eleventh = await a.call<ErrorBody>('POST', `events/${uuid(1)}/links`, { token: owner.token, body: { label: 'One more' } });
      expect(eleventh.status).toBe(429);
      expect(eleventh.body.error).toEqual({ code: 'quota_exceeded', message: 'Limit reached', details: { limit: 'links_per_event' } });
      expect((await a.call<Sharing>('GET', `events/${uuid(1)}/sharing`, { token: owner.token })).body.links).toHaveLength(10);
    });

    it('Custom expiry', async () => {
      const a = await api();
      const { owner } = await sharedEvent(a, {});
      const evening = '2026-10-12T21:00:00Z';
      const link = await createLink(a, owner, { label: 'Tonight', expiresAt: evening });
      expect(link.expiresAt).toBe(evening);
      a.ports.clock.set('2026-10-12T20:59:59Z');
      expect((await a.call('GET', `links/${tokenOf(link.url)}`)).status).toBe(200);
      a.ports.clock.set(evening);
      const after = await a.call<ErrorBody>('GET', `links/${tokenOf(link.url)}`);
      expect(after.status).toBe(410);
      expect(after.body.error.code).toBe('expired');
      expect(JSON.stringify(after.body)).not.toContain(DOC.title);
    });

    it('Extend an invite', async () => {
      const a = await api();
      const { owner } = await sharedEvent(a, {});
      const fiveDays = new Date(a.ports.clock.nowMs() + 5 * DAY_MS).toISOString();
      const token = await createInvite(a, owner, { role: 'viewer', maxUses: null, expiresAt: fiveDays });
      const [invite] = (await a.call<Sharing>('GET', `events/${uuid(1)}/sharing`, { token: owner.token })).body.invites;
      const extended = await a.call<InviteInfo>('PATCH', `invites/${invite?.id}`, { token: owner.token, body: { expiresAt: null } });
      expect(extended.status).toBe(200);
      expect(extended.body.expiresAt).toBeNull();
      a.ports.clock.advance(6 * DAY_MS);
      const guest = await a.google('guest-sub', undefined, 'Guest');
      expect((await a.call<InviteStatus>('GET', `invites/${token}`, { token: guest.token })).body.state).toBe('open');
      expect((await a.call('POST', `invites/${token}/join`, { token: guest.token })).status).toBe(200);
    });

    it('Copy a link on a second device', async () => {
      const a = await api();
      const { owner } = await sharedEvent(a, {});
      const link = await createLink(a, owner, { label: 'Instagram' });
      const inviteToken = await createInvite(a, owner, { role: 'editor' });
      const tablet = await a.google('owner-sub');
      expect(tablet.token).not.toBe(owner.token);
      const sharing = await a.call<Sharing>('GET', `events/${uuid(1)}/sharing`, { token: tablet.token });
      expect(sharing.body.links).toEqual([link]);
      expect(sharing.body.invites.map((i) => i.url)).toEqual([`https://dtm.example.test/i/${inviteToken}`]);
    });

    it('Revoke one of two links', async () => {
      const a = await api();
      const { owner } = await sharedEvent(a, {});
      const instagram = await createLink(a, owner, { label: 'Instagram' });
      const family = await createLink(a, owner, { label: 'Family chat' });
      expect((await a.call('DELETE', `links/${instagram.id}`, { token: owner.token })).status).toBe(204);
      const gone = await a.call<ErrorBody>('GET', `links/${tokenOf(instagram.url)}`);
      expect(gone.status).toBe(410);
      expect(gone.body.error.code).toBe('revoked');
      expect((await a.call('GET', `links/${tokenOf(family.url)}`)).status).toBe(200);
      expect((await a.call<Sharing>('GET', `events/${uuid(1)}/sharing`, { token: owner.token })).body.links).toEqual([family]);
    });

    it('Invite for five people', async () => {
      const a = await api();
      const { owner } = await sharedEvent(a, {});
      const token = await createInvite(a, owner, { role: 'editor', maxUses: 5 });
      const people = [];
      for (let i = 1; i <= 6; i++) people.push(await a.google(`person-${i}`, undefined, `Person ${i}`));
      for (const p of people.slice(0, 5)) expect((await a.call('POST', `invites/${token}/join`, { token: p.token })).status).toBe(200);
      const sharing = await a.call<Sharing>('GET', `events/${uuid(1)}/sharing`, { token: owner.token });
      expect(sharing.body.members.map((m) => [m.name, m.role]).sort()).toEqual(people.slice(0, 5).map((_, i) => [`Person ${i + 1}`, 'editor']));
      expect(sharing.body.invites[0]).toMatchObject({ maxUses: 5, useCount: 5 });
      const sixth = people[5] as Person;
      expect((await a.call<InviteStatus>('GET', `invites/${token}`, { token: sixth.token })).body).toEqual({ state: 'full', eventTitle: null, ownerName: null, role: null });
      const refused = await a.call<ErrorBody>('POST', `invites/${token}/join`, { token: sixth.token });
      expect(refused.status).toBe(410);
      expect(refused.body.error.code).toBe('invite_full');
    });

    it('Opened but not joined', async () => {
      const a = await api();
      const { owner } = await sharedEvent(a, {});
      const token = await createInvite(a, owner, { role: 'viewer' });
      // Without a session the API shows nothing and takes nothing.
      expect((await a.call('GET', `invites/${token}`)).status).toBe(401);
      const receiver = await a.google('receiver-sub', undefined, 'Receiver');
      for (let i = 0; i < 2; i++) expect((await a.call<InviteStatus>('GET', `invites/${token}`, { token: receiver.token })).body.state).toBe('open');
      expect((await a.call<Sharing>('GET', `events/${uuid(1)}/sharing`, { token: owner.token })).body.invites[0]?.useCount).toBe(0);
      expect((await a.call('POST', `invites/${token}/join`, { token: receiver.token })).status).toBe(200);
    });

    it('App installed, not signed in', async () => {
      const a = await api();
      const { owner } = await sharedEvent(a, {});
      const token = await createInvite(a, owner, { role: 'editor' });
      expect((await a.call('GET', `invites/${token}`)).status).toBe(401);
      const receiver = await a.emailSignIn('receiver@example.com');
      const status = await a.call<InviteStatus>('GET', `invites/${token}`, { token: receiver.token });
      expect(status.body).toEqual({ state: 'open', eventTitle: DOC.title, ownerName: 'Owner', role: 'editor' });
      const joined = await a.call<{ eventId: string; url: string }>('POST', `invites/${token}/join`, { token: receiver.token });
      expect(joined.body).toEqual({ eventId: uuid(1), url: `https://dtm.example.test/s/${uuid(1)}` });
      const manifest = await a.call<Manifest>('GET', 'sync', { token: receiver.token });
      expect(manifest.body.events.map((e) => [e.id, e.role])).toEqual([[uuid(1), 'editor']]);
      expect((await a.call('PATCH', `events/${uuid(1)}`, { token: receiver.token, body: { baseRev: 1, patch: { title: 'Edited' } } })).status).toBe(200);
    });

    it('App not installed', async () => {
      // The browser page is the generic landing page (tasks 3.14 and 6.3); the API shows the invite
      // only to a signed-in app.
      const a = await api();
      const { owner } = await sharedEvent(a, {});
      const token = await createInvite(a, owner, { role: 'viewer' });
      const anonymous = await a.call<ErrorBody>('GET', `invites/${token}`);
      expect(anonymous.status).toBe(401);
      expect(JSON.stringify(anonymous.body)).not.toContain(DOC.title);
      const installed = await a.google('new-sub', undefined, 'New');
      expect((await a.call<InviteStatus>('GET', `invites/${token}`, { token: installed.token })).body).toEqual({
        state: 'open', eventTitle: DOC.title, ownerName: 'Owner', role: 'viewer',
      });
    });

    it('Owner or member opens an invite', async () => {
      const a = await api();
      const { owner, people } = await sharedEvent(a, { Viewer: 'viewer' });
      const token = await createInvite(a, owner, { role: 'editor', maxUses: 1 });
      const viewer = pick(people, 'Viewer');
      expect((await a.call<InviteStatus>('GET', `invites/${token}`, { token: owner.token })).body).toEqual({
        state: 'owner', eventTitle: DOC.title, ownerName: 'Owner', role: null,
      });
      expect((await a.call<InviteStatus>('GET', `invites/${token}`, { token: viewer.token })).body).toEqual({
        state: 'member', eventTitle: DOC.title, ownerName: 'Owner', role: 'viewer',
      });
      for (const p of [owner, viewer]) {
        const r = await a.call<{ eventId: string }>('POST', `invites/${token}/join`, { token: p.token });
        expect(r.status).toBe(200);
        expect(r.body.eventId).toBe(uuid(1));
      }
      expect((await a.call<Sharing>('GET', `events/${uuid(1)}/sharing`, { token: owner.token })).body.invites[0]?.useCount).toBe(0);
      expect((await a.ports.store.getMember(uuid(1), viewer.accountId))?.role).toBe('viewer');
    });

    it('Viewer tries to edit', async () => {
      const a = await api();
      const { owner, people } = await sharedEvent(a, { Viewer: 'viewer' });
      const r = await a.call<ErrorBody>('PATCH', `events/${uuid(1)}`, { token: pick(people, 'Viewer').token, body: { baseRev: 1, patch: { title: 'Mine now' } } });
      expect(r.status).toBe(403);
      expect(r.body.error.code).toBe('forbidden');
      const event = await a.call<{ rev: number; title: string }>('GET', `events/${uuid(1)}`, { token: owner.token });
      expect([event.body.rev, event.body.title]).toEqual([1, DOC.title]);
    });

    it('Editor tries to create a link', async () => {
      const a = await api();
      const { people } = await sharedEvent(a);
      const editor = pick(people, 'Editor');
      for (const [path, body] of [['links', {}], ['invites', { role: 'viewer' }]] as const) {
        const r = await a.call<ErrorBody>('POST', `events/${uuid(1)}/${path}`, { token: editor.token, body });
        expect(r.status).toBe(403);
        expect(r.body.error.code).toBe('forbidden');
      }
      expect((await a.call('GET', `events/${uuid(1)}/sharing`, { token: editor.token })).status).toBe(403);
    });

    it('Member link without membership', async () => {
      const a = await api();
      await sharedEvent(a, {});
      const stranger = await a.google('stranger-sub', undefined, 'Stranger');
      const r = await a.call<ErrorBody>('GET', `events/${uuid(1)}`, { token: stranger.token });
      expect(r.status).toBe(403);
      expect(r.body.error).toEqual({ code: 'forbidden', message: 'Not allowed for your role', details: null });
    });

    it('Remove an editor who has the event open', async () => {
      const a = await api();
      const { owner, people } = await sharedEvent(a);
      const editor = pick(people, 'Editor');
      expect((await a.call('DELETE', `events/${uuid(1)}/members/${editor.accountId}`, { token: owner.token })).status).toBe(204);
      // The open app gets an access notice and refetches: no access any more.
      expect(a.ports.live.published.at(-1)).toEqual({ eventId: uuid(1), message: { type: 'access' } });
      expect((await a.call('GET', `events/${uuid(1)}`, { token: editor.token })).status).toBe(403);
      const save = await a.call<ErrorBody>('PATCH', `events/${uuid(1)}`, { token: editor.token, body: { baseRev: 1, patch: { title: 'Late edit' } } });
      expect(save.status).toBe(403);
      expect((await a.call<Manifest>('GET', 'sync', { token: editor.token })).body.events).toEqual([]);
      expect((await a.call<Sharing>('GET', `events/${uuid(1)}/sharing`, { token: owner.token })).body.removed).toEqual([{ accountId: editor.accountId, name: 'Editor' }]);
    });

    it('Removed member reopens an unlimited invite', async () => {
      const a = await api();
      const { owner } = await sharedEvent(a, {});
      const token = await createInvite(a, owner, { role: 'viewer', maxUses: null });
      const member = await a.google('member-sub', undefined, 'Member');
      await a.call('POST', `invites/${token}/join`, { token: member.token });
      await a.call('DELETE', `events/${uuid(1)}/members/${member.accountId}`, { token: owner.token });
      expect((await a.call<InviteStatus>('GET', `invites/${token}`, { token: member.token })).body).toEqual({ state: 'removed', eventTitle: null, ownerName: null, role: null });
      const r = await a.call<ErrorBody>('POST', `invites/${token}/join`, { token: member.token });
      expect(r.status).toBe(403);
      expect(r.body.error.message).toBe('Ask the owner to invite you again');
      expect((await a.call<Manifest>('GET', 'sync', { token: member.token })).body.events).toEqual([]);
      // "Allow again" lifts the block.
      expect((await a.call('DELETE', `events/${uuid(1)}/removed/${member.accountId}`, { token: owner.token })).status).toBe(204);
      expect((await a.call('POST', `invites/${token}/join`, { token: member.token })).status).toBe(200);
    });

    it('Leave', async () => {
      const a = await api();
      const { owner, people } = await sharedEvent(a, { Viewer: 'viewer' });
      const viewer = pick(people, 'Viewer');
      expect((await a.call('DELETE', `events/${uuid(1)}/members/me`, { token: viewer.token })).status).toBe(204);
      expect((await a.call<Manifest>('GET', 'sync', { token: viewer.token })).body.events).toEqual([]);
      const sharing = await a.call<Sharing>('GET', `events/${uuid(1)}/sharing`, { token: owner.token });
      expect([sharing.body.members, sharing.body.removed]).toEqual([[], []]);
      expect(a.ports.live.published.at(-1)).toEqual({ eventId: uuid(1), message: { type: 'access' } });
    });

    it('Public link read through the API', async () => {
      const a = await api();
      const { owner } = await sharedEvent(a, { Viewer: 'viewer' });
      await a.call('PUT', `events/${uuid(1)}/memos/5c1f0000-0000-4000-8000-000000000001`, {
        token: owner.token, body: { content: 'Memo text', createdAt: '2026-10-12T15:04:05Z' },
      });
      await a.call('PATCH', `events/${uuid(1)}`, { token: owner.token, body: { baseRev: 1, patch: { categoryId: 'family', pinnedAt: '2026-10-01T08:00:00Z' } } });
      const link = await createLink(a, owner);
      const view = await a.call<{ event: Record<string, unknown> }>('GET', `links/${tokenOf(link.url)}`);
      expect(view.body.event).toEqual({ rev: 2, ...DOC });
      const text = JSON.stringify(view.body);
      for (const secret of ['Book the photographer', 'Memo text', 'Owner', 'Viewer', 'family', owner.accountId, '@']) expect(text).not.toContain(secret);
    });

    it('Malformed token', async () => {
      const a = await api();
      const strip = (h: Headers): [string, string][] => [...h.entries()].filter(([k]) => k !== 'x-request-id');
      const unknown = await a.app.handle(requestFor('/api/v1/links/AAAAAAAAAAAAAAAAAAAAAA'));
      const malformed = await a.app.handle(requestFor('/api/v1/links/not*a*token'));
      if (unknown.kind !== 'http' || malformed.kind !== 'http') throw new Error('expected HTTP responses');
      expect(malformed.status).toBe(unknown.status);
      expect(unknown.status).toBe(404);
      expect(strip(malformed.headers)).toEqual(strip(unknown.headers));
      expect(malformed.body).toEqual(unknown.body);
    });
  });
}

function requestFor(path: string) {
  return { method: 'GET', path, query: new URLSearchParams(), headers: new Headers(), body: null, clientIp: null };
}

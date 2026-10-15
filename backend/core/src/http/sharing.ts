// Sharing (task 3.8, `event-sharing` spec, design D10 and D11, BACKEND.md sections 7.3 to 7.5 and 9):
// public view-only links, invite links with role, use count and expiry, joining, members, role
// changes, removal with a rejoin block, leaving and "allow again". Only the owner manages sharing.
// Every change publishes an `access` notice, so open apps and pages refetch and see what they may
// still read. Resolution of tokens (public link view, invite state) is in resolve.ts.
import { authenticate } from '../auth/session.ts';
import type { Session } from '../auth/session.ts';
import { newInviteToken, openInviteToken } from '../auth/invite-token.ts';
import { LIMITS } from '../contract/index.ts';
import type { CreateInviteResponse, InviteInfo, LinkInfo, MemberInfo, MemberRole, SharingResponse } from '../contract/index.ts';
import { nowSeconds } from '../ports/clock.ts';
import type { Ports } from '../ports/index.ts';
import { token22 } from '../ports/random.ts';
import { StoreBusyError } from '../ports/store.ts';
import type { InviteRecord, LinkRecord, ReaderEvent } from '../ports/store.ts';
import type { JsonObject } from '../rules/merge.ts';
import { isoSeconds, parseInstant, validateInvitePatch, validateLinkPatch, validateNewInvite, validateNewLink } from '../rules/validation.ts';
import { isActive } from '../store/records.ts';
import type { Handler, RequestContext } from './app.ts';
import { readJsonObject } from './body.ts';
import { ApiError, invalidPayload, notFound } from './errors.ts';
import { isUuid, onlyFields, valid } from './input.ts';
import { API } from './paths.ts';
import type { Route } from './router.ts';
import { NO_STORE, eventId, forbidden, ownerOnly, readable } from './sync.ts';
import { emptyResponse, jsonResponse } from './types.ts';

/** Attempts at a fresh id and token when one is taken (128 random bits: practically never). */
const CREATE_ATTEMPTS = 3;

export const quotaExceeded = (limit: string): ApiError => new ApiError('quota_exceeded', 'Limit reached', { limit });
const linkRevoked = (): ApiError => new ApiError('revoked', 'This link is no longer available');
const linkExpired = (): ApiError => new ApiError('expired', 'This link is no longer available');
const inviteRevoked = (): ApiError => new ApiError('invite_revoked', 'This invite is no longer available');
const inviteExpired = (): ApiError => new ApiError('invite_expired', 'This invite is no longer available');

// ---- URLs and bodies ----

export const publicLinkUrl = (ports: Ports, token: string): string => `${ports.config.origin}/e/${token}`;
export const inviteUrl = (ports: Ports, token: string): string => `${ports.config.origin}/i/${token}`;
export const memberUrl = (ports: Ports, eventId: string): string => `${ports.config.origin}/s/${eventId}`;

const iso = (seconds: number | null): string | null => (seconds === null ? null : isoSeconds(seconds));

/** An expiry from validated settings: unix seconds, null = never. */
function expirySeconds(value: JsonObject[string] | undefined): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return Math.floor((parseInstant(value as string) as { ms: number }).ms / 1000);
}

function linkInfo(ports: Ports, link: LinkRecord): LinkInfo {
  return { id: link.id, label: link.label, url: publicLinkUrl(ports, link.token), expiresAt: iso(link.expiresAt) };
}

/** The invite as the owner sees it; null when its token cannot be opened (sealed under another INVITE_KEY). */
async function inviteInfo(ports: Ports, invite: InviteRecord): Promise<InviteInfo | null> {
  const token = await openInviteToken(ports.config.secrets.inviteKey, invite.id, invite.tokenEnc);
  if (token === null) return null;
  return {
    id: invite.id, url: inviteUrl(ports, token), role: invite.role, maxUses: invite.maxUses, useCount: invite.useCount, expiresAt: iso(invite.expiresAt),
  };
}

async function accessChanged(ports: Ports, eventId: string): Promise<void> {
  await ports.live.publish(eventId, { type: 'access' });
}

/** A path id that must be a lower-case UUID (link, invite and account ids), else `404`. */
function uuidParam(ctx: RequestContext, name: string): string {
  const id = ctx.params[name] ?? '';
  if (!isUuid(id)) throw notFound();
  return id;
}

/** The link `linkId` of an event the caller owns: `404` when unknown, `403` for others, `410` once the event is deleted. */
async function ownedLink(ports: Ports, session: Session, ctx: RequestContext): Promise<LinkRecord> {
  const link = await ports.store.getLink(uuidParam(ctx, 'linkId'));
  if (!link) throw notFound();
  await ownerOnly(ports, session, link.eventId);
  return link;
}

async function ownedInvite(ports: Ports, session: Session, ctx: RequestContext): Promise<InviteRecord> {
  const invite = await ports.store.getInvite(uuidParam(ctx, 'inviteId'));
  if (!invite) throw notFound();
  await ownerOnly(ports, session, invite.eventId);
  return invite;
}

// ---- Overview ----

const sharing: Handler = async (ctx) => {
  const { ports, req } = ctx;
  const session = await authenticate(ports, req);
  const id = eventId(ctx);
  await ownerOnly(ports, session, id);
  const now = nowSeconds(ports.clock);
  const [links, invites, people] = await Promise.all([
    ports.store.listLinks(id, now), ports.store.listInvites(id, now), ports.store.listMembers(id),
  ]);
  const body: SharingResponse = {
    links: links.map((l) => linkInfo(ports, l)),
    invites: (await Promise.all(invites.map((i) => inviteInfo(ports, i)))).filter((i): i is InviteInfo => i !== null),
    members: people.filter((p) => p.role !== 'removed').map((p): MemberInfo => ({
      accountId: p.accountId, name: p.name, role: p.role as MemberRole, joinedVia: p.inviteId,
    })),
    removed: people.filter((p) => p.role === 'removed').map((p) => ({ accountId: p.accountId, name: p.name })),
  };
  return jsonResponse(200, body, NO_STORE);
};

// ---- Public links ----

const createLink: Handler = async (ctx) => {
  const { ports, req } = ctx;
  const session = await authenticate(ports, req);
  const id = eventId(ctx);
  const settings = valid(validateNewLink(await readJsonObject(req), ports.clock.nowMs()));
  await ownerOnly(ports, session, id);
  const now = nowSeconds(ports.clock);
  for (let attempt = 0; attempt < CREATE_ATTEMPTS; attempt++) {
    const outcome = await ports.store.createLink({
      id: ports.random.uuid(), token: token22(ports.random), eventId: id, label: (settings['label'] ?? null) as string | null,
      expiresAt: expirySeconds(settings['expiresAt']) ?? null, now, maxActive: LIMITS.ACTIVE_LINKS_PER_EVENT,
    });
    if (outcome.status === 'limit') throw quotaExceeded('links_per_event');
    if (outcome.status === 'created') {
      await accessChanged(ports, id);
      return jsonResponse(201, linkInfo(ports, outcome.link), NO_STORE);
    }
  }
  throw new StoreBusyError();
};

const patchLink: Handler = async (ctx) => {
  const { ports, req } = ctx;
  const session = await authenticate(ports, req);
  const link = await ownedLink(ports, session, ctx);
  const changes = valid(validateLinkPatch(await readJsonObject(req), ports.clock.nowMs()));
  const now = nowSeconds(ports.clock);
  const label = changes['label'] as string | null | undefined;
  const expiresAt = expirySeconds(changes['expiresAt']);
  const updated = await ports.store.updateLink(link.id, { ...(label === undefined ? {} : { label }), ...(expiresAt === undefined ? {} : { expiresAt }) }, now);
  if (!updated) throw notFound();
  if (updated.revokedAt !== null) throw linkRevoked();
  if (!isActive(updated, now)) throw linkExpired();
  await accessChanged(ports, link.eventId);
  return jsonResponse(200, linkInfo(ports, updated), NO_STORE);
};

const revokeLink: Handler = async (ctx) => {
  const { ports, req } = ctx;
  const session = await authenticate(ports, req);
  const link = await ownedLink(ports, session, ctx);
  if (await ports.store.revokeLink(link.id, nowSeconds(ports.clock))) await accessChanged(ports, link.eventId);
  return emptyResponse(204, NO_STORE);
};

// ---- Invites ----

const createInvite: Handler = async (ctx) => {
  const { ports, req } = ctx;
  const session = await authenticate(ports, req);
  const id = eventId(ctx);
  const settings = valid(validateNewInvite(await readJsonObject(req), ports.clock.nowMs()));
  await ownerOnly(ports, session, id);
  const now = nowSeconds(ports.clock);
  for (let attempt = 0; attempt < CREATE_ATTEMPTS; attempt++) {
    const inviteId = ports.random.uuid();
    const token = await newInviteToken(ports.config.secrets.inviteKey, inviteId, ports.random);
    const outcome = await ports.store.createInvite({
      id: inviteId, tokenHash: token.tokenHash, tokenEnc: token.tokenEnc, eventId: id, role: settings['role'] as MemberRole,
      maxUses: settings['maxUses'] as number | null, expiresAt: expirySeconds(settings['expiresAt']) ?? null, now,
      maxActive: LIMITS.ACTIVE_INVITES_PER_EVENT,
    });
    if (outcome.status === 'limit') throw quotaExceeded('invites_per_event');
    if (outcome.status === 'created') {
      await accessChanged(ports, id);
      const body: CreateInviteResponse = { inviteId, url: inviteUrl(ports, token.token) };
      return jsonResponse(201, body, NO_STORE);
    }
  }
  throw new StoreBusyError();
};

const patchInvite: Handler = async (ctx) => {
  const { ports, req } = ctx;
  const session = await authenticate(ports, req);
  const invite = await ownedInvite(ports, session, ctx);
  const changes = valid(validateInvitePatch(await readJsonObject(req), ports.clock.nowMs()));
  const now = nowSeconds(ports.clock);
  const role = changes['role'] as MemberRole | undefined;
  const maxUses = changes['maxUses'] as number | null | undefined;
  const expiresAt = expirySeconds(changes['expiresAt']);
  const updated = await ports.store.updateInvite(invite.id, {
    ...(role === undefined ? {} : { role }), ...(maxUses === undefined ? {} : { maxUses }), ...(expiresAt === undefined ? {} : { expiresAt }),
  }, now);
  if (!updated) throw notFound();
  if (updated.revokedAt !== null) throw inviteRevoked();
  if (!isActive(updated, now)) throw inviteExpired();
  await accessChanged(ports, invite.eventId);
  const info = await inviteInfo(ports, updated);
  // Sealed under another INVITE_KEY: the change applied, but the URL cannot be shown (500).
  if (!info) throw new Error('invite token cannot be opened');
  return jsonResponse(200, info, NO_STORE);
};

const revokeInvite: Handler = async (ctx) => {
  const { ports, req } = ctx;
  const session = await authenticate(ports, req);
  const invite = await ownedInvite(ports, session, ctx);
  if (await ports.store.revokeInvite(invite.id, nowSeconds(ports.clock))) await accessChanged(ports, invite.eventId);
  return emptyResponse(204, NO_STORE);
};

// ---- Members ----

function roleBody(body: JsonObject): MemberRole {
  onlyFields(body, ['role']);
  const role = body['role'];
  if (role === undefined) throw invalidPayload('role', 'required');
  if (role !== 'viewer' && role !== 'editor') throw invalidPayload('role', 'must be viewer or editor');
  return role;
}

const setRole: Handler = async (ctx) => {
  const { ports, req } = ctx;
  const session = await authenticate(ports, req);
  const id = eventId(ctx);
  const role = roleBody(await readJsonObject(req));
  await ownerOnly(ports, session, id);
  const accountId = uuidParam(ctx, 'accountId');
  if (!(await ports.store.setMemberRole(id, accountId, role))) throw notFound();
  await accessChanged(ports, id);
  const person = (await ports.store.listMembers(id)).find((p) => p.accountId === accountId);
  if (!person) throw notFound();
  const body: MemberInfo = { accountId, name: person.name, role, joinedVia: person.inviteId };
  return jsonResponse(200, body, NO_STORE);
};

/** `DELETE /events/{id}/members/me` leaves; the owner removing an account blocks it from rejoining. */
const removeMember: Handler = async (ctx) => {
  const { ports, req } = ctx;
  const session = await authenticate(ports, req);
  const id = eventId(ctx);
  if (ctx.params['accountId'] === 'me') {
    const access: ReaderEvent = await readable(ports, session, id);
    if (access.role === 'owner') throw forbidden();
    if (await ports.store.deleteMember(id, session.accountId, 'active')) await accessChanged(ports, id);
    return emptyResponse(204, NO_STORE);
  }
  await ownerOnly(ports, session, id);
  const accountId = uuidParam(ctx, 'accountId');
  if (await ports.store.removeMember(id, accountId)) {
    await accessChanged(ports, id);
  } else if ((await ports.store.getMember(id, accountId))?.role !== 'removed') {
    throw notFound();
  }
  return emptyResponse(204, NO_STORE);
};

/** "Allow again": lifts the block of a removed member, who can then join through an invite. */
const allowAgain: Handler = async (ctx) => {
  const { ports, req } = ctx;
  const session = await authenticate(ports, req);
  const id = eventId(ctx);
  await ownerOnly(ports, session, id);
  const accountId = uuidParam(ctx, 'accountId');
  if (await ports.store.deleteMember(id, accountId, 'removed')) await accessChanged(ports, id);
  return emptyResponse(204, NO_STORE);
};

export const sharingRoutes: readonly Route<Handler>[] = [
  { method: 'GET', pattern: `${API}/events/:id/sharing`, handler: sharing },
  { method: 'POST', pattern: `${API}/events/:id/links`, handler: createLink },
  { method: 'PATCH', pattern: `${API}/links/:linkId`, handler: patchLink },
  { method: 'DELETE', pattern: `${API}/links/:linkId`, handler: revokeLink },
  { method: 'POST', pattern: `${API}/events/:id/invites`, handler: createInvite },
  { method: 'PATCH', pattern: `${API}/invites/:inviteId`, handler: patchInvite },
  { method: 'DELETE', pattern: `${API}/invites/:inviteId`, handler: revokeInvite },
  { method: 'PUT', pattern: `${API}/events/:id/members/:accountId`, handler: setRole },
  { method: 'DELETE', pattern: `${API}/events/:id/members/:accountId`, handler: removeMember },
  { method: 'DELETE', pattern: `${API}/events/:id/removed/:accountId`, handler: allowAgain },
];

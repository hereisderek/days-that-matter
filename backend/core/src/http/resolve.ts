// Resolution of shared tokens (tasks 3.8 and 3.9, `event-sharing` and `share-web` specs, BACKEND.md
// sections 7.3, 7.4 and 14): the public link view for anyone, and what an invite means for a signed-in
// account, opening or joining. Token formats are checked before any store access, and every unknown,
// malformed or purged token answers the same `404` (one `notFound()`), so they cannot be told apart.
import { sha256Hex } from '../auth/crypto.ts';
import { TOKEN_FORMAT } from '../auth/invite-token.ts';
import { authenticate } from '../auth/session.ts';
import { LIMITS } from '../contract/index.ts';
import type { InviteStatusResponse, JoinResponse, LinkViewResponse, LiveInfo, PublicEvent } from '../contract/index.ts';
import { nowSeconds } from '../ports/clock.ts';
import type { EventRecord } from '../ports/store.ts';
import { isJsonObject } from '../rules/merge.ts';
import type { JsonObject } from '../rules/merge.ts';
import { SHARED_FIELDS, isoSeconds } from '../rules/validation.ts';
import { inviteAccess } from '../store/records.ts';
import type { Handler, RequestContext } from './app.ts';
import { ApiError, notFound } from './errors.ts';
import { API } from './paths.ts';
import type { Route } from './router.ts';
import { quotaExceeded, memberUrl } from './sharing.ts';
import { NO_STORE, deleted, withEtag } from './sync.ts';
import { jsonResponse } from './types.ts';

/** The public link projection (`:core:model` `Projections.publicLink`): rev and shared fields, no custom audio. */
export function projectPublic(event: EventRecord): PublicEvent {
  const doc: JsonObject = Object.fromEntries(Object.entries(event.doc).filter(([k]) => SHARED_FIELDS.has(k)));
  const audio = doc['audio'];
  if (isJsonObject(audio) && audio['kind'] === 'custom') Reflect.deleteProperty(doc, 'audio');
  return { rev: event.rev, ...(doc as unknown as Omit<PublicEvent, 'rev'>) };
}

/** The token path parameter when it has the token format; anything else is the common `404`. */
function token(ctx: RequestContext): string {
  const t = ctx.params['token'] ?? '';
  if (!TOKEN_FORMAT.test(t)) throw notFound();
  return t;
}

/**
 * `GET /links/{token}`: the event as a public link shows it, for anyone. `410` (`deleted`, `revoked`,
 * `expired`, in that order) once the link or its event is gone; the ETag covers the event and the
 * live settings, not `serverTime`.
 */
const linkView: Handler = async (ctx) => {
  const { ports } = ctx;
  const t = token(ctx);
  const link = await ports.store.getLinkByToken(t);
  const event = link ? await ports.store.getEvent(link.eventId) : null;
  if (!link || !event) throw notFound();
  const now = nowSeconds(ports.clock);
  if (event.deletedAt !== null) throw deleted();
  if (link.revokedAt !== null) throw new ApiError('revoked', 'This link is no longer available');
  if (link.expiresAt !== null && link.expiresAt <= now) throw new ApiError('expired', 'This link is no longer available');
  const live: LiveInfo = {
    mode: ports.config.live,
    url: ports.config.live === 'ws' ? `${ports.config.origin.replace(/^http/, 'ws')}${API}/live?link=${t}` : null,
  };
  const view = projectPublic(event);
  const body: LinkViewResponse = { event: view, serverTime: isoSeconds(now), live };
  return withEtag(ctx, body, { event: view, live }, 'no-cache');
};

/**
 * `GET /invites/{token}`: what the invite means for the signed-in caller; uses nothing. The event
 * title, owner name and role are shown only when the caller can join (`open`) or already has the
 * event (`owner`, `member`).
 */
const inviteStatus: Handler = async (ctx) => {
  const { ports, req } = ctx;
  const t = token(ctx);
  const session = await authenticate(ports, req);
  const invite = await ports.store.getInviteByHash(await sha256Hex(t));
  const event = invite ? await ports.store.getEvent(invite.eventId) : null;
  if (!invite || !event) throw notFound();
  if (event.deletedAt !== null) throw deleted();
  const [member, people] = await Promise.all([ports.store.getMember(event.id, session.accountId), ports.store.listMembers(event.id)]);
  const active = people.filter((p) => p.role !== 'removed').length;
  const access = inviteAccess(invite, event, member, session.accountId, nowSeconds(ports.clock), active, LIMITS.MEMBERS_PER_EVENT);
  // An event at its member limit takes nobody new, as a full invite.
  const state = access === 'members_limit' ? 'full' : access === 'deleted' ? 'revoked' : access;
  const shows = state === 'open' || state === 'owner' || state === 'member';
  const ownerName = shows ? ((await ports.store.displayNames([event.ownerId])).get(event.ownerId) ?? null) : null;
  const body: InviteStatusResponse = {
    state,
    eventTitle: shows ? ((event.doc['title'] as string | undefined) ?? null) : null,
    ownerName,
    role: state === 'open' ? invite.role : state === 'member' && member && member.role !== 'removed' ? member.role : null,
  };
  return withEtag(ctx, body);
};

/** `POST /invites/{token}/join`: joins with the invite's role and takes one use; owners and members take none. */
const join: Handler = async (ctx) => {
  const { ports, req } = ctx;
  const t = token(ctx);
  const session = await authenticate(ports, req);
  const outcome = await ports.store.joinInvite({
    tokenHash: await sha256Hex(t), accountId: session.accountId, now: nowSeconds(ports.clock), maxMembers: LIMITS.MEMBERS_PER_EVENT,
  });
  switch (outcome.status) {
    case 'not_found':
      throw notFound();
    case 'deleted':
      throw deleted();
    case 'removed':
      throw new ApiError('forbidden', 'Ask the owner to invite you again');
    case 'revoked':
      throw new ApiError('invite_revoked', 'This invite is no longer available');
    case 'expired':
      throw new ApiError('invite_expired', 'This invite is no longer available');
    case 'full':
      throw new ApiError('invite_full', 'This invite is full');
    case 'members_limit':
      throw quotaExceeded('members_per_event');
    case 'joined':
      await ports.live.publish(outcome.invite.eventId, { type: 'access' });
      break;
    case 'owner':
    case 'member':
      break;
  }
  const body: JoinResponse = { eventId: outcome.invite.eventId, url: memberUrl(ports, outcome.invite.eventId) };
  return jsonResponse(200, body, NO_STORE);
};

export const resolveRoutes: readonly Route<Handler>[] = [
  { method: 'GET', pattern: `${API}/links/:token`, handler: linkView },
  { method: 'GET', pattern: `${API}/invites/:token`, handler: inviteStatus },
  { method: 'POST', pattern: `${API}/invites/:token/join`, handler: join },
];

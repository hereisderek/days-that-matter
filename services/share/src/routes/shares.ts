import { Hono } from 'hono';
import type { Context } from 'hono';
import type { AppEnv } from '../lib/headers';
import { ApiError, gone, notFound, serviceUnavailable, unauthorized } from '../lib/errors';
import { findOwnerRow, insertShare, lookupByHash, revokeShare, updateShare } from '../lib/db';
import type { OwnerRow } from '../lib/db';
import { createLimits, hitLimits, shareWriteLimit } from '../lib/ratelimit';
import { constantTimeEqual, generateManageToken, generateShareToken, isManageToken, isShareToken, sha256Hex } from '../lib/tokens';
import { iso, isoOrNull, nowSeconds } from '../lib/time';
import { parseShareBody, readJsonBody } from '../lib/validate';

export const shareRoutes = new Hono<AppEnv>();

const ORIGIN = 'https://daysthatmatter.app';
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Hash compared when the share does not exist, so the work done is the same either way.
const DUMMY_HASH = '0'.repeat(64);

type Ctx = Context<AppEnv>;

function checkMaintenance(c: Ctx): void {
  if (c.env.MAINTENANCE === '1') throw serviceUnavailable('Writes are temporarily disabled');
}

const etag = (rev: number) => `"r${rev}"`;

function matchesEtag(header: string | undefined | null, rev: number): boolean {
  if (!header) return false;
  return header
    .split(',')
    .map((t) => t.trim().replace(/^W\//, ''))
    .some((t) => t === '*' || t === etag(rev));
}

/** Token format check (no D1), hash, log prefix. Throws the shared 404 for a malformed token. */
async function tokenFromPath(c: Ctx): Promise<{ token: string; hash: string }> {
  const token = c.req.param('token') ?? '';
  if (!isShareToken(token)) throw notFound();
  const hash = await sha256Hex(token);
  c.set('tokenHashPrefix', hash.slice(0, 8));
  return { token, hash };
}

/** Order from the contract: 401 header check, lookup + constant-time compare (404), then state (410). */
async function authenticateOwner(c: Ctx, hash: string, allowGone: boolean): Promise<OwnerRow> {
  const header = c.req.header('Authorization') ?? '';
  const m = /^Bearer (\S+)$/.exec(header);
  if (!m || !isManageToken(m[1])) throw unauthorized();
  const manageHash = await sha256Hex(m[1]);
  const row = await findOwnerRow(c.env.DB, hash);
  const ok = constantTimeEqual(manageHash, row?.manage_hash ?? DUMMY_HASH);
  if (!row || !ok) throw notFound();
  if (!allowGone) {
    if (row.revoked_at !== null) throw gone('revoked');
    if (row.expires_at !== null && row.expires_at <= nowSeconds()) throw gone('expired');
  }
  return row;
}

async function enforceShareWriteLimit(c: Ctx, hash: string, now: number): Promise<void> {
  const [r] = await hitLimits(c.env.DB, [shareWriteLimit(hash)], now);
  if (!r.ok) {
    c.set('rateLimited', true);
    throw new ApiError(429, 'rate_limited', 'Too many requests', null, { 'Retry-After': String(r.retryAfter) });
  }
}

shareRoutes.post('/shares', async (c) => {
  checkMaintenance(c);
  const body = await readJsonBody(c.req.raw);
  const installId = c.req.header('X-Install-Id') ?? '';
  if (!UUID_V4.test(installId)) throw new ApiError(400, 'invalid_install_id', 'X-Install-Id must be a UUID v4');
  const parsed = parseShareBody(body);

  const now = nowSeconds();
  const limits = await createLimits(c.req.header('CF-Connecting-IP') ?? null, now, c.env.RATE_SALT);
  // IP limits first. The global daily counter is only consumed by requests that passed them, so a single
  // rate-limited client cannot burn the global cap for everyone. Two round trips, then the insert.
  const ipResults = await hitLimits(c.env.DB, limits.slice(0, 2), now);
  const ipHit = ipResults.find((r) => !r.ok);
  if (ipHit) {
    c.set('rateLimited', true);
    throw new ApiError(429, 'rate_limited', 'Too many requests', null, { 'Retry-After': String(ipHit.retryAfter) });
  }
  const [globalHit] = await hitLimits(c.env.DB, limits.slice(2), now);
  if (!globalHit.ok) {
    c.set('rateLimited', true);
    throw new ApiError(429, 'quota_exceeded', 'Daily share creation limit reached', null, {
      'Retry-After': String(globalHit.retryAfter),
    });
  }

  const shareToken = generateShareToken();
  const manageToken = generateManageToken();
  const [tokenHash, manageHash] = await Promise.all([sha256Hex(shareToken), sha256Hex(manageToken)]);
  c.set('tokenHashPrefix', tokenHash.slice(0, 8));
  const expiresAt = parsed.expiresInDays == null ? null : now + parsed.expiresInDays * 86400;
  const inserted = await insertShare(c.env.DB, {
    id: crypto.randomUUID(),
    tokenHash,
    manageHash,
    installId: installId.toLowerCase(),
    schemaVersion: parsed.schemaVersion,
    payloadJson: parsed.payloadJson,
    payloadBytes: parsed.payloadBytes,
    now,
    expiresAt,
  });
  if (!inserted) throw new ApiError(429, 'quota_exceeded', 'Too many active shares for this install');

  c.header('Location', `/api/v1/shares/${shareToken}`);
  c.header('Cache-Control', 'no-store');
  return c.json(
    {
      shareToken,
      url: `${ORIGIN}/e/${shareToken}`,
      manageToken,
      schemaVersion: parsed.schemaVersion,
      createdAt: iso(now),
      expiresAt: isoOrNull(expiresAt),
    },
    201,
  );
});

shareRoutes.get('/shares/:token', async (c) => {
  const { token, hash } = await tokenFromPath(c);
  const now = nowSeconds();
  const found = await lookupByHash(c.env.DB, token, hash, now);
  if (found.status === 'not_found') throw notFound();
  if (found.status !== 'ok') throw gone(found.status);
  const s = found.share;
  const tag = etag(s.rev);
  const cache = 'public, max-age=30, stale-while-revalidate=60';
  if (matchesEtag(c.req.header('If-None-Match'), s.rev)) {
    return new Response(null, { status: 304, headers: { ETag: tag, 'Cache-Control': cache } });
  }
  c.header('ETag', tag);
  c.header('Cache-Control', cache);
  return c.json({
    shareToken: s.shareToken,
    schemaVersion: s.schemaVersion,
    payload: s.payload,
    accessMode: 'view',
    createdAt: iso(s.createdAt),
    updatedAt: iso(s.updatedAt),
    expiresAt: isoOrNull(s.expiresAt),
    serverTime: iso(now),
  });
});

shareRoutes.put('/shares/:token', async (c) => {
  checkMaintenance(c);
  const { hash } = await tokenFromPath(c);
  const row = await authenticateOwner(c, hash, false);

  const ifMatch = c.req.header('If-Match');
  if (ifMatch !== undefined && !matchesEtag(ifMatch, row.rev)) {
    throw new ApiError(412, 'precondition_failed', 'If-Match does not match the current version');
  }
  const now = nowSeconds();
  await enforceShareWriteLimit(c, hash, now);

  const parsed = parseShareBody(await readJsonBody(c.req.raw));
  const expiresAt = parsed.expiresInDays === undefined ? undefined : parsed.expiresInDays === null ? null : now + parsed.expiresInDays * 86400;
  const updated = await updateShare(c.env.DB, {
    id: row.id,
    schemaVersion: parsed.schemaVersion,
    payloadJson: parsed.payloadJson,
    payloadBytes: parsed.payloadBytes,
    now,
    expiresAt,
    expectedRev: ifMatch !== undefined && ifMatch.trim() !== '*' ? row.rev : null,
  });
  if (!updated) {
    // Changed or revoked between the lookup and the update.
    if (ifMatch !== undefined) throw new ApiError(412, 'precondition_failed', 'If-Match does not match the current version');
    throw gone('revoked');
  }
  c.header('Cache-Control', 'no-store');
  return c.json({ rev: updated.rev, updatedAt: iso(updated.updated_at), expiresAt: isoOrNull(updated.expires_at) });
});

shareRoutes.delete('/shares/:token', async (c) => {
  checkMaintenance(c);
  const { hash } = await tokenFromPath(c);
  const row = await authenticateOwner(c, hash, true);
  const now = nowSeconds();
  await enforceShareWriteLimit(c, hash, now);
  if (row.revoked_at === null) await revokeShare(c.env.DB, row.id, now);
  c.header('Cache-Control', 'no-store');
  return c.body(null, 204);
});

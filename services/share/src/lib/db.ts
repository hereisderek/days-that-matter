import { isShareToken, sha256Hex } from './tokens';
import type { SharePayload } from './validate';

export interface ShareView {
  shareToken: string;
  schemaVersion: number;
  payload: SharePayload;
  createdAt: number;
  updatedAt: number;
  expiresAt: number | null;
  rev: number;
}

export type ShareLookup =
  | { status: 'ok'; share: ShareView }
  | { status: 'revoked' | 'expired' | 'not_found' };

interface ShareRow {
  schema_version: number;
  payload: string;
  created_at: number;
  updated_at: number;
  expires_at: number | null;
  revoked_at: number | null;
  rev: number;
}

/** Page and API read path. A malformed token returns `not_found` without touching D1. */
export async function getShareByToken(db: D1Database, token: string, nowSeconds: number): Promise<ShareLookup> {
  if (!isShareToken(token)) return { status: 'not_found' };
  return lookupByHash(db, token, await sha256Hex(token), nowSeconds);
}

export async function lookupByHash(
  db: D1Database,
  token: string,
  tokenHash: string,
  nowSeconds: number,
): Promise<ShareLookup> {
  const row = await db
    .prepare(
      'SELECT schema_version, payload, created_at, updated_at, expires_at, revoked_at, rev FROM shares WHERE token_hash = ?1',
    )
    .bind(tokenHash)
    .first<ShareRow>();
  if (!row) return { status: 'not_found' };
  if (row.revoked_at !== null) return { status: 'revoked' };
  if (row.expires_at !== null && row.expires_at <= nowSeconds) return { status: 'expired' };
  return {
    status: 'ok',
    share: {
      shareToken: token,
      schemaVersion: row.schema_version,
      payload: JSON.parse(row.payload) as SharePayload,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at,
      rev: row.rev,
    },
  };
}

export interface OwnerRow {
  id: string;
  manage_hash: string;
  expires_at: number | null;
  revoked_at: number | null;
  rev: number;
}

export function findOwnerRow(db: D1Database, tokenHash: string): Promise<OwnerRow | null> {
  return db
    .prepare('SELECT id, manage_hash, expires_at, revoked_at, rev FROM shares WHERE token_hash = ?1')
    .bind(tokenHash)
    .first<OwnerRow>();
}

export const MAX_ACTIVE_PER_INSTALL = 50;

export interface NewShare {
  id: string;
  tokenHash: string;
  manageHash: string;
  installId: string;
  schemaVersion: number;
  payloadJson: string;
  payloadBytes: number;
  now: number;
  expiresAt: number | null;
}

/** Inserts only while the install is under its active-share quota. Returns false when the quota is hit. */
export async function insertShare(db: D1Database, s: NewShare): Promise<boolean> {
  const res = await db
    .prepare(
      `INSERT INTO shares (id, token_hash, manage_hash, install_id, schema_version, payload, payload_bytes,
                           access_mode, created_at, updated_at, expires_at, revoked_at, rev)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, 'view', ?8, ?8, ?9, NULL, 1
       WHERE (SELECT COUNT(*) FROM shares
              WHERE install_id = ?4 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?8)) < ?10`,
    )
    .bind(
      s.id,
      s.tokenHash,
      s.manageHash,
      s.installId,
      s.schemaVersion,
      s.payloadJson,
      s.payloadBytes,
      s.now,
      s.expiresAt,
      MAX_ACTIVE_PER_INSTALL,
    )
    .run();
  return res.meta.changes > 0;
}

export interface ShareUpdate {
  id: string;
  schemaVersion: number;
  payloadJson: string;
  payloadBytes: number;
  now: number;
  /** undefined keeps the current expiry. */
  expiresAt: number | null | undefined;
  /** When set, the update only applies if rev still equals this. */
  expectedRev: number | null;
}

export function updateShare(
  db: D1Database,
  u: ShareUpdate,
): Promise<{ rev: number; updated_at: number; expires_at: number | null } | null> {
  return db
    .prepare(
      `UPDATE shares
          SET schema_version = ?2, payload = ?3, payload_bytes = ?4, updated_at = ?5,
              expires_at = CASE WHEN ?6 = 1 THEN ?7 ELSE expires_at END, rev = rev + 1
        WHERE id = ?1 AND revoked_at IS NULL AND (?8 IS NULL OR rev = ?8)
    RETURNING rev, updated_at, expires_at`,
    )
    .bind(
      u.id,
      u.schemaVersion,
      u.payloadJson,
      u.payloadBytes,
      u.now,
      u.expiresAt === undefined ? 0 : 1,
      u.expiresAt ?? null,
      u.expectedRev,
    )
    .first();
}

export function revokeShare(db: D1Database, id: string, now: number): Promise<D1Result> {
  return db
    .prepare(
      `UPDATE shares SET revoked_at = ?2, payload = '{}', payload_bytes = 0, updated_at = ?2, rev = rev + 1
        WHERE id = ?1 AND revoked_at IS NULL`,
    )
    .bind(id, now)
    .run();
}

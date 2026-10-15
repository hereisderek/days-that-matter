-- Sharing (task 3.8, docs/architecture/BACKEND.md sections 6.1 and 14): invite links. Public links and
-- members are in 0001_init.sql. Invite tokens are stored as SHA-256 hex for lookup and as AES-GCM
-- ciphertext under INVITE_KEY, so the owner can copy the URL on any device (design D10).

CREATE TABLE invites (
  id         TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  token_enc  TEXT NOT NULL,
  event_id   TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('viewer','editor')),
  max_uses   INTEGER,
  use_count  INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  revoked_at INTEGER
);
CREATE INDEX idx_invites_event ON invites(event_id);

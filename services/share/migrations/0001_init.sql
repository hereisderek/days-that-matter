CREATE TABLE shares (
  id             TEXT PRIMARY KEY,
  token_hash     TEXT NOT NULL UNIQUE,
  manage_hash    TEXT NOT NULL,
  install_id     TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  payload        TEXT NOT NULL,
  payload_bytes  INTEGER NOT NULL,
  access_mode    TEXT NOT NULL DEFAULT 'view' CHECK (access_mode IN ('view')),
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL,
  expires_at     INTEGER,
  revoked_at     INTEGER,
  rev            INTEGER NOT NULL DEFAULT 1,
  CHECK (payload_bytes <= 8192)
);
CREATE INDEX idx_shares_install ON shares(install_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_shares_expires ON shares(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_shares_revoked ON shares(revoked_at) WHERE revoked_at IS NOT NULL;

CREATE TABLE rate_counters (
  key          TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL,
  PRIMARY KEY (key, window_start)
) WITHOUT ROWID;

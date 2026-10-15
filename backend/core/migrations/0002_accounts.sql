-- Accounts (task 3.5, docs/architecture/BACKEND.md sections 6.1 and 8): sign-in identities, email
-- sign-in codes and app sessions. Codes and session tokens are stored hashed (design D10).

CREATE TABLE identities (
  provider       TEXT NOT NULL,
  subject        TEXT NOT NULL,
  account_id     TEXT NOT NULL,
  email          TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  created_at     INTEGER NOT NULL,
  PRIMARY KEY (provider, subject)
) WITHOUT ROWID;
CREATE INDEX idx_identities_account ON identities(account_id);
CREATE INDEX idx_identities_email ON identities(email) WHERE email_verified = 1;

CREATE TABLE email_codes (
  email_hash TEXT PRIMARY KEY,
  code_mac   TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0
) WITHOUT ROWID;

CREATE TABLE sessions (
  token_hash   TEXT PRIMARY KEY,
  account_id   TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL
) WITHOUT ROWID;
CREATE INDEX idx_sessions_account ON sessions(account_id);

-- Events uploaded by a first sign-in above the owned-event limit (BACKEND.md section 8): when, for
-- audits and the storage report. NULL for normal creates.
ALTER TABLE events ADD COLUMN first_upload_at INTEGER;

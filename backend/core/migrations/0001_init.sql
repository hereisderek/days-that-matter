-- Initial schema (docs/architecture/BACKEND.md section 6.1), SQLite dialect, shared by D1, self-host and Turso.
-- Times are unix seconds UTC. No foreign key constraints; the core keeps references consistent.
--
-- Tables of later tasks come with those tasks, as their own migrations:
--   identities, email_codes, sessions (accounts, task 3.5); invites (sharing, task 3.8);
--   purchases (task 3.11); rate_counters (task 3.13).

CREATE TABLE accounts (
  id              TEXT PRIMARY KEY,
  display_name    TEXT NOT NULL,
  plan            TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','premium','premium_plus')),
  plan_expires_at INTEGER,
  audio_blocked   INTEGER NOT NULL DEFAULT 0,
  media_bytes     INTEGER NOT NULL DEFAULT 0,
  media_files     INTEGER NOT NULL DEFAULT 0,
  last_active_at  INTEGER NOT NULL,
  inactive_notice_1_at INTEGER,
  inactive_notice_2_at INTEGER,
  created_at      INTEGER NOT NULL
);
CREATE INDEX idx_accounts_media_bytes ON accounts(media_bytes);
CREATE INDEX idx_accounts_media_files ON accounts(media_files);
CREATE INDEX idx_accounts_last_active ON accounts(last_active_at);

CREATE TABLE events (
  id               TEXT PRIMARY KEY,
  owner_id         TEXT NOT NULL,
  rev              INTEGER NOT NULL,
  doc              TEXT NOT NULL,
  audio_kind       TEXT,
  audio_set_by     TEXT,
  audio_media_id   TEXT,
  child_seq        INTEGER NOT NULL DEFAULT 0,
  child_purged_seq INTEGER NOT NULL DEFAULT 0,
  updated_at       INTEGER NOT NULL,
  deleted_at       INTEGER
);
CREATE INDEX idx_events_owner ON events(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_spotify ON events(audio_set_by) WHERE audio_kind = 'spotify' AND deleted_at IS NULL;
CREATE INDEX idx_events_audio_media ON events(audio_media_id) WHERE audio_media_id IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE revisions (
  event_id      TEXT NOT NULL,
  rev           INTEGER NOT NULL,
  author_id     TEXT,
  created_at    INTEGER NOT NULL,
  patch         TEXT NOT NULL,
  inverse       TEXT NOT NULL,
  overwrote     TEXT,
  restored_from INTEGER,
  PRIMARY KEY (event_id, rev)
) WITHOUT ROWID;

CREATE TABLE memos (
  id         TEXT PRIMARY KEY,
  event_id   TEXT NOT NULL,
  author_id  TEXT NOT NULL,
  seq        INTEGER NOT NULL,
  doc        TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX idx_memos_event_seq ON memos(event_id, seq);

CREATE TABLE links (
  id         TEXT PRIMARY KEY,
  token      TEXT NOT NULL UNIQUE,
  event_id   TEXT NOT NULL,
  label      TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  revoked_at INTEGER
);
CREATE INDEX idx_links_event ON links(event_id);

CREATE TABLE members (
  event_id    TEXT NOT NULL,
  account_id  TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('viewer','editor','removed')),
  invite_id   TEXT,
  archived_at INTEGER,
  reminders   TEXT,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (event_id, account_id)
) WITHOUT ROWID;
CREATE INDEX idx_members_account ON members(account_id) WHERE role <> 'removed';

CREATE TABLE media (
  id                 TEXT PRIMARY KEY,
  uploader_id        TEXT NOT NULL,
  event_id           TEXT,
  kind               TEXT NOT NULL CHECK (kind IN ('still','motion','audio')),
  content_type       TEXT NOT NULL,
  bytes              INTEGER NOT NULL,
  width              INTEGER,
  height             INTEGER,
  duration_ms        INTEGER,
  title              TEXT,
  library_removed_at INTEGER,
  created_at         INTEGER NOT NULL,
  unused_since       INTEGER
);
CREATE INDEX idx_media_uploader ON media(uploader_id, kind) WHERE unused_since IS NULL;
CREATE INDEX idx_media_unused ON media(unused_since) WHERE unused_since IS NOT NULL;

CREATE TABLE grants (
  id         TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  plan       TEXT NOT NULL CHECK (plan IN ('premium','premium_plus')),
  starts_at  INTEGER NOT NULL,
  ends_at    INTEGER NOT NULL,
  reason     TEXT NOT NULL
);
CREATE INDEX idx_grants_account ON grants(account_id);

CREATE TABLE exports (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  reason     TEXT NOT NULL CHECK (reason IN ('request','inactive')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
) WITHOUT ROWID;
CREATE INDEX idx_exports_account ON exports(account_id);

CREATE TABLE devices (
  install_id   TEXT PRIMARY KEY,
  account_id   TEXT NOT NULL,
  platform     TEXT NOT NULL CHECK (platform IN ('ios','android')),
  push_token   TEXT NOT NULL,
  locale       TEXT NOT NULL,
  time_zone    TEXT NOT NULL,
  kinds        TEXT NOT NULL,
  last_seen_at INTEGER NOT NULL
) WITHOUT ROWID;
CREATE INDEX idx_devices_account ON devices(account_id);

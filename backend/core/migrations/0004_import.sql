-- Events written by an import (task 12.1, design D20): when, for audits and records.
-- Replaces first_upload_at.
ALTER TABLE events DROP COLUMN first_upload_at;
ALTER TABLE events ADD COLUMN imported_at INTEGER;

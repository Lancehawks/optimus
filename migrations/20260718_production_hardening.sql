-- Production security and query hardening for existing Optimus databases.
-- Fresh databases receive the equivalent definitions from database.sql.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS token_hash VARCHAR(64);
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'sessions' AND column_name = 'token'
    ) THEN
        EXECUTE 'UPDATE sessions SET token_hash = encode(digest(token, ''sha256''), ''hex'') WHERE token_hash IS NULL AND token IS NOT NULL';
    END IF;
END $$;
ALTER TABLE sessions ALTER COLUMN token_hash SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
ALTER TABLE sessions DROP COLUMN IF EXISTS token;

ALTER TABLE password_resets ADD COLUMN IF NOT EXISTS token_hash VARCHAR(64);
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'password_resets' AND column_name = 'token'
    ) THEN
        EXECUTE 'UPDATE password_resets SET token_hash = encode(digest(token, ''sha256''), ''hex'') WHERE token_hash IS NULL AND token IS NOT NULL';
    END IF;
END $$;
ALTER TABLE password_resets ALTER COLUMN token_hash SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_password_resets_token_hash ON password_resets(token_hash);
ALTER TABLE password_resets DROP COLUMN IF EXISTS token;

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
    bucket_key VARCHAR(180) PRIMARY KEY,
    request_count INTEGER NOT NULL DEFAULT 1 CHECK (request_count > 0),
    reset_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_reset ON rate_limit_buckets(reset_at);

-- Keep only one default calendar before enforcing the invariant.
WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at, id) AS rank
    FROM calendars
    WHERE is_default = TRUE
)
UPDATE calendars
SET is_default = FALSE
WHERE id IN (SELECT id FROM ranked WHERE rank > 1);

CREATE UNIQUE INDEX IF NOT EXISTS idx_calendars_one_default_per_user
    ON calendars(user_id) WHERE is_default = TRUE;
CREATE INDEX IF NOT EXISTS idx_events_user_start ON events(user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_tasks_user_status_due ON tasks(user_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_projects_user_status
    ON projects(user_id, status) WHERE is_archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_created ON bookmarks(user_id, created_at DESC);

ALTER TABLE events ADD COLUMN IF NOT EXISTS source_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_user_source_key
    ON events(user_id, source_key) WHERE source_key IS NOT NULL;

COMMIT;

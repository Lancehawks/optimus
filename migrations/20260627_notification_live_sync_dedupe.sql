-- Make live reminder notification sync idempotent.
--
-- The app still checks for existing live_key values before insert, but this
-- unique index closes the race where two sync requests run at the same time.

BEGIN;

WITH ranked_live_notifications AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY user_id, type, metadata->>'live_key'
            ORDER BY created_at ASC, id ASC
        ) AS duplicate_rank
    FROM notifications
    WHERE type = 'time_alert'
      AND metadata ? 'live_key'
)
DELETE FROM notifications n
USING ranked_live_notifications ranked
WHERE n.id = ranked.id
  AND ranked.duplicate_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_live_key_unique
    ON notifications(user_id, type, ((metadata->>'live_key')))
    WHERE type = 'time_alert'
      AND metadata ? 'live_key';

COMMIT;

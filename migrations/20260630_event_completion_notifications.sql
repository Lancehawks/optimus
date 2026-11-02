-- Dedupe event completion check notifications.
--
-- The app inserts one "did you complete this event?" notification per
-- non-recurring event or recurring occurrence. This index protects against
-- duplicate rows when sync requests overlap.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_event_completion_unique
    ON notifications(user_id, type, ((metadata->>'completion_key')))
    WHERE type = 'event_completion_check'
      AND metadata ? 'completion_key';

COMMIT;

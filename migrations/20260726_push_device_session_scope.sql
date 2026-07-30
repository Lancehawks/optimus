-- Bind every push registration to the exact authenticated session that
-- registered it. Revoking that session cascades to the device registration.
--
-- Existing user-only registrations cannot be safely attributed to a session,
-- so this migration removes them and requires the app to register again.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sessions_id_user_unique'
      AND conrelid = 'sessions'::regclass
  ) THEN
    ALTER TABLE sessions
      ADD CONSTRAINT sessions_id_user_unique UNIQUE (id, user_id);
  END IF;
END
$$;

ALTER TABLE push_devices
  ADD COLUMN IF NOT EXISTS session_id UUID;

-- Fail closed: a legacy registration has no provable session owner.
DELETE FROM push_devices
WHERE session_id IS NULL;

UPDATE push_notification_deliveries
SET status = 'cancelled',
    locked_at = NULL,
    locked_by = NULL,
    last_error = 'Device session migration required re-registration',
    updated_at = NOW()
WHERE push_device_id IS NULL
  AND status IN ('pending', 'processing', 'retry');

ALTER TABLE push_devices
  ALTER COLUMN session_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'push_devices_session_owner_fk'
      AND conrelid = 'push_devices'::regclass
  ) THEN
    ALTER TABLE push_devices
      ADD CONSTRAINT push_devices_session_owner_fk
      FOREIGN KEY (session_id, user_id)
      REFERENCES sessions(id, user_id)
      ON DELETE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_push_devices_session
  ON push_devices(session_id);

COMMIT;

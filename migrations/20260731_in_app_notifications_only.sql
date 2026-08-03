-- Retire scheduled reminders and remote push delivery.
-- In-app project activity and invitation notifications remain supported.

BEGIN;

DELETE FROM integration_jobs
WHERE type = 'notification_sync';

DELETE FROM job_checkpoints
WHERE job_name = 'notification_seed';

DELETE FROM notifications
WHERE type IN ('time_alert', 'event_completion_check');

UPDATE users
SET preferences = jsonb_set(
  COALESCE(preferences, '{}'::jsonb),
  '{notificationPreferences}',
  COALESCE(preferences->'notificationPreferences', '{}'::jsonb)
    - 'taskReminders'
    - 'eventReminders'
    - 'reminderLeadMinutes',
  true
)
WHERE COALESCE(preferences, '{}'::jsonb) ? 'notificationPreferences';

DROP TABLE IF EXISTS push_notification_deliveries;
DROP TABLE IF EXISTS push_devices;

COMMIT;

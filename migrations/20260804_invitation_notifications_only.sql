-- Limit the notification center to project invitations and acceptances.
-- Project activity remains available through the project activity history.

BEGIN;

DELETE FROM notifications
WHERE type NOT IN ('project_invitation', 'project_invitation_accepted');

UPDATE users
SET preferences = jsonb_set(
  COALESCE(preferences, '{}'::jsonb),
  '{notificationPreferences}',
  COALESCE(preferences->'notificationPreferences', '{}'::jsonb)
    - 'projectActivity',
  true
)
WHERE COALESCE(preferences, '{}'::jsonb) ? 'notificationPreferences';

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_project_invitation_accepted_unique
    ON notifications(user_id, type, entity_type, entity_id)
    WHERE type = 'project_invitation_accepted'
      AND entity_type = 'project_invitation'
      AND entity_id IS NOT NULL;

COMMIT;

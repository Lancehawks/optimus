-- Store project invitations as normal notification rows so accepted/declined
-- invitations remain visible in notification history.

BEGIN;

WITH ranked_invitation_notifications AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY user_id, type, entity_type, entity_id
            ORDER BY created_at ASC, id ASC
        ) AS duplicate_rank
    FROM notifications
    WHERE type = 'project_invitation'
      AND entity_type = 'project_invitation'
      AND entity_id IS NOT NULL
)
DELETE FROM notifications n
USING ranked_invitation_notifications ranked
WHERE n.id = ranked.id
  AND ranked.duplicate_rank > 1;

INSERT INTO notifications
    (user_id, actor_user_id, project_id, activity_id, type, entity_type, entity_id, title, body, metadata, read_at, created_at)
SELECT
    pi.invitee_user_id,
    pi.inviter_user_id,
    pi.project_id,
    NULL,
    'project_invitation',
    'project_invitation',
    pi.id,
    'invited you to collaborate',
    'Project invitation',
    jsonb_build_object('invitation_id', pi.id, 'status', pi.status),
    CASE WHEN pi.status = 'pending' THEN NULL ELSE COALESCE(pi.responded_at, NOW()) END,
    pi.created_at
FROM project_invitations pi
WHERE NOT EXISTS (
    SELECT 1
    FROM notifications n
    WHERE n.user_id = pi.invitee_user_id
      AND n.type = 'project_invitation'
      AND n.entity_type = 'project_invitation'
      AND n.entity_id = pi.id
);

UPDATE notifications n
SET metadata = COALESCE(n.metadata, '{}'::jsonb)
    || jsonb_build_object(
        'invitation_id', pi.id,
        'status', pi.status,
        'responded_at', pi.responded_at
    ),
    read_at = CASE
        WHEN pi.status = 'pending' THEN NULL
        ELSE COALESCE(n.read_at, pi.responded_at, NOW())
    END
FROM project_invitations pi
WHERE n.user_id = pi.invitee_user_id
  AND n.type = 'project_invitation'
  AND n.entity_type = 'project_invitation'
  AND n.entity_id = pi.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_project_invitation_unique
    ON notifications(user_id, type, entity_type, entity_id)
    WHERE type = 'project_invitation'
      AND entity_type = 'project_invitation'
      AND entity_id IS NOT NULL;

COMMIT;

-- Preserve shared-project audit history when an actor deletes their account.
-- The account row can then be hard-deleted while project activity remains
-- available to the remaining project members with an anonymous actor.

BEGIN;

ALTER TABLE project_activity
  ALTER COLUMN actor_user_id DROP NOT NULL;

ALTER TABLE project_activity
  DROP CONSTRAINT IF EXISTS project_activity_actor_user_id_fkey;

ALTER TABLE project_activity
  ADD CONSTRAINT project_activity_actor_user_id_fkey
  FOREIGN KEY (actor_user_id)
  REFERENCES users(id)
  ON DELETE SET NULL;

COMMIT;

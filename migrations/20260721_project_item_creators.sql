-- Record milestone authors so project members can edit only the milestones
-- they created, while the project creator retains full control.

BEGIN;

ALTER TABLE milestones
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

UPDATE milestones milestone
SET created_by = project.user_id
FROM projects project
WHERE project.id = milestone.project_id
  AND milestone.created_by IS NULL;

CREATE INDEX IF NOT EXISTS idx_milestones_project_creator
ON milestones(project_id, created_by);

COMMIT;

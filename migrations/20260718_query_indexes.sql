-- Keyset pagination and dashboard aggregate access paths.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_resources_user_created
    ON resources(user_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_whiteboards_user_pinned_updated
    ON whiteboards(user_id, is_pinned DESC, updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_notes_user_pinned_updated
    ON notes(user_id, is_pinned DESC, updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_project_status_due
    ON tasks(project_id, status, due_date)
    WHERE parent_task_id IS NULL AND is_archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_project_members_user_project
    ON project_members(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_task_dependency
    ON task_dependencies(task_id, depends_on_task_id);

COMMIT;

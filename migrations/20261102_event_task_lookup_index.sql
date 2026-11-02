-- The tasks page looks up each task's calendar blocks by task. The primary key
-- (event_id, task_id) only serves lookups by event.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_event_tasks_task_id
    ON event_tasks(task_id);

COMMIT;

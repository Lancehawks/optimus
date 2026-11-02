-- An optional estimate of how long a task will take, in whole minutes. The
-- forms ask for hours and minutes; NULL means no estimate was given.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER;

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_estimated_minutes_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_estimated_minutes_check
  CHECK (estimated_minutes BETWEEN 1 AND 60000);

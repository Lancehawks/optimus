-- Personal sprints. A sprint belongs to one member and can hold any task they
-- can edit, across personal work and every project. Membership lives here and
-- never on the task row, so a shared task doesn't reveal anyone's plans to the
-- rest of its project, and a closed sprint keeps its record of carried-over work.

BEGIN;

CREATE TABLE IF NOT EXISTS sprints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    goal TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed')),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (end_date >= start_date),
    UNIQUE (id, user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sprints_one_active
    ON sprints(user_id) WHERE status = 'active';

DROP TRIGGER IF EXISTS trg_sprints_updated_at ON sprints;
CREATE TRIGGER trg_sprints_updated_at BEFORE UPDATE ON sprints
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- outcome stays NULL until the sprint closes. The composite key keeps a row's
-- user_id equal to its sprint's owner, which the one-open-sprint index relies on.
CREATE TABLE IF NOT EXISTS sprint_tasks (
    sprint_id UUID NOT NULL,
    user_id UUID NOT NULL,
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    outcome VARCHAR(20) CHECK (outcome IN ('completed', 'unfinished')),
    added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (sprint_id, task_id),
    FOREIGN KEY (sprint_id, user_id) REFERENCES sprints(id, user_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sprint_tasks_one_open
    ON sprint_tasks(user_id, task_id) WHERE outcome IS NULL;
CREATE INDEX IF NOT EXISTS idx_sprint_tasks_task ON sprint_tasks(task_id);

-- updated_at was the only record of when a task finished, and any later edit
-- moved it. The backfill keeps those best guesses without touching updated_at.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE tasks DISABLE TRIGGER trg_tasks_updated_at;
UPDATE tasks SET completed_at = updated_at WHERE status = 'done' AND completed_at IS NULL;
ALTER TABLE tasks ENABLE TRIGGER trg_tasks_updated_at;

CREATE OR REPLACE FUNCTION set_task_completed_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM 'done' THEN
        NEW.completed_at = NULL;
    ELSIF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'done' THEN
        NEW.completed_at = NOW();
    ELSE
        NEW.completed_at = OLD.completed_at;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tasks_completed_at ON tasks;
CREATE TRIGGER trg_tasks_completed_at BEFORE INSERT OR UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION set_task_completed_at();

COMMIT;

-- Project collaboration MVP.
--
-- Safe to run before the app uses collaboration:
-- - Existing personal tasks, notes, and events remain private.
-- - Existing project owners are backfilled as project members.
-- - Events get an optional project_id for future shared project events.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

BEGIN;

CREATE TABLE IF NOT EXISTS project_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

COMMENT ON TABLE project_members IS
    'Users who can access shared data attached to a project.';

INSERT INTO project_members (project_id, user_id)
SELECT id, user_id
FROM projects
ON CONFLICT (project_id, user_id) DO NOTHING;

ALTER TABLE events
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

COMMENT ON COLUMN events.project_id IS
    'When set, the event is shared with members of this project. NULL events remain personal.';

CREATE OR REPLACE FUNCTION add_project_owner_member()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO project_members (project_id, user_id)
    VALUES (NEW.id, NEW.user_id)
    ON CONFLICT (project_id, user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_projects_add_owner_member ON projects;

CREATE TRIGGER trg_projects_add_owner_member
AFTER INSERT ON projects
FOR EACH ROW
EXECUTE FUNCTION add_project_owner_member();

CREATE INDEX IF NOT EXISTS idx_project_members_project_id
    ON project_members(project_id);

CREATE INDEX IF NOT EXISTS idx_project_members_user_id
    ON project_members(user_id);

CREATE INDEX IF NOT EXISTS idx_events_project_id
    ON events(project_id);

COMMIT;

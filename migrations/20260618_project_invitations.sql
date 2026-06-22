-- In-app project collaboration invitations.
--
-- Invitations are pending until the invited user accepts them.
-- Accepting an invitation inserts the user into project_members.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

BEGIN;

CREATE TABLE IF NOT EXISTS project_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    inviter_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invitee_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    responded_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(project_id, invitee_user_id)
);

COMMENT ON TABLE project_invitations IS
    'In-app invitations for existing Optimus users to join shared projects.';

CREATE INDEX IF NOT EXISTS idx_project_invitations_invitee_status
    ON project_invitations(invitee_user_id, status);

CREATE INDEX IF NOT EXISTS idx_project_invitations_project_status
    ON project_invitations(project_id, status);

COMMIT;

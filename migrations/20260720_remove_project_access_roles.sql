-- Remove the abandoned owner/editor/viewer project-role experiment while
-- preserving the original creator/member collaboration model.

BEGIN;

DO $$
DECLARE
    target_schema TEXT := current_schema();
BEGIN
    EXECUTE format(
        'DROP TRIGGER IF EXISTS trg_project_members_enforce_role ON %I.project_members',
        target_schema
    );
    EXECUTE format(
        'DROP INDEX IF EXISTS %I.idx_project_members_project_role',
        target_schema
    );

    IF EXISTS (
        SELECT 1
        FROM pg_proc procedure
        JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
        WHERE namespace.nspname = target_schema
          AND procedure.proname = 'enforce_project_member_role'
          AND procedure.pronargs = 0
    ) THEN
        EXECUTE format(
            'DROP FUNCTION %I.enforce_project_member_role()',
            target_schema
        );
    END IF;
END;
$$;

-- Restore the original trigger function before removing the role column so
-- newly created projects continue to add their creator as a project member.
CREATE OR REPLACE FUNCTION add_project_owner_member()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO project_members (project_id, user_id)
    VALUES (NEW.id, NEW.user_id)
    ON CONFLICT (project_id, user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE project_members
DROP COLUMN IF EXISTS role;

ALTER TABLE project_invitations
DROP COLUMN IF EXISTS role;

COMMIT;

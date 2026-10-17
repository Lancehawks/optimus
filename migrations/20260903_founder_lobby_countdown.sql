-- Shared Founder Lobby countdown. This singleton remains deliberately
-- separate from projects, tasks, and the rest of the Optimus workspace.

BEGIN;

CREATE TABLE IF NOT EXISTS founder_lobby_settings (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    countdown_title VARCHAR(120) NOT NULL DEFAULT 'Main milestone',
    countdown_target_at TIMESTAMP WITH TIME ZONE,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO founder_lobby_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

COMMIT;

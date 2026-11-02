-- Optimus is invite-only. Each invitation is a single-use, expiring credential
-- addressed to one email; only its SHA-256 hash is stored.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS workspace_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    accepted_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT workspace_invitations_email_lowercase CHECK (email = LOWER(email))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_invitations_token_hash
    ON workspace_invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_email
    ON workspace_invitations(email);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_invited_by
    ON workspace_invitations(invited_by, created_at DESC);

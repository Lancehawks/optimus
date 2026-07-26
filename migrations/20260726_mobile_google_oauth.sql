-- Opaque, one-time Google OAuth state with PKCE for web and mobile clients.

BEGIN;

CREATE TABLE IF NOT EXISTS google_oauth_flows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    client_type VARCHAR(10) NOT NULL CHECK (client_type IN ('web', 'mobile')),
    state_hash VARCHAR(64) NOT NULL,
    code_verifier_ciphertext TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT google_oauth_flows_state_hash_unique UNIQUE (state_hash),
    CONSTRAINT google_oauth_flows_state_hash_length CHECK (char_length(state_hash) = 64),
    CONSTRAINT google_oauth_flows_verifier_encrypted
        CHECK (code_verifier_ciphertext LIKE 'enc:v1:%')
);

CREATE INDEX IF NOT EXISTS idx_google_oauth_flows_pending
    ON google_oauth_flows(client_type, expires_at, created_at)
    WHERE consumed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_google_oauth_flows_user_created
    ON google_oauth_flows(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_google_oauth_flows_cleanup
    ON google_oauth_flows((COALESCE(consumed_at, expires_at)));

COMMIT;

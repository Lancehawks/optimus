-- Changes the assistant proposes. A proposal changes nothing: the member sees
-- it as a card and it only runs when they confirm it. `card` keeps exactly what
-- they were shown, and the status moves from pending exactly once, so a double
-- click can't apply a change twice.

BEGIN;

CREATE TABLE IF NOT EXISTS ai_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES ai_chats(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tool VARCHAR(50) NOT NULL,
    input JSONB NOT NULL,
    card JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'applying', 'applied', 'cancelled', 'failed')),
    result JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_actions_chat_created ON ai_actions(chat_id, created_at);

COMMIT;

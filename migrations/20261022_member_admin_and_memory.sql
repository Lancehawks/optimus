-- Admins manage members and decide who can use the assistant; members can
-- leave notes about themselves (memory) for the assistant to read.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS ai_assistant_enabled_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('member', 'admin'));

CREATE INDEX IF NOT EXISTS idx_users_admins ON users(id) WHERE role = 'admin';

-- Only admins can turn the assistant on now. Access members granted
-- themselves under the previous rule is withdrawn; an admin can restore it.
UPDATE users
SET ai_assistant_enabled_at = NULL
WHERE ai_assistant_enabled_at IS NOT NULL
  AND ai_assistant_enabled_by IS NULL;

CREATE TABLE IF NOT EXISTS assistant_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assistant_memories_user ON assistant_memories(user_id, created_at, id);

DROP TRIGGER IF EXISTS trg_assistant_memories_updated_at ON assistant_memories;
CREATE TRIGGER trg_assistant_memories_updated_at
  BEFORE UPDATE ON assistant_memories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- A conversation keeps the memory it started with, so its prompt never
-- changes mid-conversation. Edits apply to new conversations.
ALTER TABLE ai_chats ADD COLUMN IF NOT EXISTS memory TEXT;

-- Members can bring their own provider keys and pick a model per message.
-- users.ai_assistant_enabled_at now means "an admin lets this member use the
-- workspace key"; anyone with their own key can use the assistant with it.

CREATE TABLE IF NOT EXISTS ai_provider_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    -- AES-256-GCM under TOKEN_ENCRYPTION_KEY (lib/secretEncryption.js).
    encrypted_key TEXT NOT NULL CHECK (encrypted_key LIKE 'enc:v1:%'),
    key_hint VARCHAR(24) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, provider)
);

DROP TRIGGER IF EXISTS trg_ai_provider_keys_updated_at ON ai_provider_keys;
CREATE TRIGGER trg_ai_provider_keys_updated_at
  BEFORE UPDATE ON ai_provider_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Which models members may pick. A model from the registry needs a passing
-- admin check before it can be enabled (enforced in lib/assistant/models).
CREATE TABLE IF NOT EXISTS ai_model_settings (
    model_key VARCHAR(200) PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    check_passed BOOLEAN,
    check_detail TEXT,
    checked_at TIMESTAMPTZ,
    checked_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A conversation can change models, so each response records its own.
ALTER TABLE ai_messages
  ADD COLUMN IF NOT EXISTS provider VARCHAR(50),
  ADD COLUMN IF NOT EXISTS model VARCHAR(200);

UPDATE ai_messages message
SET provider = chat.provider, model = chat.model
FROM ai_chats chat
WHERE chat.id = message.chat_id
  AND message.kind IN ('model', 'tool_results')
  AND message.provider IS NULL;

ALTER TABLE ai_chats ALTER COLUMN model TYPE VARCHAR(200);
ALTER TABLE ai_usage ALTER COLUMN model TYPE VARCHAR(200);

-- Whose key paid. Only workspace-key spend counts toward the monthly cap.
ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS key_source VARCHAR(20) NOT NULL DEFAULT 'workspace';
ALTER TABLE ai_usage DROP CONSTRAINT IF EXISTS ai_usage_key_source_check;
ALTER TABLE ai_usage ADD CONSTRAINT ai_usage_key_source_check CHECK (key_source IN ('workspace', 'member'));
CREATE INDEX IF NOT EXISTS idx_ai_usage_source_created ON ai_usage(key_source, created_at);

-- The model a member last chose, so the picker remembers it.
ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_model VARCHAR(200);

-- Optimus Assistant: a per-user opt-in, conversations, an append-only message
-- log and a usage ledger. The baseline's ai_chats and ai_messages tables were
-- never wired to a route; they are reshaped here rather than replaced so the
-- baseline remains the source of truth for which tables exist.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM ai_messages) OR EXISTS (SELECT 1 FROM ai_chats) THEN
    RAISE EXCEPTION 'ai_chats or ai_messages already contain rows; review them before applying the assistant migration';
  END IF;
END $$;

-- NULL means the assistant is off. The timestamp records when the member
-- agreed to send their questions and workspace data to the model provider.
ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_assistant_enabled_at TIMESTAMPTZ;

-- A conversation stays on the provider and model it started with, because a
-- provider's stored responses (for example reasoning blocks) can only be
-- replayed to that provider.
ALTER TABLE ai_chats
  ADD COLUMN IF NOT EXISTS provider VARCHAR(50) NOT NULL,
  ALTER COLUMN model SET NOT NULL,
  ALTER COLUMN title SET DEFAULT 'New conversation';

CREATE INDEX IF NOT EXISTS idx_ai_chats_user_updated ON ai_chats(user_id, updated_at DESC);

-- Rows are only ever appended. kind:
--   input        a member's message (content) and the context note sent with it
--   model        one model response; payload holds the provider-native blocks
--   tool_results results of the tool calls in the preceding model response
-- payload is JSON rather than JSONB: JSONB reorders object keys, and a model
-- response must be replayed exactly as the provider returned it.
ALTER TABLE ai_messages
  ADD COLUMN IF NOT EXISTS seq BIGINT GENERATED ALWAYS AS IDENTITY,
  ADD COLUMN IF NOT EXISTS kind VARCHAR(20) NOT NULL,
  ADD COLUMN IF NOT EXISTS payload JSON,
  ALTER COLUMN content SET DEFAULT '';

ALTER TABLE ai_messages DROP CONSTRAINT IF EXISTS ai_messages_kind_check;
ALTER TABLE ai_messages ADD CONSTRAINT ai_messages_kind_check
  CHECK (
    (kind = 'input' AND role = 'user')
    OR (kind = 'model' AND role = 'assistant')
    OR (kind = 'tool_results' AND role = 'user')
  );

DROP INDEX IF EXISTS idx_ai_messages_chat;
CREATE INDEX IF NOT EXISTS idx_ai_messages_chat_seq ON ai_messages(chat_id, seq);

-- One row per model call. It holds token counts and an estimated cost, never
-- message content, so it survives account and conversation deletion
-- anonymously for workspace spend tracking.
CREATE TABLE IF NOT EXISTS ai_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    chat_id UUID REFERENCES ai_chats(id) ON DELETE SET NULL,
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
    output_tokens INTEGER NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
    cache_read_tokens INTEGER NOT NULL DEFAULT 0 CHECK (cache_read_tokens >= 0),
    cache_write_tokens INTEGER NOT NULL DEFAULT 0 CHECK (cache_write_tokens >= 0),
    cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0 CHECK (cost_usd >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON ai_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_created ON ai_usage(user_id, created_at DESC);

-- The assistant opt-in on its own, ahead of 20261022_ai_assistant.sql. Every
-- signed-in request reads this column, so it ships separately from the
-- conversation tables. NULL means the assistant is off; the timestamp records
-- when the member agreed to send their questions and workspace data to the
-- model provider. 20261022_ai_assistant.sql adds it with IF NOT EXISTS too.
ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_assistant_enabled_at TIMESTAMPTZ;

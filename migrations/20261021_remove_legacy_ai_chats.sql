-- An earlier AI chat feature left conversations in ai_chats and ai_messages.
-- The workspace owner chose to delete them so 20261022_ai_assistant.sql can
-- reshape the tables. This only runs while the tables are still in their
-- legacy shape (no ai_chats.provider column); once the assistant migration has
-- run, the tables hold assistant conversations and this is a no-op.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'ai_chats'
      AND column_name = 'provider'
  ) THEN
    DELETE FROM ai_messages;
    DELETE FROM ai_chats;
  END IF;
END $$;

-- Notes are edited in BlockNote, which keeps its own block document. The HTML
-- in `content` stays alongside it for search, previews and the assistant.
-- Notes written before the switch have no blocks yet; the editor converts
-- their HTML when they are opened.

ALTER TABLE notes ADD COLUMN IF NOT EXISTS content_blocks JSONB;

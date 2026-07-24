-- Release hardening for idempotent task recurrence, optimistic whiteboard
-- saves, and indexed application search.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS recurrence_source_task_id UUID
  REFERENCES tasks(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_recurrence_source_unique
ON tasks(recurrence_source_task_id)
WHERE recurrence_source_task_id IS NOT NULL;

ALTER TABLE whiteboards
ADD COLUMN IF NOT EXISTS content_version INTEGER NOT NULL DEFAULT 1;

-- Older production databases skipped these legacy dashboard tables. Keep the
-- schema convergent until the remaining dashboard callers are retired.
CREATE TABLE IF NOT EXISTS habits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  frequency VARCHAR(10) DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly')),
  category VARCHAR(50),
  color VARCHAR(7) DEFAULT '#22c55e',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS habit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  completed BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(habit_id, log_date)
);

CREATE INDEX IF NOT EXISTS idx_habits_user_active ON habits(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_id ON habit_logs(habit_id);
CREATE INDEX IF NOT EXISTS idx_habit_logs_date ON habit_logs(log_date);

CREATE INDEX IF NOT EXISTS idx_tasks_search_title_trgm
ON tasks USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tasks_search_description_trgm
ON tasks USING GIN (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_notes_search_title_trgm
ON notes USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_notes_search_content_trgm
ON notes USING GIN (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_projects_search_name_trgm
ON projects USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_projects_search_description_trgm
ON projects USING GIN (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_bookmarks_search_title_trgm
ON bookmarks USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_bookmarks_search_url_trgm
ON bookmarks USING GIN (url gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_bookmarks_search_description_trgm
ON bookmarks USING GIN (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_resources_search_title_trgm
ON resources USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_resources_search_notes_trgm
ON resources USING GIN (notes gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_resources_search_file_url_trgm
ON resources USING GIN (file_url gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_notebooks_search_name_trgm
ON notebooks USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_bookmark_collections_search_name_trgm
ON bookmark_collections USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_notebooks_user_position
ON notebooks(user_id, position, name);
CREATE INDEX IF NOT EXISTS idx_bookmark_collections_user_name
ON bookmark_collections(user_id, name);
CREATE INDEX IF NOT EXISTS idx_flashcard_decks_user_created
ON flashcard_decks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reading_list_user_created
ON reading_list(user_id, created_at DESC);

COMMIT;

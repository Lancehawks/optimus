-- Note editor upgrades: save conflict checks, version history, and files
-- uploaded to Vercel Blob for note attachments and Library resources.

-- Bumped on every title or content change, so a save can tell whether the
-- note changed since the editor loaded it. updated_by is who made that change.
ALTER TABLE notes ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Earlier states of a note. A snapshot is taken before an edit when the last
-- one is old enough, and always before a restore or an overwrite. edited_by
-- and edited_at describe the state captured, not the edit that replaced it.
CREATE TABLE IF NOT EXISTS note_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    revision INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    content_blocks JSONB,
    edited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    edited_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_note_versions_note_created
    ON note_versions(note_id, created_at DESC);

-- Private blobs. Files are served through /api/files/<id>, which checks that
-- the viewer owns the file or can open the note it belongs to.
CREATE TABLE IF NOT EXISTS uploaded_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose VARCHAR(20) NOT NULL CHECK (purpose IN ('note', 'resource')),
    note_id UUID REFERENCES notes(id) ON DELETE SET NULL,
    pathname TEXT NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    content_type VARCHAR(255) NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uploaded_files_user ON uploaded_files(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_note ON uploaded_files(note_id) WHERE note_id IS NOT NULL;

ALTER TABLE resources ADD COLUMN IF NOT EXISTS file_id UUID REFERENCES uploaded_files(id) ON DELETE SET NULL;

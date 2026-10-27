-- Uploaded images that give the workspace some identity: project logos and
-- profile photos. Both are ordinary private uploads served through
-- /api/files/<id>. A logo is readable by the project's members, and a
-- profile photo by any signed-in member while it is someone's avatar.

ALTER TABLE uploaded_files DROP CONSTRAINT IF EXISTS uploaded_files_purpose_check;
ALTER TABLE uploaded_files ADD CONSTRAINT uploaded_files_purpose_check
  CHECK (purpose IN ('note', 'resource', 'project_logo', 'avatar'));

ALTER TABLE projects ADD COLUMN IF NOT EXISTS logo_file_id UUID REFERENCES uploaded_files(id) ON DELETE SET NULL;

-- One project per logo. The file route also looks a logo up by its file to
-- check membership.
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_logo_file ON projects(logo_file_id) WHERE logo_file_id IS NOT NULL;

-- A profile photo is stored in users.avatar_url as 'file:<uploaded file id>',
-- beside the 'preset:<name>' illustrations, so every query that already
-- reads avatar_url carries it. The file route looks photos up by that value.
CREATE INDEX IF NOT EXISTS idx_users_avatar_url ON users(avatar_url) WHERE avatar_url LIKE 'file:%';

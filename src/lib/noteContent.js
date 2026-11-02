// BlockNote's block document is stored as JSON next to the HTML it renders
// to (content), which search, previews and the assistant read.

const MAX_CONTENT_BLOCKS_LENGTH = 2_000_000;

// A new snapshot is taken before an edit once the newest one is this old, so
// a writing session leaves one restore point rather than one per keystroke.
export const NOTE_VERSION_INTERVAL_MS = 10 * 60 * 1000;
export const MAX_NOTE_VERSIONS = 100;

export function optionalContentBlocks(value) {
  if (value === undefined) return { provided: false };
  if (value === null) return { provided: true, value: null };
  if (!Array.isArray(value) || !value.every((block) => block && typeof block === "object" && !Array.isArray(block))) {
    return { error: "Content blocks must be a list of blocks" };
  }

  const serialized = JSON.stringify(value);
  if (serialized.length > MAX_CONTENT_BLOCKS_LENGTH) {
    return { error: "Note is too large to save" };
  }
  return { provided: true, value: serialized };
}

export function optionalRevision(value) {
  if (value === undefined || value === null) return { provided: false };
  if (!Number.isInteger(value) || value < 0) return { error: "Revision is invalid" };
  return { provided: true, value };
}

function isBlankNote(note) {
  return Number(note.revision) === 0 && !String(note.content || "").replace(/<[^>]*>/g, "").trim();
}

// Records the note as it is now, before a change replaces it. `force` takes a
// snapshot regardless of age (restores and overwrites). Runs inside the
// caller's transaction, with the note row already locked.
export async function snapshotNoteBeforeChange(client, note, { force = false, now = Date.now() } = {}) {
  if (isBlankNote(note)) return false;

  const latest = await client.query(
    "SELECT created_at, revision FROM note_versions WHERE note_id = $1 ORDER BY created_at DESC LIMIT 1",
    [note.id]
  );
  const newest = latest.rows[0];
  if (newest && Number(newest.revision) === Number(note.revision)) return false;
  if (!force && newest && now - new Date(newest.created_at).getTime() < NOTE_VERSION_INTERVAL_MS) return false;

  await client.query(
    `INSERT INTO note_versions (note_id, revision, title, content, content_blocks, edited_by, edited_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
    [
      note.id,
      note.revision,
      note.title,
      note.content,
      note.content_blocks == null ? null : JSON.stringify(note.content_blocks),
      note.updated_by || note.user_id,
      note.updated_at,
    ]
  );
  await client.query(
    `DELETE FROM note_versions
     WHERE note_id = $1
       AND id NOT IN (
         SELECT id FROM note_versions WHERE note_id = $1 ORDER BY created_at DESC LIMIT $2
       )`,
    [note.id, MAX_NOTE_VERSIONS]
  );
  return true;
}

// Unsaved note edits kept in this browser until the server confirms them, so
// a failed save or a closed tab doesn't lose work. Drafts never leave the
// device; the server only ever sees them when the member restores one.

const PREFIX = "optimus.note-draft.";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const DRAFT_FIELDS = ["title", "content", "contentBlocks"];

function storage() {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function pickDraftFields(changes) {
  const fields = {};
  for (const key of DRAFT_FIELDS) {
    if (changes?.[key] !== undefined) fields[key] = changes[key];
  }
  return fields;
}

export function mergeDraft(draft, changes, now = Date.now()) {
  const fields = pickDraftFields(changes);
  if (Object.keys(fields).length === 0) return draft;
  return { fields: { ...(draft?.fields || {}), ...fields }, savedAt: now };
}

// Drops the fields a successful save just stored. A field edited again since
// keeps its newer value and stays.
export function withoutSavedFields(draft, saved) {
  if (!draft) return null;
  const fields = { ...draft.fields };
  if (saved.title !== undefined && fields.title === saved.title) delete fields.title;
  if (saved.content !== undefined && fields.content === saved.content) {
    delete fields.content;
    delete fields.contentBlocks;
  }
  return Object.keys(fields).length > 0 ? { ...draft, fields } : null;
}

// Whether restoring the draft would change the note as the server has it.
export function draftDiffersFrom(draft, note) {
  if (!draft || !note) return false;
  const { title, content } = draft.fields;
  return (title !== undefined && title !== note.title) || (content !== undefined && content !== (note.content || ""));
}

export function readNoteDraft(noteId, now = Date.now()) {
  const store = storage();
  if (!store || !noteId) return null;
  try {
    const draft = JSON.parse(store.getItem(PREFIX + noteId) || "null");
    if (!draft?.fields || now - draft.savedAt > MAX_AGE_MS) {
      store.removeItem(PREFIX + noteId);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

function writeDraft(noteId, draft) {
  const store = storage();
  if (!store) return;
  try {
    if (draft) store.setItem(PREFIX + noteId, JSON.stringify(draft));
    else store.removeItem(PREFIX + noteId);
  } catch {
    // Storage full or blocked: the in-memory retry still holds the change.
  }
}

export function saveNoteDraft(noteId, changes) {
  writeDraft(noteId, mergeDraft(readNoteDraft(noteId), changes));
}

export function clearSavedNoteDraft(noteId, saved) {
  writeDraft(noteId, withoutSavedFields(readNoteDraft(noteId), saved));
}

export function discardNoteDraft(noteId) {
  writeDraft(noteId, null);
}

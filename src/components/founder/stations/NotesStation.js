"use client";

import { useRef, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { EMPTY_NOTE, NOTE_MAX_LENGTH } from "../constants";
import { useFounderCollection } from "../hooks/useFounderCollection";
import { FOUNDER_ENDPOINTS } from "../services/founderApi";
import { cx } from "../utils/cx";
import { formatTimestampDate } from "../utils/format";
import { sortNotes } from "../utils/sort";
import { ActionButton, EmptyState, StationHeader, StatusMessage } from "./shared/StationUi";
import station from "./shared/station.module.css";
import styles from "./NotesStation.module.css";

const canSaveNote = (note) => Boolean(note?.title.trim() && note.body.trim());

export function NotesStation() {
  const collection = useFounderCollection(FOUNDER_ENDPOINTS.notes, "notes", "note", sortNotes);
  // Bumped whenever the editor switches note, so a slow save cannot replace
  // the draft the founder moved on to.
  const noteEditGeneration = useRef(0);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  // With a draft open, the list highlights the note being edited (none for a
  // new note); otherwise the newest note is shown ready to edit.
  const selected = draft
    ? collection.items.find((note) => note.id === draft.id) || null
    : collection.items[0] || null;
  const activeDraft = draft || (selected ? { ...selected } : null);
  const origin = selected || EMPTY_NOTE;
  const isDirty = Boolean(draft) && (draft.title !== origin.title || draft.body !== origin.body);

  const openDraft = (next) => {
    if (isDirty && !window.confirm("Discard unsaved note changes?")) return;
    noteEditGeneration.current++;
    setDraft(next);
  };

  const updateDraft = (name) => (event) => setDraft({ ...activeDraft, [name]: event.target.value });

  const saveNote = async () => {
    if (!canSaveNote(activeDraft) || saving) return;
    setSaving(true);
    try {
      const generation = noteEditGeneration.current;
      const saved = await collection.save(activeDraft);
      if (generation === noteEditGeneration.current) setDraft({ ...saved });
    } catch (error) {
      collection.setError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const removeNote = async () => {
    if (!activeDraft?.id || !window.confirm(`Remove “${activeDraft.title}”?`)) return;
    try {
      await collection.remove(activeDraft);
      setDraft(null);
    } catch (error) {
      collection.setError(error.message);
    }
  };

  const showEmpty = !collection.loading && !collection.error && collection.items.length === 0 && !draft;

  return (
    <section className={station.stationViewport}>
      <StationHeader
        index="07"
        label="Founder notes"
        title="Leave the thinking in the room."
        copy="Shared decisions, observations, and ideas—separate from Optimus notes."
        action={<ActionButton onClick={() => openDraft({ ...EMPTY_NOTE })}><Plus aria-hidden="true" /> New note</ActionButton>}
      />
      <StatusMessage loading={collection.loading} error={collection.error} onRetry={collection.retry} />
      {showEmpty && <EmptyState>The desk is clear. Write the first founder note.</EmptyState>}
      {(collection.items.length > 0 || activeDraft) && (
        <div className={styles.notesDesk}>
          <nav aria-label="Founder notes">
            {collection.items.map((note) => (
              <button type="button" key={note.id} className={selected?.id === note.id ? styles.selectedNote : ""} onClick={() => openDraft({ ...note })}>
                <strong>{note.title}</strong>
                <span>{formatTimestampDate(note.updatedAt)}</span>
              </button>
            ))}
          </nav>
          <div className={styles.notePaper}>
            {activeDraft ? (
              <>
                <input disabled={saving} aria-label="Note title" placeholder="Note title" maxLength={160} value={activeDraft.title} onChange={updateDraft("title")} />
                <textarea disabled={saving} maxLength={NOTE_MAX_LENGTH} aria-label="Note content" placeholder="Write the thought clearly..." value={activeDraft.body} onChange={updateDraft("body")} />
                <footer>
                  <span>{activeDraft.body.length} characters</span>
                  <div className={station.rowActions}>
                    {activeDraft.id && <button type="button" disabled={saving} onClick={removeNote} aria-label="Delete note"><Trash2 aria-hidden="true" /></button>}
                    <button type="button" className={cx(station.primaryButton, styles.noteSave)} onClick={saveNote} disabled={!canSaveNote(activeDraft) || saving}><Check aria-hidden="true" /> {saving ? "Saving" : "Save note"}</button>
                  </div>
                </footer>
              </>
            ) : <p>Select a note or begin a new one.</p>}
          </div>
        </div>
      )}
    </section>
  );
}

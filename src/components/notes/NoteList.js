"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/ui";

function stripHtml(html) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "").substring(0, 120);
}

// ── Individual note row with hover actions ────────────────────
function NoteRow({ note, isSelected, onSelect, onPin, onDelete }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteTimerRef = useRef(null);
  useEffect(() => () => clearTimeout(deleteTimerRef.current), []);

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    if (confirmingDelete) {
      clearTimeout(deleteTimerRef.current);
      setConfirmingDelete(false);
      onDelete?.(note.id);
    } else {
      setConfirmingDelete(true);
      deleteTimerRef.current = setTimeout(() => setConfirmingDelete(false), 3000);
    }
  };

  return (
    <div
      onClick={() => onSelect(note)}
      className={cn(
        "group relative w-full text-left px-4 py-3.5 transition-colors cursor-pointer hover:bg-surface-tertiary/50",
        isSelected && "bg-brand-500/10 border-l-2 border-l-brand-500"
      )}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <div className="flex items-center gap-2">
            {note.is_pinned && (
              <svg className="h-3.5 w-3.5 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
              </svg>
            )}
            <h4 className="text-body-sm text-heading! font-medium truncate">
              {note.title || "Untitled"}
            </h4>
          </div>

          {/* Preview */}
          {note.content && (
            <p className="text-caption mt-0.5 line-clamp-2 text-muted">
              {stripHtml(note.content)}
            </p>
          )}

          {/* Meta */}
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-caption">{formatDate(note.updated_at)}</span>
            {note.notebook_name && (
              <>
                <span className="text-caption text-muted">·</span>
                <span className="text-caption">{note.notebook_name}</span>
              </>
            )}
            {note.project_name && (
              <>
                <span className="text-caption text-muted">·</span>
                <span
                  className="inline-flex text-[0.625rem] px-1.5 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: (note.project_color || "#6366f1") + "20", color: note.project_color || "#6366f1" }}
                >
                  {note.project_name}
                </span>
              </>
            )}
          </div>

          {/* Tags */}
          {note.tags && note.tags.length > 0 && (
            <div className="flex gap-1 mt-1.5">
              {note.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex text-[0.625rem] px-1.5 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: tag.color + "20", color: tag.color }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Hover actions — pin + delete */}
        <div className="flex flex-col items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 pt-0.5">
          <button
            onClick={(e) => { e.stopPropagation(); onPin?.(note.id, note.is_pinned); }}
            title={note.is_pinned ? "Unpin" : "Pin"}
            className={cn(
              "p-1 rounded-md transition-colors",
              note.is_pinned
                ? "text-amber-400 hover:bg-amber-500/10"
                : "text-muted hover:text-amber-400 hover:bg-amber-500/10"
            )}
          >
            <svg
              className="h-3.5 w-3.5"
              fill={note.is_pinned ? "currentColor" : "none"}
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
            </svg>
          </button>

          <button
            onClick={handleDeleteClick}
            title={confirmingDelete ? "Click again to confirm" : "Delete note"}
            className={cn(
              "p-1 rounded-md transition-all",
              confirmingDelete
                ? "text-red-400 bg-red-500/10"
                : "text-muted hover:text-red-400 hover:bg-red-500/10"
            )}
          >
            {confirmingDelete ? (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            ) : (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Note list ─────────────────────────────────────────────────
export default function NoteList({ notes, selectedNoteId, onSelectNote, onPin, onDelete }) {
  if (notes.length === 0) {
    return (
      <EmptyState
        icon={
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        }
        title="No notes found"
        description="Create a new note to get started."
      />
    );
  }

  return (
    <div className="divide-y divide-border-light">
      {notes.map((note) => (
        <NoteRow
          key={note.id}
          note={note}
          isSelected={selectedNoteId === note.id}
          onSelect={onSelectNote}
          onPin={onPin}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

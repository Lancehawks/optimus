"use client";

import { useEffect, useRef, useState } from "react";
import { NotebookPen, Pin, Trash2, TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";

function stripHtml(html) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().substring(0, 160);
}

function formatNoteDate(date) {
  const value = new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (sameDay(value, today)) return value.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (sameDay(value, yesterday)) return "Yesterday";
  return value.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function NoteRow({ note, isSelected, onSelect, onPin, onDelete, currentUserId }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteTimerRef = useRef(null);
  const canEdit = note.user_id === currentUserId || note.is_project_owner;
  const canDelete = note.project_id ? Boolean(note.is_project_owner) : note.user_id === currentUserId;

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
      role="button"
      tabIndex={0}
      aria-current={isSelected ? "true" : undefined}
      onClick={() => onSelect(note)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(note);
        }
      }}
      className={cn(
        "group relative w-full cursor-pointer px-4 py-3 text-left outline-none transition-colors focus-visible:bg-surface-secondary",
        isSelected ? "bg-surface-tertiary" : "hover:bg-surface-secondary"
      )}
    >
      {isSelected && <span className="absolute inset-y-2 left-0 w-0.5 rounded-r bg-heading" aria-hidden="true" />}
      <div className="flex items-baseline gap-2">
        {note.is_pinned && <Pin className="h-3 w-3 shrink-0 translate-y-px fill-current text-muted" aria-label="Pinned" />}
        <h4 className="min-w-0 flex-1 truncate text-sm font-medium text-heading">{note.title || "Untitled"}</h4>
        <span className="shrink-0 font-mono text-[0.6875rem] text-muted group-hover:hidden">{formatNoteDate(note.updated_at)}</span>
        <span className="hidden shrink-0 items-center gap-0.5 group-hover:flex" onClick={(e) => e.stopPropagation()}>
          {canEdit && (
            <button
              type="button"
              onClick={() => onPin?.(note.id, note.is_pinned)}
              title={note.is_pinned ? "Unpin" : "Pin"}
              aria-label={note.is_pinned ? "Unpin note" : "Pin note"}
              className="flex h-5 w-5 cursor-pointer items-center justify-center rounded text-muted hover:text-heading"
            >
              <Pin className={cn("h-3 w-3", note.is_pinned && "fill-current")} />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={handleDeleteClick}
              title={confirmingDelete ? "Click again to delete" : "Delete note"}
              aria-label={confirmingDelete ? "Confirm delete" : "Delete note"}
              className={cn(
                "flex h-5 w-5 cursor-pointer items-center justify-center rounded",
                confirmingDelete ? "bg-danger-light text-danger" : "text-muted hover:text-danger"
              )}
            >
              {confirmingDelete ? <TriangleAlert className="h-3 w-3" /> : <Trash2 className="h-3 w-3" />}
            </button>
          )}
        </span>
      </div>

      <p className={cn("mt-1 text-xs leading-5", note.content ? "line-clamp-2 text-muted" : "italic text-placeholder")}>
        {note.content ? stripHtml(note.content) : "Empty note"}
      </p>

      {(note.project_name || note.notebook_name || note.tags?.length > 0) && (
        <div className="mt-2 flex min-w-0 items-center gap-2 text-[0.6875rem] text-muted">
          {note.project_name && (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-[2px]" style={{ backgroundColor: note.project_color || "var(--neutral-400)" }} />
              <span className="truncate">{note.project_name}</span>
            </span>
          )}
          {note.notebook_name && <span className="truncate">{note.notebook_name}</span>}
          {note.tags?.slice(0, 2).map((tag) => (
            <span key={tag.id} className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
              {tag.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NoteList({ notes, selectedNoteId, onSelectNote, onPin, onDelete, currentUserId }) {
  if (notes.length === 0) {
    return <EmptyState icon={<NotebookPen />} title="No notes here" description="Start a page with the + button above." />;
  }

  return (
    <div className="divide-y divide-border">
      {notes.map((note) => (
        <NoteRow
          key={note.id}
          note={note}
          isSelected={selectedNoteId === note.id}
          onSelect={onSelectNote}
          onPin={onPin}
          onDelete={onDelete}
          currentUserId={currentUserId}
        />
      ))}
    </div>
  );
}

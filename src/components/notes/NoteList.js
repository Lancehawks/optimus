"use client";

import { useEffect, useRef, useState } from "react";
import { Badge, EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";

function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 140);
}

function formatNoteDate(date) {
  const value = new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();

  if (sameDay(value, today)) {
    return value.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  if (sameDay(value, yesterday)) {
    return "Yesterday";
  }

  return value.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function NoteRow({ note, isSelected, onSelect, onPin, onDelete, currentUserId }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteTimerRef = useRef(null);
  const canDelete = note.user_id === currentUserId || note.is_project_owner;

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

  const handleKeyboardSelect = (e) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(note);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(note)}
      onKeyDown={handleKeyboardSelect}
      className={cn(
        "group relative w-full rounded-lg border px-3 py-3 text-left outline-none transition-all cursor-pointer",
        isSelected
          ? "border-brand-500/45 bg-brand-500/10 shadow-[inset_3px_0_0_var(--color-brand-500)]"
          : "border-border/70 bg-surface-secondary/55 hover:border-border-strong hover:bg-surface-tertiary/50"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            {note.is_pinned && (
              <svg className="h-3.5 w-3.5 shrink-0 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
              </svg>
            )}
            <h4 className="truncate text-body-sm font-medium text-heading!">
              {note.title || "Untitled"}
            </h4>
          </div>

          <p
            className={cn(
              "mt-1 min-h-[2.25rem] text-caption leading-relaxed",
              note.content ? "line-clamp-2 text-muted!" : "text-disabled italic"
            )}
          >
            {note.content ? stripHtml(note.content) : "No preview yet"}
          </p>

          <div className="mt-2 flex min-w-0 items-center gap-1.5">
            {note.project_name ? (
              <>
                <Badge variant="info" size="sm" className="h-5 shrink-0">Shared</Badge>
                <span
                  className="inline-flex h-5 min-w-0 max-w-[10rem] shrink items-center rounded-full px-1.5 py-0.5 text-[0.625rem] font-medium"
                  style={{ backgroundColor: (note.project_color || "#0d6b88") + "20", color: note.project_color || "#0d6b88" }}
                  title={note.project_name}
                >
                  <span className="truncate">{note.project_name}</span>
                </span>
              </>
            ) : (
              <Badge variant="neutral" size="sm" className="h-5 shrink-0">Personal</Badge>
            )}
          </div>

          <div className="mt-1.5 flex min-w-0 items-center gap-1.5">
            {note.notebook_name && (
              <span className="max-w-[8rem] truncate text-caption text-muted!">
                {note.notebook_name}
              </span>
            )}

            <span className="ml-auto shrink-0 text-caption text-muted!">
              {formatNoteDate(note.updated_at)}
            </span>
          </div>

          {note.tags && note.tags.length > 0 && (
            <div className="mt-2 flex gap-1 overflow-hidden">
              {note.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex shrink-0 rounded-full px-1.5 py-0.5 text-[0.625rem] font-medium"
                  style={{ backgroundColor: tag.color + "20", color: tag.color }}
                >
                  {tag.name}
                </span>
              ))}
              {note.tags.length > 3 && (
                <span className="text-caption text-muted!">+{note.tags.length - 3}</span>
              )}
            </div>
          )}
        </div>

        <div
          className={cn(
            "flex shrink-0 items-center gap-0.5 transition-opacity",
            isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
          )}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onPin?.(note.id, note.is_pinned); }}
            title={note.is_pinned ? "Unpin" : "Pin"}
            className={cn(
              "rounded-md p-1 transition-colors cursor-pointer",
              note.is_pinned
                ? "text-amber-400 hover:bg-amber-500/10"
                : "text-muted hover:bg-amber-500/10 hover:text-amber-400"
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

          {canDelete && (
            <button
              type="button"
              onClick={handleDeleteClick}
              title={confirmingDelete ? "Click again to confirm" : "Delete note"}
              className={cn(
                "rounded-md p-1 transition-all cursor-pointer",
                confirmingDelete
                  ? "bg-red-500/10 text-red-400"
                  : "text-muted hover:bg-red-500/10 hover:text-red-400"
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
          )}
        </div>
      </div>
    </div>
  );
}

export default function NoteList({ notes, selectedNoteId, onSelectNote, onPin, onDelete, currentUserId }) {
  if (notes.length === 0) {
    return (
      <div className="p-3">
        <EmptyState
          icon={
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          }
          title="No notes found"
          description="Create a new note to get started."
        />
      </div>
    );
  }

  return (
    <div className="space-y-2 p-2">
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

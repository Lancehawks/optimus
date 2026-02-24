"use client";

import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";

function stripHtml(html) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "").substring(0, 120);
}

export default function NoteList({ notes, selectedNoteId, onSelectNote }) {
  if (notes.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-center">
        <p className="text-body-sm text-muted!">No notes found</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border-light">
      {notes.map((note) => (
        <button
          key={note.id}
          onClick={() => onSelectNote(note)}
          className={cn(
            "w-full text-left px-4 py-3.5 transition-colors cursor-pointer hover:bg-surface-tertiary/50",
            selectedNoteId === note.id && "bg-brand-50/50 border-l-2 border-l-brand-500"
          )}
        >
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
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

              {note.content && (
                <p className="text-caption mt-0.5 line-clamp-2">
                  {stripHtml(note.content)}
                </p>
              )}

              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-caption">
                  {formatDate(note.updated_at)}
                </span>
                {note.notebook_name && (
                  <>
                    <span className="text-caption">·</span>
                    <span className="text-caption">{note.notebook_name}</span>
                  </>
                )}
              </div>

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
          </div>
        </button>
      ))}
    </div>
  );
}

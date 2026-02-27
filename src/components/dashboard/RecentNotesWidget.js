"use client";

import { useRouter } from "next/navigation";
import { useNotes } from "@/hooks/useNotes";

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-2.5">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-10 rounded-lg bg-neutral-700/50 animate-pulse" />
      ))}
    </div>
  );
}

function relativeTime(dateStr) {
  if (!dateStr) return "";
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function RecentNotesWidget() {
  const router = useRouter();
  const { notes, isLoading } = useNotes({ sort: "updated_at", order: "desc" });

  const displayNotes = notes.slice(0, 4);

  return (
    <div className="card p-5 flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-purple-500/10">
            <svg className="h-4 w-4 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <h3 className="text-h4">Recent Notes</h3>
        </div>
        {!isLoading && notes.length > 0 && (
          <span className="text-caption text-muted">{notes.length} note{notes.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <SkeletonRows />
      ) : displayNotes.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-6 text-center">
          <p className="text-body-sm text-heading font-medium">No notes yet</p>
          <p className="text-caption text-muted mt-1">Capture your thoughts</p>
          <button
            onClick={() => router.push("/notes")}
            className="mt-3 text-caption text-brand-400 hover:text-brand-300 transition-colors cursor-pointer"
          >
            Write your first note →
          </button>
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {displayNotes.map((note) => (
            <li key={note.id}>
              <button
                onClick={() => router.push("/notes")}
                className="w-full text-left flex items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-neutral-700/40 transition-colors cursor-pointer"
              >
                {/* Icon */}
                <svg className="shrink-0 mt-0.5 h-4 w-4 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>

                <div className="flex-1 min-w-0">
                  <p className="text-body-sm text-heading font-medium truncate leading-tight">
                    {note.title || "Untitled"}
                    {note.is_pinned && (
                      <span className="ml-1.5 text-amber-400 text-xs">📌</span>
                    )}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {note.notebook_name && (
                      <span className="text-caption text-muted truncate max-w-[80px]">
                        {note.notebook_name}
                      </span>
                    )}
                    {note.notebook_name && <span className="text-neutral-600">·</span>}
                    <span className="text-caption text-neutral-500 shrink-0">
                      {relativeTime(note.updated_at)}
                    </span>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Footer */}
      <button
        onClick={() => router.push("/notes")}
        className="text-caption text-brand-400 hover:text-brand-300 transition-colors text-left mt-auto cursor-pointer"
      >
        View all notes →
      </button>
    </div>
  );
}

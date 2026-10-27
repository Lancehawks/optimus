"use client";

/* eslint-disable @next/next/no-img-element -- Whiteboard thumbnails can be arbitrary user-generated image URLs. */

import { Copy, MoreHorizontal, PenTool, Pencil, Pin, Trash2 } from "lucide-react";
import { Dropdown } from "@/components/ui";

function timeAgo(dateStr) {
  const date = new Date(dateStr);
  const diffMins = Math.floor((Date.now() - date) / 60000);
  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function WhiteboardCard({ whiteboard, onClick, onDelete, onRename, onDuplicate, onTogglePin, canEdit = true, canDelete = true }) {
  return (
    <div
      className="card card-hover group cursor-pointer overflow-hidden"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter") onClick();
      }}
    >
      <div
        className="relative flex aspect-[4/3] items-center justify-center overflow-hidden border-b border-border bg-surface-secondary"
        style={{
          backgroundImage: whiteboard.thumbnail_url ? undefined : "radial-gradient(var(--neutral-500) 0.75px, transparent 0.75px)",
          backgroundSize: "14px 14px",
        }}
      >
        {whiteboard.thumbnail_url ? (
          <img src={whiteboard.thumbnail_url} alt="" className="h-full w-full bg-white object-cover" />
        ) : (
          <PenTool className="h-6 w-6 text-placeholder" strokeWidth={1.5} />
        )}
        {whiteboard.is_pinned && (
          <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-md bg-surface text-heading shadow-sm ring-1 ring-border">
            <Pin className="h-3 w-3 fill-current" aria-label="Pinned" />
          </span>
        )}
        {whiteboard.category && (
          <span className="absolute right-2 top-2 rounded-md bg-surface px-1.5 py-0.5 text-2xs capitalize text-body shadow-sm ring-1 ring-border">
            {whiteboard.category.replaceAll("_", " ")}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 px-3.5 py-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium text-heading">{whiteboard.title}</h3>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
            <span className="font-mono">{timeAgo(whiteboard.updated_at)}</span>
            {whiteboard.project_name && (
              <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
                <span className="h-1.5 w-1.5 shrink-0 rounded-[2px]" style={{ backgroundColor: whiteboard.project_color || "var(--neutral-400)" }} />
                {whiteboard.project_name}
              </span>
            )}
          </p>
        </div>

        <div className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
          <Dropdown
            align="right"
            trigger={
              <button
                type="button"
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-surface-tertiary hover:text-heading"
                aria-label={`Actions for ${whiteboard.title}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            }
            items={[
              canEdit && { label: whiteboard.is_pinned ? "Unpin" : "Pin to top", onClick: onTogglePin, icon: <Pin /> },
              { label: "Duplicate", onClick: onDuplicate, icon: <Copy /> },
              canEdit && { label: "Rename", onClick: onRename, icon: <Pencil /> },
              canDelete && { divider: true },
              canDelete && { label: "Delete", onClick: onDelete, danger: true, icon: <Trash2 /> },
            ].filter(Boolean)}
          />
        </div>
      </div>
    </div>
  );
}

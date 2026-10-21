"use client";

import { ChevronDown, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Dropdown } from "@/components/ui";
import { cn } from "@/lib/utils";

const statusTone = {
  unread: "text-muted",
  reading: "text-warning",
  completed: "text-success",
};

function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function ReadingListItem({ item, onEdit, onDelete, onStatusChange, canEdit = true, canDelete = true }) {
  const progress = item.progress || 0;

  return (
    <div className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-secondary">
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2">
          <span className={cn("truncate text-sm font-medium", item.status === "completed" ? "text-muted" : "text-heading")}>{item.title}</span>
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 truncate font-mono text-[0.6875rem] text-muted hover:text-heading hover:underline"
            >
              {getDomain(item.url)}
            </a>
          )}
        </p>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-1 w-full max-w-56 overflow-hidden rounded-full bg-surface-tertiary">
            <div
              className={cn("h-full rounded-full transition-all", item.status === "completed" ? "bg-success" : "bg-heading")}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="font-mono text-[0.6875rem] tabular-nums text-muted">{progress}%</span>
        </div>
      </div>

      <div className="relative shrink-0">
        <select
          value={item.status}
          onChange={(e) => onStatusChange(item.id, e.target.value)}
          disabled={!canEdit}
          aria-label="Reading status"
          className={cn(
            "h-7 appearance-none rounded-md border border-transparent bg-transparent pl-2 pr-6 text-xs font-medium outline-none transition-colors",
            statusTone[item.status] || statusTone.unread,
            canEdit ? "cursor-pointer hover:border-border" : "cursor-default opacity-70"
          )}
        >
          <option value="unread">Unread</option>
          <option value="reading">Reading</option>
          <option value="completed">Completed</option>
        </select>
        <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted" />
      </div>

      {(canEdit || canDelete) && (
        <Dropdown
          align="right"
          trigger={
            <button
              type="button"
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted opacity-0 transition-opacity hover:bg-surface-tertiary hover:text-heading focus-visible:opacity-100 group-hover:opacity-100"
              aria-label={`Actions for ${item.title}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          }
          items={[
            canEdit && { label: "Edit", icon: <Pencil />, onClick: () => onEdit(item) },
            canEdit && canDelete && { divider: true },
            canDelete && { label: "Delete", danger: true, icon: <Trash2 />, onClick: () => onDelete(item) },
          ].filter(Boolean)}
        />
      )}
    </div>
  );
}

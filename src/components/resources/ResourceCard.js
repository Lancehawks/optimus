"use client";

import { ArrowUpRight, File, FileImage, FileText, Folder, Link2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Dropdown } from "@/components/ui";

const typeIcons = { link: Link2, pdf: FileText, image: FileImage, doc: File, other: Folder };

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

/** A study resource, rendered as a list row. */
export default function ResourceCard({ resource, onEdit, onDelete }) {
  const Icon = typeIcons[resource.type] || typeIcons.other;
  const items = [{ label: "Edit", icon: <Pencil />, onClick: () => onEdit(resource) }];
  if (resource.file_url) {
    items.push({ label: "Open", icon: <ArrowUpRight />, onClick: () => window.open(resource.file_url, "_blank", "noopener") });
  }
  items.push({ divider: true }, { label: "Delete", danger: true, icon: <Trash2 />, onClick: () => onDelete(resource) });

  return (
    <div className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-secondary">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-secondary text-muted">
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <button type="button" onClick={() => onEdit(resource)} className="min-w-0 flex-1 cursor-pointer text-left">
        <span className="flex items-baseline gap-2">
          <span className="truncate text-sm font-medium text-heading">{resource.title}</span>
          <span className="shrink-0 font-mono text-[0.625rem] uppercase text-muted">{resource.type}</span>
        </span>
        {resource.notes && <span className="mt-0.5 block truncate text-xs text-muted">{resource.notes}</span>}
      </button>
      <span className="mt-1 shrink-0 font-mono text-[0.6875rem] text-placeholder">{timeAgo(resource.created_at)}</span>
      <Dropdown
        align="right"
        trigger={
          <button
            type="button"
            className="-mr-1 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted opacity-0 transition-opacity hover:bg-surface-tertiary hover:text-heading focus-visible:opacity-100 group-hover:opacity-100"
            aria-label={`Actions for ${resource.title}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        }
        items={items}
      />
    </div>
  );
}

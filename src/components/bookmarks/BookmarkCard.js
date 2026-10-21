"use client";

/* eslint-disable @next/next/no-img-element -- Bookmark favicons are arbitrary user-provided remote URLs. */

import { useState } from "react";
import { ArrowUpRight, Globe, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Dropdown } from "@/components/ui";

function timeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(months / 12)}y`;
}

function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function Favicon({ src }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-secondary text-muted">
        <Globe className="h-4 w-4" strokeWidth={1.75} />
      </span>
    );
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface">
      <img src={src} alt="" className="h-4 w-4 rounded-[3px]" onError={() => setFailed(true)} />
    </span>
  );
}

/** A saved link, rendered as a list row. */
export default function BookmarkCard({ bookmark, onEdit, onDelete }) {
  const items = [
    { label: "Edit", icon: <Pencil />, onClick: () => onEdit(bookmark) },
    { label: "Open in new tab", icon: <ArrowUpRight />, onClick: () => window.open(bookmark.url, "_blank", "noopener") },
    { divider: true },
    { label: "Delete", danger: true, icon: <Trash2 />, onClick: () => onDelete(bookmark.id) },
  ];

  return (
    <div className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-secondary">
      <Favicon src={bookmark.favicon_url} />
      <a
        href={bookmark.url}
        target="_blank"
        rel="noopener noreferrer"
        className="min-w-0 flex-1"
      >
        <span className="flex items-baseline gap-2">
          <span className="truncate text-sm font-medium text-heading group-hover:underline group-hover:decoration-border-strong group-hover:underline-offset-4">
            {bookmark.title || bookmark.url}
          </span>
          <span className="shrink-0 truncate font-mono text-[0.6875rem] text-muted">{getDomain(bookmark.url)}</span>
        </span>
        {bookmark.description && <span className="mt-0.5 block truncate text-xs text-muted">{bookmark.description}</span>}
        {bookmark.tags?.length > 0 && (
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            {bookmark.tags.map((tag) => (
              <span key={tag.id} className="inline-flex items-center gap-1 text-[0.6875rem] text-muted">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                {tag.name}
              </span>
            ))}
          </span>
        )}
      </a>
      <span className="mt-1 shrink-0 font-mono text-[0.6875rem] text-placeholder">{timeAgo(bookmark.created_at)}</span>
      <Dropdown
        align="right"
        trigger={
          <button
            type="button"
            className="-mr-1 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted opacity-0 transition-opacity hover:bg-surface-tertiary hover:text-heading focus-visible:opacity-100 group-hover:opacity-100"
            aria-label={`Actions for ${bookmark.title || bookmark.url}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        }
        items={items}
      />
    </div>
  );
}

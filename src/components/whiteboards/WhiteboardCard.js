"use client";

/* eslint-disable @next/next/no-img-element -- Whiteboard thumbnails can be arbitrary user-generated image URLs. */

import { Dropdown } from "@/components/ui";

function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function WhiteboardCard({ whiteboard, onClick, onDelete, onRename, onDuplicate, onTogglePin }) {
  return (
    <div
      className="card card-hover group cursor-pointer"
      onClick={onClick}
    >
      {/* Thumbnail area */}
      <div className="aspect-[4/3] bg-neutral-900 flex items-center justify-center border-b border-border overflow-hidden relative">
        {whiteboard.thumbnail_url ? (
          <img
            src={whiteboard.thumbnail_url}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <svg className="h-12 w-12 text-neutral-600" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
          </svg>
        )}

        {/* Pin indicator */}
        {whiteboard.is_pinned && (
          <div className="absolute top-2 left-2 p-1 rounded-md bg-black/50 text-brand-400">
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
            </svg>
          </div>
        )}

        {/* Category badge */}
        {whiteboard.category && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/50 text-caption text-brand-300 text-[0.6875rem]">
            {whiteboard.category}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3.5 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-body-sm text-heading! font-medium truncate">{whiteboard.title}</h3>
          <div className="flex items-center gap-2">
            <p className="text-caption">{timeAgo(whiteboard.updated_at)}</p>
            {whiteboard.project_name && (
              <span className="text-[0.6875rem] text-brand-400 bg-brand-500/10 px-1.5 py-0.5 rounded truncate max-w-24">
                {whiteboard.project_name}
              </span>
            )}
          </div>
        </div>

        <div
          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <Dropdown
            align="right"
            trigger={
              <button className="p-1.5 rounded-lg hover:bg-surface-tertiary cursor-pointer transition-colors">
                <svg className="h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                </svg>
              </button>
            }
            items={[
              {
                label: whiteboard.is_pinned ? "Unpin" : "Pin to top",
                onClick: onTogglePin,
                icon: (
                  <svg fill={whiteboard.is_pinned ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                  </svg>
                ),
              },
              {
                label: "Duplicate",
                onClick: onDuplicate,
                icon: (
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.5a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m0 0a2.625 2.625 0 113.882 2.316l-.318.09A2.625 2.625 0 018.25 11v-.036" />
                  </svg>
                ),
              },
              {
                label: "Rename",
                onClick: onRename,
                icon: (
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                  </svg>
                ),
              },
              { divider: true },
              {
                label: "Delete",
                onClick: onDelete,
                danger: true,
                icon: (
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                ),
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

"use client";

import { Badge, Dropdown } from "@/components/ui";

const statusConfig = {
  unread: { label: "Unread", variant: "neutral" },
  reading: { label: "Reading", variant: "warning" },
  completed: { label: "Completed", variant: "success" },
};

export default function ReadingListItem({ item, onEdit, onDelete, onStatusChange, onProgressChange }) {
  const config = statusConfig[item.status] || statusConfig.unread;

  return (
    <div className="p-4 border-b border-border flex items-center gap-4">
      <div className="min-w-0 flex-1">
        <h4 className="text-heading! font-medium truncate">{item.title}</h4>
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-caption text-brand-400 truncate block mt-0.5 hover:underline"
          >
            {item.url}
          </a>
        )}
        <div className="mt-2">
          <div className="h-1.5 rounded-full bg-neutral-700 w-full max-w-48">
            <div
              className="h-1.5 rounded-full bg-brand-500 transition-all"
              style={{ width: `${item.progress || 0}%` }}
            />
          </div>
          <span className="text-caption text-muted! mt-1 block">{item.progress || 0}%</span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <select
          value={item.status}
          onChange={(e) => onStatusChange(item.id, e.target.value)}
          className="input-base focus:input-focus text-xs py-1 px-2 appearance-none cursor-pointer pr-7 bg-transparent"
        >
          <option value="unread">Unread</option>
          <option value="reading">Reading</option>
          <option value="completed">Completed</option>
        </select>

        <Badge variant={config.variant} size="sm">
          {config.label}
        </Badge>

        <Dropdown
          align="right"
          trigger={
            <button className="btn-ghost rounded-lg p-1.5 cursor-pointer">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
              </svg>
            </button>
          }
          items={[
            { label: "Edit", onClick: () => onEdit(item) },
            { divider: true },
            { label: "Delete", danger: true, onClick: () => onDelete(item) },
          ]}
        />
      </div>
    </div>
  );
}

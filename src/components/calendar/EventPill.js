"use client";

import { cn } from "@/lib/utils";
import { formatTimeShort } from "@/lib/calendarUtils";

export default function EventPill({ event, onClick }) {
  const color = event.calendar_color || "#6366f1";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(event);
      }}
      className={cn(
        "w-full text-left text-[11px] leading-tight px-1.5 py-0.5 rounded",
        "truncate cursor-pointer transition-opacity hover:opacity-80"
      )}
      style={{
        backgroundColor: `${color}20`,
        borderLeft: `3px solid ${color}`,
        color: color,
      }}
      title={event.title}
    >
      {!event.all_day && (
        <span className="font-medium mr-1 opacity-70">
          {formatTimeShort(event.start_time)}
        </span>
      )}
      <span className="font-medium">{event.title}</span>
    </button>
  );
}

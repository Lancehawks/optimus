"use client";

import { cn } from "@/lib/utils";
import { formatTimeShort } from "@/lib/calendarUtils";
import { getEventDisplayColor, getEventDisplayStatus, isEventStatusLit } from "@/lib/eventDisplay";

export default function EventPill({ event, onClick }) {
  const color = getEventDisplayColor(event);
  const displayStatus = getEventDisplayStatus(event);
  const litStatus = isEventStatusLit(event);

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
        boxShadow: litStatus ? `0 0 0 1px ${color}25, 0 0 14px ${color}18` : undefined,
      }}
      title={event.title}
    >
      {!event.all_day && (
        <span className="font-medium mr-1 opacity-70">
          {formatTimeShort(event.start_time)}
        </span>
      )}
      {(displayStatus === "done" || displayStatus === "missed") && (
        <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-current" />
      )}
      <span className="font-medium">{event.title}</span>
    </button>
  );
}

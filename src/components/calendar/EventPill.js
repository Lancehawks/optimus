"use client";
import { useAuth } from '@/context/AuthContext';
import { resolveTimeZone } from '@/lib/calendarTime';

import { cn } from "@/lib/utils";
import { formatTimeShort } from "@/lib/calendarUtils";
import { getEventDisplayColor, getEventDisplayStatus, isEventStatusLit } from "@/lib/eventDisplay";

export default function EventPill({ event, onClick }) {
  const { user } = useAuth();
  const timeZone = resolveTimeZone(user?.timezone);
  const color = getEventDisplayColor(event);
  const displayStatus = getEventDisplayStatus(event);
  const litStatus = isEventStatusLit(event);

  const done = displayStatus === "done";
  const missed = displayStatus === "missed";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(event);
      }}
      className={cn(
        "flex w-full cursor-pointer items-center gap-1.5 truncate rounded px-1.5 py-[3px] text-left text-2xs leading-tight transition-colors",
        event.all_day ? "text-heading" : "text-body hover:bg-surface-tertiary",
        done && "opacity-60"
      )}
      style={
        event.all_day
          ? { backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`, boxShadow: litStatus ? `inset 2px 0 0 ${color}` : undefined }
          : undefined
      }
      title={event.title}
    >
      {!event.all_day && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />}
      {!event.all_day && (
        <span className="shrink-0 font-mono text-3xs tabular-nums text-muted">{formatTimeShort(event.start_time, timeZone)}</span>
      )}
      <span className={cn("truncate font-medium", done && "line-through decoration-1", missed && "text-muted")}>{event.title}</span>
    </button>
  );
}

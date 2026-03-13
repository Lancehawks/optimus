"use client";

import { cn } from "@/lib/utils";
import { formatTimeShort } from "@/lib/calendarUtils";

export default function EventBlock({
  event,
  top,
  height,
  left,
  width,
  onClick,
}) {
  const color = event.calendar_color || "#6366f1";
  const isShort = height < 40;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(event);
      }}
      className={cn(
        "absolute rounded-md px-2 overflow-hidden cursor-pointer pointer-events-auto",
        "transition-all hover:brightness-110 hover:shadow-md",
        "text-left border-l-3"
      )}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        left: left || "0%",
        width: width || "100%",
        backgroundColor: `${color}cc`,
        borderLeftColor: color,
        zIndex: 10,
      }}
      title={`${event.title} (${formatTimeShort(event.start_time)} - ${formatTimeShort(event.end_time)})`}
    >
      {isShort ? (
        <div className="flex items-center gap-1 h-full">
          <span className="text-[11px] font-medium truncate text-white">
            {event.title}
          </span>
          <span className="text-[10px] text-white/70 shrink-0">
            {formatTimeShort(event.start_time)}
          </span>
        </div>
      ) : (
        <div className="py-1">
          <div className="text-xs font-medium truncate text-white">
            {event.title}
          </div>
          <div className="text-[10px] text-white/70 mt-0.5">
            {formatTimeShort(event.start_time)} –{" "}
            {formatTimeShort(event.end_time)}
          </div>
          {event.location && height > 60 && (
            <div className="text-[10px] text-white/50 mt-0.5 truncate">
              {event.location}
            </div>
          )}
          {event.linked_tasks?.length > 0 && height > 45 && (
            <div className="text-[10px] text-white/60 mt-0.5 flex items-center gap-1">
              <svg className="w-2.5 h-2.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="truncate">
                {event.linked_tasks.length === 1
                  ? event.linked_tasks[0].title
                  : `${event.linked_tasks.length} tasks`}
              </span>
            </div>
          )}
        </div>
      )}
    </button>
  );
}

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
        </div>
      )}
    </button>
  );
}

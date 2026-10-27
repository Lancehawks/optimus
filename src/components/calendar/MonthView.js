"use client";
import { useAuth } from '@/context/AuthContext';
import { resolveTimeZone } from '@/lib/calendarTime';

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { getMonthGrid, getEventsForDay, isSameDay, isToday } from "@/lib/calendarUtils";
import { getEventDisplayColor } from "@/lib/eventDisplay";
import EventPill from "./EventPill";

const DAY_HEADERS_FULL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_HEADERS_SHORT = ["S", "M", "T", "W", "T", "F", "S"];
const MAX_VISIBLE_EVENTS = 3;

export default function MonthView({
  currentDate,
  events,
  onDateClick,
  onEventClick,
}) {
  const { user } = useAuth();
  const timeZone = resolveTimeZone(user?.timezone);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const grid = useMemo(() => getMonthGrid(year, month), [year, month]);

  // Group events by day
  const eventsByDay = useMemo(() => {
    const map = new Map();
    for (const day of grid) {
      const key = day.toDateString();
      if (!map.has(key)) {
        map.set(key, getEventsForDay(events, day, timeZone));
      }
    }
    return map;
  }, [grid, events, timeZone]);

  const weeks = [];
  for (let i = 0; i < grid.length; i += 7) {
    weeks.push(grid.slice(i, i + 7));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid grid-cols-7 border-b border-border">
        {DAY_HEADERS_FULL.map((day, i) => (
          <div key={day} className="px-2 py-2 text-overline sm:px-3">
            <span className="hidden sm:inline">{day}</span>
            <span className="sm:hidden">{DAY_HEADERS_SHORT[i]}</span>
          </div>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-6">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid min-h-0 grid-cols-7 border-b border-border last:border-b-0">
            {week.map((day, dayIndex) => {
              const isCurrentMonth = day.getMonth() === month;
              const today = isToday(day, timeZone);
              const dayEvents = eventsByDay.get(day.toDateString()) || [];

              return (
                <div
                  key={dayIndex}
                  className={cn(
                    "group min-h-0 cursor-pointer overflow-hidden border-r border-border p-1 transition-colors last:border-r-0 sm:p-1.5",
                    isCurrentMonth ? "hover:bg-surface-secondary" : "bg-surface-secondary/70"
                  )}
                  onClick={() => onDateClick?.(day)}
                >
                  <div className="mb-1 flex justify-center sm:justify-start">
                    <span
                      className={cn(
                        "flex h-6 min-w-6 items-center justify-center rounded-full px-1 font-mono text-2xs tabular-nums",
                        today
                          ? "bg-brand-500 font-medium text-white"
                          : isCurrentMonth
                            ? "text-heading"
                            : "text-placeholder"
                      )}
                    >
                      {day.getDate() === 1 && !today ? (
                        <span>{day.toLocaleDateString("en-US", { month: "short" })} 1</span>
                      ) : (
                        day.getDate()
                      )}
                    </span>
                  </div>

                  <div className="hidden space-y-px overflow-hidden sm:block">
                    {dayEvents.slice(0, MAX_VISIBLE_EVENTS).map((event) => (
                      <EventPill key={event.id} event={event} onClick={onEventClick} />
                    ))}
                    {dayEvents.length > MAX_VISIBLE_EVENTS && (
                      <div className="px-1.5 font-mono text-3xs text-muted">+{dayEvents.length - MAX_VISIBLE_EVENTS} more</div>
                    )}
                  </div>

                  <div className="mt-0.5 flex justify-center gap-0.5 sm:hidden">
                    {dayEvents.slice(0, 3).map((event) => (
                      <div key={event.id} className="h-1 w-1 rounded-full" style={{ backgroundColor: getEventDisplayColor(event) }} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

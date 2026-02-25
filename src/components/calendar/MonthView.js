"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { getMonthGrid, getEventsForDay, isSameDay, isToday } from "@/lib/calendarUtils";
import EventPill from "./EventPill";

const DAY_HEADERS_FULL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_HEADERS_SHORT = ["S", "M", "T", "W", "T", "F", "S"];
const MAX_VISIBLE_EVENTS = 3;
const MAX_VISIBLE_EVENTS_MOBILE = 1;

export default function MonthView({
  currentDate,
  events,
  onDateClick,
  onEventClick,
}) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const grid = useMemo(() => getMonthGrid(year, month), [year, month]);

  // Group events by day
  const eventsByDay = useMemo(() => {
    const map = new Map();
    for (const day of grid) {
      const key = day.toDateString();
      if (!map.has(key)) {
        map.set(key, getEventsForDay(events, day));
      }
    }
    return map;
  }, [grid, events]);

  const weeks = [];
  for (let i = 0; i < grid.length; i += 7) {
    weeks.push(grid.slice(i, i + 7));
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border-light">
        {DAY_HEADERS_FULL.map((day, i) => (
          <div
            key={day}
            className="text-center text-caption font-medium py-2 text-muted"
          >
            <span className="hidden sm:inline">{day}</span>
            <span className="sm:hidden">{DAY_HEADERS_SHORT[i]}</span>
          </div>
        ))}
      </div>

      {/* Week rows */}
      <div className="grid grid-rows-6 flex-1 min-h-0">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 min-h-0 border-b border-border-light/50 last:border-b-0">
            {week.map((day, dayIndex) => {
              const isCurrentMonth = day.getMonth() === month;
              const today = isToday(day);
              const dayEvents = eventsByDay.get(day.toDateString()) || [];
              const hasEvents = dayEvents.length > 0;

              return (
                <div
                  key={dayIndex}
                  className={cn(
                    "border-r border-border-light/50 last:border-r-0 p-0.5 sm:p-1 min-h-0 overflow-hidden",
                    "cursor-pointer hover:bg-white/3 transition-colors",
                    !isCurrentMonth && "opacity-40"
                  )}
                  onClick={() => onDateClick?.(day)}
                >
                  {/* Date number */}
                  <div className="flex justify-center mb-0.5">
                    <span
                      className={cn(
                        "text-[10px] sm:text-xs w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full",
                        today
                          ? "bg-brand-500 text-white font-semibold"
                          : "text-muted font-medium"
                      )}
                    >
                      {day.getDate()}
                    </span>
                  </div>

                  {/* Event pills - desktop */}
                  <div className="hidden sm:block space-y-0.5 overflow-hidden">
                    {dayEvents.slice(0, MAX_VISIBLE_EVENTS).map((event) => (
                      <EventPill
                        key={event.id}
                        event={event}
                        onClick={onEventClick}
                      />
                    ))}
                    {dayEvents.length > MAX_VISIBLE_EVENTS && (
                      <div className="text-[10px] text-muted px-1.5 font-medium">
                        +{dayEvents.length - MAX_VISIBLE_EVENTS} more
                      </div>
                    )}
                  </div>

                  {/* Event dots - mobile */}
                  <div className="sm:hidden flex justify-center gap-0.5 mt-0.5">
                    {dayEvents.slice(0, 3).map((event) => (
                      <div
                        key={event.id}
                        className="w-1 h-1 rounded-full"
                        style={{ backgroundColor: event.calendar_color || "#6366f1" }}
                      />
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

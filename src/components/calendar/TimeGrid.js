"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  HOUR_HEIGHT,
  TOTAL_HOURS,
  getEventPosition,
  groupOverlappingEvents,
  getEventsForDay,
  isSameDay,
  isToday,
  formatTimeShort,
} from "@/lib/calendarUtils";
import EventBlock from "./EventBlock";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function formatHourLabel(hour) {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}

export default function TimeGrid({
  days,
  events,
  onTimeSlotClick,
  onEventClick,
}) {
  // Separate all-day events from timed events
  const { allDayEvents, timedEvents } = useMemo(() => {
    const allDay = [];
    const timed = [];
    for (const event of events) {
      if (event.all_day) {
        allDay.push(event);
      } else {
        timed.push(event);
      }
    }
    return { allDayEvents: allDay, timedEvents: timed };
  }, [events]);

  // Get current time position for the "now" indicator
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowTop = (nowMinutes / 60) * HOUR_HEIGHT;

  return (
    <div className="flex flex-col flex-1 min-w-0">
      {/* All-day events row */}
      {allDayEvents.length > 0 && (
        <div className="flex border-b border-border-light">
          {/* Time label column */}
          <div className="w-12 sm:w-16 shrink-0 px-1 sm:px-2 py-1 text-[9px] sm:text-[10px] text-muted text-right">
            all-day
          </div>
          {/* Day columns */}
          <div className="flex flex-1">
            {days.map((day, i) => {
              const dayAllDay = allDayEvents.filter((e) =>
                getEventsForDay([e], day).length > 0
              );
              return (
                <div
                  key={i}
                  className={cn(
                    "flex-1 min-w-0 border-l border-border-light p-0.5 sm:p-1",
                    "flex flex-col gap-0.5"
                  )}
                >
                  {dayAllDay.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => onEventClick?.(event)}
                      className="text-[10px] sm:text-[11px] font-medium truncate px-1 sm:px-1.5 py-0.5 rounded cursor-pointer hover:opacity-80"
                      style={{
                        backgroundColor: `${event.calendar_color || "#6366f1"}20`,
                        color: event.calendar_color || "#6366f1",
                        borderLeft: `3px solid ${event.calendar_color || "#6366f1"}`,
                      }}
                    >
                      {event.title}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Scrollable time grid */}
      <div className="flex flex-1 overflow-y-auto scrollbar-thin">
        {/* Time labels column */}
        <div className="w-12 sm:w-16 shrink-0 relative">
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="text-[9px] sm:text-[10px] text-muted text-right pr-1 sm:pr-2 relative"
              style={{ height: `${HOUR_HEIGHT}px` }}
            >
              <span className="absolute -top-2 right-1 sm:right-2">
                {formatHourLabel(hour)}
              </span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        <div className="flex flex-1 relative">
          {days.map((day, dayIndex) => {
            const dayEvents = getEventsForDay(timedEvents, day);
            const positioned = groupOverlappingEvents(dayEvents);
            const showNowLine = isToday(day);

            return (
              <div
                key={dayIndex}
                className="flex-1 min-w-0 border-l border-border-light relative"
                style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT}px` }}
              >
                {/* Hour gridlines */}
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="absolute w-full border-b border-border-light/50 cursor-pointer hover:bg-white/3"
                    style={{
                      top: `${hour * HOUR_HEIGHT}px`,
                      height: `${HOUR_HEIGHT}px`,
                    }}
                    onClick={() => {
                      const clickDate = new Date(day);
                      clickDate.setHours(hour, 0, 0, 0);
                      onTimeSlotClick?.(clickDate);
                    }}
                  />
                ))}

                {/* Half-hour lines */}
                {HOURS.map((hour) => (
                  <div
                    key={`half-${hour}`}
                    className="absolute w-full border-b border-border-light/20 pointer-events-none"
                    style={{
                      top: `${hour * HOUR_HEIGHT + HOUR_HEIGHT / 2}px`,
                    }}
                  />
                ))}

                {/* Current time indicator */}
                {showNowLine && (
                  <div
                    className="absolute w-full z-20 pointer-events-none"
                    style={{ top: `${nowTop}px` }}
                  >
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
                      <div className="flex-1 h-px bg-red-500" />
                    </div>
                  </div>
                )}

                {/* Event blocks */}
                <div className="absolute inset-0 px-0.5 pointer-events-none">
                  {positioned.map((event) => {
                    const pos = getEventPosition(event, day);
                    const colWidth = 100 / event.totalColumns;
                    return (
                      <EventBlock
                        key={event.id}
                        event={event}
                        top={pos.top}
                        height={pos.height}
                        left={`${event.columnIndex * colWidth}%`}
                        width={`${colWidth}%`}
                        onClick={onEventClick}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

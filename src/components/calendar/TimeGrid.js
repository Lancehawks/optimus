"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  HOUR_HEIGHT,
  COLLAPSE_START_HOUR,
  COLLAPSE_END_HOUR,
  COLLAPSED_HEIGHT,
  COLLAPSED_HOURS_COUNT,
  EXPANDED_SECTION_HEIGHT,
  getEventPosition,
  getGridHeight,
  getTimeToPixel,
  groupOverlappingEvents,
  getEventsForDay,
  isSameDay,
  isToday,
  formatTimeShort,
} from "@/lib/calendarUtils";
import EventBlock from "./EventBlock";

// Hours before and after the collapsed section
const HOURS_BEFORE = Array.from({ length: COLLAPSE_START_HOUR }, (_, i) => i); // [0]
const HOURS_AFTER = Array.from(
  { length: 24 - COLLAPSE_END_HOUR },
  (_, i) => i + COLLAPSE_END_HOUR
); // [7..23]
const HOURS_COLLAPSED = Array.from(
  { length: COLLAPSED_HOURS_COUNT },
  (_, i) => i + COLLAPSE_START_HOUR
); // [1..6]

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
  const [earlyHoursCollapsed, setEarlyHoursCollapsed] = useState(true);
  const scrollRef = useRef(null);
  const hasScrolled = useRef(false);

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
  const nowTop = getTimeToPixel(nowMinutes, earlyHoursCollapsed);

  const gridHeight = getGridHeight(earlyHoursCollapsed);
  const savedSpace = EXPANDED_SECTION_HEIGHT - COLLAPSED_HEIGHT;

  // Auto-scroll to ~7 AM on mount
  useEffect(() => {
    if (scrollRef.current && !hasScrolled.current) {
      hasScrolled.current = true;
      const target = getTimeToPixel(COLLAPSE_END_HOUR * 60, earlyHoursCollapsed);
      scrollRef.current.scrollTop = target - 20;
    }
  }, []);

  function toggleCollapse() {
    const container = scrollRef.current;
    if (container) {
      const currentScroll = container.scrollTop;
      const collapseBarTop = COLLAPSE_START_HOUR * HOUR_HEIGHT;

      if (earlyHoursCollapsed) {
        // Expanding — shift scroll down if past the collapsed section
        if (currentScroll > collapseBarTop + COLLAPSED_HEIGHT) {
          container.scrollTop = currentScroll + savedSpace;
        }
      } else {
        // Collapsing — shift scroll up
        if (currentScroll > collapseBarTop + EXPANDED_SECTION_HEIGHT) {
          container.scrollTop = currentScroll - savedSpace;
        } else if (currentScroll > collapseBarTop) {
          container.scrollTop = collapseBarTop;
        }
      }
    }
    setEarlyHoursCollapsed(!earlyHoursCollapsed);
  }

  // Count events in the collapsed time range for a given day
  function getEarlyEventCount(dayEvents) {
    const collapseStartMin = COLLAPSE_START_HOUR * 60;
    const collapseEndMin = COLLAPSE_END_HOUR * 60;
    return dayEvents.filter((e) => {
      const start = new Date(e.start_time);
      const end = new Date(e.end_time);
      const startMin = start.getHours() * 60 + start.getMinutes();
      const endMin = end.getHours() * 60 + end.getMinutes();
      // Event is fully inside the collapsed range
      return startMin >= collapseStartMin && endMin <= collapseEndMin;
    }).length;
  }

  // Check if an event is fully inside the collapsed range
  function isEventInCollapsedRange(event) {
    const start = new Date(event.start_time);
    const end = new Date(event.end_time);
    const startMin = start.getHours() * 60 + start.getMinutes();
    const endMin = end.getHours() * 60 + end.getMinutes();
    return (
      startMin >= COLLAPSE_START_HOUR * 60 && endMin <= COLLAPSE_END_HOUR * 60
    );
  }

  // Render hour label at the correct position
  function renderHourLabel(hour) {
    const top = getTimeToPixel(hour * 60, earlyHoursCollapsed);
    return (
      <div
        key={hour}
        className="absolute w-full text-[9px] sm:text-[10px] text-muted text-right pr-1 sm:pr-2"
        style={{ top: `${top}px`, height: `${HOUR_HEIGHT}px` }}
      >
        <span className="absolute -top-2 right-1 sm:right-2">
          {formatHourLabel(hour)}
        </span>
      </div>
    );
  }

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
              const dayAllDay = allDayEvents.filter(
                (e) => getEventsForDay([e], day).length > 0
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
      <div ref={scrollRef} className="flex flex-1 overflow-y-auto scrollbar-thin">
        {/* Time labels column */}
        <div className="w-12 sm:w-16 shrink-0 relative" style={{ height: `${gridHeight}px` }}>
          {/* Hours before collapsed section */}
          {HOURS_BEFORE.map((hour) => renderHourLabel(hour))}

          {/* Collapsed bar or expanded hours */}
          {earlyHoursCollapsed ? (
            <button
              type="button"
              onClick={toggleCollapse}
              className="absolute w-full flex items-center justify-end pr-1 sm:pr-2 text-[9px] text-muted hover:text-body hover:bg-surface-tertiary/50 transition-colors cursor-pointer"
              style={{
                top: `${COLLAPSE_START_HOUR * HOUR_HEIGHT}px`,
                height: `${COLLAPSED_HEIGHT}px`,
              }}
            >
              <span className="flex items-center gap-1">
                <span className="hidden sm:inline">1–7 AM</span>
                <span className="sm:hidden">1–7</span>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </span>
            </button>
          ) : (
            <>
              {HOURS_COLLAPSED.map((hour) => renderHourLabel(hour))}
              <button
                type="button"
                onClick={toggleCollapse}
                className="absolute right-1 sm:right-2 text-[9px] text-muted hover:text-body cursor-pointer z-10"
                style={{ top: `${COLLAPSE_START_HOUR * HOUR_HEIGHT + 2}px` }}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                </svg>
              </button>
            </>
          )}

          {/* Hours after collapsed section */}
          {HOURS_AFTER.map((hour) => renderHourLabel(hour))}
        </div>

        {/* Day columns */}
        <div className="flex flex-1 relative">
          {days.map((day, dayIndex) => {
            const dayEvents = getEventsForDay(timedEvents, day);
            const positioned = groupOverlappingEvents(dayEvents);
            const showNowLine = isToday(day);
            const earlyEventCount = earlyHoursCollapsed
              ? getEarlyEventCount(dayEvents)
              : 0;

            return (
              <div
                key={dayIndex}
                className="flex-1 min-w-0 border-l border-border-light relative"
                style={{ height: `${gridHeight}px` }}
              >
                {/* Hour gridlines — before collapsed section */}
                {HOURS_BEFORE.map((hour) => {
                  const top = getTimeToPixel(hour * 60, earlyHoursCollapsed);
                  return (
                    <div
                      key={hour}
                      className="absolute w-full border-b border-border-light/50 cursor-pointer hover:bg-white/3"
                      style={{ top: `${top}px`, height: `${HOUR_HEIGHT}px` }}
                      onClick={() => {
                        const clickDate = new Date(day);
                        clickDate.setHours(hour, 0, 0, 0);
                        onTimeSlotClick?.(clickDate);
                      }}
                    />
                  );
                })}

                {/* Collapsed bar or expanded gridlines */}
                {earlyHoursCollapsed ? (
                  <div
                    className="absolute w-full border-b border-dashed border-border-light/40 bg-surface-secondary/20 cursor-pointer hover:bg-surface-tertiary/30 transition-colors flex items-center justify-center"
                    style={{
                      top: `${COLLAPSE_START_HOUR * HOUR_HEIGHT}px`,
                      height: `${COLLAPSED_HEIGHT}px`,
                    }}
                    onClick={toggleCollapse}
                  >
                    {earlyEventCount > 0 && (
                      <span className="text-[9px] text-brand-400 font-medium">
                        {earlyEventCount} event{earlyEventCount > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                ) : (
                  HOURS_COLLAPSED.map((hour) => {
                    const top = getTimeToPixel(hour * 60, earlyHoursCollapsed);
                    return (
                      <div
                        key={hour}
                        className="absolute w-full border-b border-border-light/50 cursor-pointer hover:bg-white/3"
                        style={{ top: `${top}px`, height: `${HOUR_HEIGHT}px` }}
                        onClick={() => {
                          const clickDate = new Date(day);
                          clickDate.setHours(hour, 0, 0, 0);
                          onTimeSlotClick?.(clickDate);
                        }}
                      />
                    );
                  })
                )}

                {/* Hour gridlines — after collapsed section */}
                {HOURS_AFTER.map((hour) => {
                  const top = getTimeToPixel(hour * 60, earlyHoursCollapsed);
                  return (
                    <div
                      key={hour}
                      className="absolute w-full border-b border-border-light/50 cursor-pointer hover:bg-white/3"
                      style={{ top: `${top}px`, height: `${HOUR_HEIGHT}px` }}
                      onClick={() => {
                        const clickDate = new Date(day);
                        clickDate.setHours(hour, 0, 0, 0);
                        onTimeSlotClick?.(clickDate);
                      }}
                    />
                  );
                })}

                {/* Half-hour lines */}
                {(earlyHoursCollapsed
                  ? [...HOURS_BEFORE, ...HOURS_AFTER]
                  : [...HOURS_BEFORE, ...HOURS_COLLAPSED, ...HOURS_AFTER]
                ).map((hour) => {
                  const top = getTimeToPixel(hour * 60 + 30, earlyHoursCollapsed);
                  return (
                    <div
                      key={`half-${hour}`}
                      className="absolute w-full border-b border-border-light/20 pointer-events-none"
                      style={{ top: `${top}px` }}
                    />
                  );
                })}

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
                  {positioned
                    .filter(
                      (event) =>
                        !earlyHoursCollapsed || !isEventInCollapsedRange(event)
                    )
                    .map((event) => {
                      const pos = getEventPosition(
                        event,
                        day,
                        earlyHoursCollapsed
                      );
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

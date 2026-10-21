"use client";
import { useAuth } from '@/context/AuthContext';
import { resolveTimeZone, wallDate } from '@/lib/calendarTime';

import { useMemo, useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
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
import { getEventDisplayColor, isEventStatusLit } from "@/lib/eventDisplay";
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
  onTaskDrop,
}) {
  const { user } = useAuth();
  const timeZone = resolveTimeZone(user?.timezone);
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
  const now = wallDate(new Date(), timeZone);
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
  }, [earlyHoursCollapsed]);

  function toggleCollapse() {
    const container = scrollRef.current;
    if (container) {
      const currentScroll = container.scrollTop;
      const collapseBarTop = COLLAPSE_START_HOUR * HOUR_HEIGHT;

      if (earlyHoursCollapsed) {
        // Expanding - shift scroll down if past the collapsed section
        if (currentScroll > collapseBarTop + COLLAPSED_HEIGHT) {
          container.scrollTop = currentScroll + savedSpace;
        }
      } else {
        // Collapsing - shift scroll up
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
      const start = wallDate(e.start_time, timeZone);
      const end = wallDate(e.end_time, timeZone);
      const startMin = start.getHours() * 60 + start.getMinutes();
      const endMin = end.getHours() * 60 + end.getMinutes();
      // Event is fully inside the collapsed range
      return isSameDay(start, end) && startMin >= collapseStartMin && startMin < collapseEndMin && endMin > startMin && endMin <= collapseEndMin;
    }).length;
  }

  // Check if an event is fully inside the collapsed range
  function isEventInCollapsedRange(event) {
    const start = wallDate(event.start_time, timeZone);
    const end = wallDate(event.end_time, timeZone);
    const startMin = start.getHours() * 60 + start.getMinutes();
    const endMin = end.getHours() * 60 + end.getMinutes();
    return (
      isSameDay(start, end) && startMin >= COLLAPSE_START_HOUR * 60 && startMin < COLLAPSE_END_HOUR * 60 && endMin > startMin && endMin <= COLLAPSE_END_HOUR * 60
    );
  }

  function getDraggedTask(event) {
    const raw = event.dataTransfer?.getData("application/x-optimus-task");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function allowTaskDrop(event) {
    if ([...(event.dataTransfer?.types || [])].includes("application/x-optimus-task")) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    }
  }

  function handleTaskDrop(event, day, hour) {
    const task = getDraggedTask(event);
    if (!task) return;
    event.preventDefault();
    const start = new Date(day);
    start.setHours(hour, 0, 0, 0);
    onTaskDrop?.(task, start);
  }

  // Render hour label at the correct position
  function renderHourLabel(hour) {
    const top = getTimeToPixel(hour * 60, earlyHoursCollapsed);
    return (
      <div
        key={hour}
        className="absolute w-full pr-1.5 text-right font-mono text-[0.625rem] tabular-nums text-muted sm:pr-2.5"
        style={{ top: `${top}px`, height: `${HOUR_HEIGHT}px` }}
      >
        <span className="absolute -top-2 right-1 sm:right-2">
          {formatHourLabel(hour)}
        </span>
      </div>
    );
  }

  function renderAllDayEvent(event) {
    const color = getEventDisplayColor(event);
    const litStatus = isEventStatusLit(event);
    return (
      <button
        key={event.id}
        type="button"
        onClick={() => onEventClick?.(event)}
        className="cursor-pointer truncate rounded px-1.5 py-[3px] text-left text-[0.6875rem] font-medium text-heading transition-opacity hover:opacity-80"
        style={{
          backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`,
          boxShadow: litStatus ? `inset 2px 0 0 ${color}` : undefined,
        }}
      >
        {event.title}
      </button>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-w-0">
      {/* All-day events row */}
      {allDayEvents.length > 0 && (
        <div className="flex border-b border-border">
          {/* Time label column */}
          <div className="w-12 shrink-0 py-1.5 pr-1.5 text-right font-mono text-[0.625rem] text-muted sm:w-16 sm:pr-2.5">
            all-day
          </div>
          {/* Day columns */}
          <div className="flex flex-1">
            {days.map((day, i) => {
              const dayAllDay = allDayEvents.filter(
                (e) => getEventsForDay([e], day, timeZone).length > 0
              );
              return (
                <div
                  key={i}
                  className={cn(
                    "flex-1 min-w-0 border-l border-border p-0.5 sm:p-1",
                    "flex flex-col gap-0.5"
                  )}
                >
                  {dayAllDay.map(renderAllDayEvent)}
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
              className="absolute flex w-full cursor-pointer items-center justify-end pr-1.5 font-mono text-[0.625rem] text-muted transition-colors hover:bg-surface-secondary hover:text-heading sm:pr-2.5"
              style={{
                top: `${COLLAPSE_START_HOUR * HOUR_HEIGHT}px`,
                height: `${COLLAPSED_HEIGHT}px`,
              }}
            >
              <span className="flex items-center gap-1">
                <span className="hidden sm:inline">1-7 AM</span>
                <span className="sm:hidden">1-7</span>
                <ChevronDown className="h-3 w-3" />
              </span>
            </button>
          ) : (
            <>
              {HOURS_COLLAPSED.map((hour) => renderHourLabel(hour))}
              <button
                type="button"
                onClick={toggleCollapse}
                className="absolute right-1.5 z-10 cursor-pointer text-muted hover:text-heading sm:right-2.5"
                aria-label="Collapse early hours"
                style={{ top: `${COLLAPSE_START_HOUR * HOUR_HEIGHT + 2}px` }}
              >
                <ChevronUp className="h-3 w-3" />
              </button>
            </>
          )}

          {/* Hours after collapsed section */}
          {HOURS_AFTER.map((hour) => renderHourLabel(hour))}
        </div>

        {/* Day columns */}
        <div className="flex flex-1 relative">
          {days.map((day, dayIndex) => {
            const dayEvents = getEventsForDay(timedEvents, day, timeZone);
            const positioned = groupOverlappingEvents(dayEvents);
            const showNowLine = isToday(day, timeZone);
            const earlyEventCount = earlyHoursCollapsed
              ? getEarlyEventCount(dayEvents)
              : 0;

            return (
              <div
                key={dayIndex}
                className="relative min-w-0 flex-1 border-l border-border"
                style={{ height: `${gridHeight}px` }}
              >
                {/* Hour gridlines - before collapsed section */}
                {HOURS_BEFORE.map((hour) => {
                  const top = getTimeToPixel(hour * 60, earlyHoursCollapsed);
                  return (
                    <div
                      key={hour}
                      className="absolute w-full cursor-pointer border-b border-border transition-colors hover:bg-surface-secondary"
                      style={{ top: `${top}px`, height: `${HOUR_HEIGHT}px` }}
                      onDragOver={allowTaskDrop}
                      onDrop={(event) => handleTaskDrop(event, day, hour)}
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
                    className="absolute flex w-full cursor-pointer items-center justify-center border-b border-dashed border-border bg-surface-secondary transition-colors hover:bg-surface-tertiary"
                    style={{
                      top: `${COLLAPSE_START_HOUR * HOUR_HEIGHT}px`,
                      height: `${COLLAPSED_HEIGHT}px`,
                    }}
                    onClick={toggleCollapse}
                  >
                    {earlyEventCount > 0 && (
                      <span className="font-mono text-[0.625rem] text-muted">
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
                        className="absolute w-full cursor-pointer border-b border-border transition-colors hover:bg-surface-secondary"
                        style={{ top: `${top}px`, height: `${HOUR_HEIGHT}px` }}
                        onDragOver={allowTaskDrop}
                        onDrop={(event) => handleTaskDrop(event, day, hour)}
                        onClick={() => {
                          const clickDate = new Date(day);
                          clickDate.setHours(hour, 0, 0, 0);
                          onTimeSlotClick?.(clickDate);
                        }}
                      />
                    );
                  })
                )}

                {/* Hour gridlines - after collapsed section */}
                {HOURS_AFTER.map((hour) => {
                  const top = getTimeToPixel(hour * 60, earlyHoursCollapsed);
                  return (
                    <div
                      key={hour}
                      className="absolute w-full cursor-pointer border-b border-border transition-colors hover:bg-surface-secondary"
                      style={{ top: `${top}px`, height: `${HOUR_HEIGHT}px` }}
                      onDragOver={allowTaskDrop}
                      onDrop={(event) => handleTaskDrop(event, day, hour)}
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
                      className="pointer-events-none absolute w-full border-b border-dashed border-border-light"
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
                      <div className="-ml-[3.5px] h-[7px] w-[7px] rounded-full bg-brand-500" />
                      <div className="h-px flex-1 bg-brand-500" />
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
                        earlyHoursCollapsed, timeZone
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

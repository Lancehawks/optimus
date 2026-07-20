"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useCalendars, useEvents } from "@/hooks/useCalendar";
import { getEventDisplayColor } from "@/lib/eventDisplay";

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-2.5">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-9 rounded-lg bg-neutral-700/50 animate-pulse" />
      ))}
    </div>
  );
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function isAllDay(event) {
  // All-day events typically have start_time at midnight and span full days
  const s = new Date(event.start_time);
  const e = new Date(event.end_time);
  return s.getHours() === 0 && s.getMinutes() === 0 && e.getHours() === 0 && e.getMinutes() === 0;
}

export default function UpcomingEventsWidget() {
  const router = useRouter();

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const todayEnd = useMemo(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  }, []);

  const { calendars, isLoading: calsLoading } = useCalendars();
  const { events, isLoading: eventsLoading } = useEvents(todayStart, todayEnd, null);

  const isLoading = calsLoading || eventsLoading;

  // Build a calendar color map
  const calMap = useMemo(() => {
    const m = new Map();
    calendars.forEach((c) => m.set(c.id, c.color));
    return m;
  }, [calendars]);

  // Sort by start time
  const sortedEvents = useMemo(() => {
    return [...events].sort(
      (a, b) => new Date(a.start_time) - new Date(b.start_time)
    );
  }, [events]);

  const displayEvents = sortedEvents.slice(0, 6);
  const extraCount = sortedEvents.length - 6;

  return (
    <div className="card p-5 flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10">
            <svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
          </div>
          <h3 className="text-h4">Today&apos;s Schedule</h3>
        </div>
        {!isLoading && sortedEvents.length > 0 && (
          <span className="text-caption text-muted">{sortedEvents.length} event{sortedEvents.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <SkeletonRows />
      ) : displayEvents.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-6 text-center">
          <p className="text-body-sm text-heading font-medium">Nothing scheduled</p>
          <p className="text-caption text-muted mt-1">Your day is wide open</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {displayEvents.map((event) => {
            const color = getEventDisplayColor(event, calMap.get(event.calendar_id) || "#0d6b88");
            const allDay = isAllDay(event);

            return (
              <li
                key={event.id}
                className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-neutral-700/40 transition-colors"
              >
                {/* Calendar color dot */}
                <span
                  className="shrink-0 h-2 w-2 rounded-full"
                  style={{ backgroundColor: color }}
                />

                {/* Time */}
                <span className="shrink-0 text-caption text-muted w-[52px]">
                  {allDay ? "All day" : formatTime(event.start_time)}
                </span>

                {/* Title */}
                <span className="flex-1 text-body-sm text-heading truncate">
                  {event.title}
                </span>
              </li>
            );
          })}
          {extraCount > 0 && (
            <li className="text-caption text-muted px-2 py-1">
              +{extraCount} more event{extraCount !== 1 ? "s" : ""}
            </li>
          )}
        </ul>
      )}

      {/* Footer */}
      <button
        onClick={() => router.push("/calendar")}
        className="text-caption text-brand-400 hover:text-brand-300 transition-colors text-left mt-auto cursor-pointer"
      >
        View calendar →
      </button>
    </div>
  );
}

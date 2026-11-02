"use client";
import { useAuth } from '@/context/AuthContext';
import { resolveTimeZone } from '@/lib/calendarTime';

import { useMemo } from "react";
import { isToday } from "@/lib/calendarUtils";
import TimeGrid from "./TimeGrid";

const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday",
];
const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function DayView({
  currentDate,
  events,
  onTimeSlotClick,
  onEventClick,
  onTaskDrop,
}) {
  const { user } = useAuth();
  const timeZone = resolveTimeZone(user?.timezone);
  const days = useMemo(() => [new Date(currentDate)], [currentDate]);
  const today = isToday(currentDate, timeZone);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Day header */}
      <div className="flex shrink-0 border-b border-border">
        <div className="w-12 shrink-0 sm:w-16" />
        <div className="flex flex-1 items-center gap-2 border-l border-border px-3 py-2 sm:px-4">
          <span className="text-overline">{DAY_NAMES[currentDate.getDay()]}</span>
          <span
            className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 font-mono text-xs tabular-nums ${today ? "bg-brand-500 font-medium text-white" : "text-heading"}`}
          >
            {currentDate.getDate()}
          </span>
          <span className="hidden text-xs text-muted sm:inline">{MONTHS[currentDate.getMonth()]}</span>
        </div>
      </div>

      {/* Time grid */}
      <TimeGrid
        days={days}
        events={events}
        onTimeSlotClick={onTimeSlotClick}
        onEventClick={onEventClick}
        onTaskDrop={onTaskDrop}
      />
    </div>
  );
}

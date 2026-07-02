"use client";

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
  const days = useMemo(() => [new Date(currentDate)], [currentDate]);
  const today = isToday(currentDate);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Day header */}
      <div className="flex border-b border-border-light shrink-0">
        <div className="w-12 sm:w-16 shrink-0" />
        <div className="flex-1 py-2 sm:py-3 px-3 sm:px-4 border-l border-border-light">
          <span className={`text-sm sm:text-lg font-semibold ${today ? "text-brand-400" : "text-heading"}`}>
            <span className="hidden sm:inline">
              {DAY_NAMES[currentDate.getDay()]}, {MONTHS[currentDate.getMonth()]} {currentDate.getDate()}
            </span>
            <span className="sm:hidden">
              {DAY_NAMES_SHORT[currentDate.getDay()]}, {MONTHS_SHORT[currentDate.getMonth()]} {currentDate.getDate()}
            </span>
          </span>
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

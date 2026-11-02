"use client";
import { useAuth } from '@/context/AuthContext';
import { resolveTimeZone } from '@/lib/calendarTime';

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { getWeekDates, isToday } from "@/lib/calendarUtils";
import TimeGrid from "./TimeGrid";

const DAY_NAMES_FULL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES_SHORT = ["S", "M", "T", "W", "T", "F", "S"];

export default function WeekView({
  currentDate,
  events,
  onTimeSlotClick,
  onEventClick,
  onTaskDrop,
}) {
  const { user } = useAuth();
  const timeZone = resolveTimeZone(user?.timezone);
  const days = useMemo(() => getWeekDates(currentDate), [currentDate]);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-x-auto">
      <div className="flex min-w-[32rem] flex-1 flex-col">
        {/* Day headers */}
        <div className="flex shrink-0 border-b border-border">
          <div className="w-12 shrink-0 sm:w-16" />
          {days.map((day, i) => {
            const today = isToday(day, timeZone);
            return (
              <div key={i} className="flex flex-1 items-center gap-2 border-l border-border px-2 py-2 sm:px-3">
                <span className="text-overline">
                  <span className="hidden sm:inline">{DAY_NAMES_FULL[day.getDay()]}</span>
                  <span className="sm:hidden">{DAY_NAMES_SHORT[day.getDay()]}</span>
                </span>
                <span
                  className={cn(
                    "flex h-6 min-w-6 items-center justify-center rounded-full px-1 font-mono text-xs tabular-nums",
                    today ? "bg-brand-500 font-medium text-white" : "text-heading"
                  )}
                >
                  {day.getDate()}
                </span>
              </div>
            );
          })}
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
    </div>
  );
}

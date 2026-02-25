"use client";

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
}) {
  const days = useMemo(() => getWeekDates(currentDate), [currentDate]);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-x-auto">
      <div className="flex flex-col flex-1 min-w-125">
        {/* Day headers */}
        <div className="flex border-b border-border-light shrink-0">
          {/* Spacer for time label column */}
          <div className="w-12 sm:w-16 shrink-0" />
          {days.map((day, i) => {
            const today = isToday(day);
            return (
              <div
                key={i}
                className={cn(
                  "flex-1 text-center py-1.5 sm:py-2 border-l border-border-light",
                  today && "bg-brand-500/5"
                )}
              >
                <div className="text-[9px] sm:text-[10px] text-muted uppercase tracking-wider">
                  <span className="hidden sm:inline">{DAY_NAMES_FULL[day.getDay()]}</span>
                  <span className="sm:hidden">{DAY_NAMES_SHORT[day.getDay()]}</span>
                </div>
                <div
                  className={cn(
                    "text-sm sm:text-lg font-semibold mt-0.5",
                    today ? "text-brand-400" : "text-heading"
                  )}
                >
                  {day.getDate()}
                </div>
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
        />
      </div>
    </div>
  );
}

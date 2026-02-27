"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getWeekDays() {
  const today = new Date();
  const dow = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dow + 6) % 7)); // shift to Monday

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export default function WeeklyGrid({ habits, onToggle }) {
  const weekDays = useMemo(() => getWeekDays(), []);
  const todayStr = useMemo(() => toDateStr(new Date()), []);

  if (habits.length === 0) {
    return (
      <div className="card p-8 text-center text-muted text-body-sm">
        No habits to display
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {/* Header row */}
      <div
        className="grid border-b border-border bg-surface-secondary"
        style={{ gridTemplateColumns: `1fr repeat(7, 48px)` }}
      >
        <div className="px-4 py-3 text-caption text-muted font-medium">Habit</div>
        {weekDays.map((day, i) => {
          const dateStr = toDateStr(day);
          const isToday = dateStr === todayStr;
          return (
            <div
              key={dateStr}
              className={cn(
                "text-center py-3",
                isToday ? "text-brand-400" : "text-muted"
              )}
            >
              <div className="text-[0.65rem] font-semibold">{DAY_SHORT[i]}</div>
              <div
                className={cn(
                  "text-[0.6rem] mt-0.5 font-medium",
                  isToday
                    ? "h-4 w-4 rounded-full bg-brand-500/20 flex items-center justify-center mx-auto"
                    : ""
                )}
              >
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Habit rows */}
      {habits.map((habit, habitIndex) => {
        const completedSet = new Set(habit.last_7_dates || []);

        return (
          <div
            key={habit.id}
            className={cn(
              "grid items-center hover:bg-surface-secondary/50 transition-colors",
              habitIndex < habits.length - 1 && "border-b border-border"
            )}
            style={{ gridTemplateColumns: `1fr repeat(7, 48px)` }}
          >
            {/* Habit name */}
            <div className="px-4 py-3 flex items-center gap-2 min-w-0">
              <div
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: habit.color }}
              />
              <span className="text-body-sm truncate">{habit.name}</span>
            </div>

            {/* Day cells */}
            {weekDays.map((day) => {
              const dateStr = toDateStr(day);
              const isFuture = dateStr > todayStr;
              const isCompleted = completedSet.has(dateStr);

              return (
                <div key={dateStr} className="flex items-center justify-center py-2">
                  <button
                    disabled={isFuture}
                    onClick={() => !isFuture && onToggle?.(habit, dateStr)}
                    className={cn(
                      "h-7 w-7 rounded-full border-2 transition-all flex items-center justify-center",
                      isFuture
                        ? "border-border opacity-20 cursor-default"
                        : "cursor-pointer hover:scale-110"
                    )}
                    style={
                      !isFuture
                        ? {
                            borderColor: isCompleted ? habit.color : habit.color + "40",
                            backgroundColor: isCompleted ? habit.color : "transparent",
                          }
                        : undefined
                    }
                    title={isFuture ? undefined : isCompleted ? "Mark incomplete" : "Mark complete"}
                  >
                    {isCompleted && (
                      <svg
                        className="h-3.5 w-3.5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2.5}
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

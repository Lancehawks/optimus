"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatMonthYear(date) {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function HabitCalendar({ logs, color, habitId, onToggleDate }) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const completedSet = useMemo(() => {
    const set = new Set();
    if (logs) {
      logs.forEach((log) => {
        if (log.completed) {
          const d = new Date(log.log_date);
          set.add(toDateString(d));
        }
      });
    }
    return set;
  }, [logs]);

  const todayStr = toDateString(new Date());

  const prevMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    );
  };

  const nextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
    );
  };

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    let startDow = firstDay.getDay();
    startDow = startDow === 0 ? 6 : startDow - 1;

    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells = [];

    for (let i = 0; i < startDow; i++) {
      cells.push(null);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(new Date(year, month, d));
    }

    while (cells.length < 42) {
      cells.push(null);
    }

    return cells;
  }, [currentMonth]);

  return (
    <div>
      {/* Navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={prevMonth}
          className="btn-ghost rounded-lg p-1.5 cursor-pointer"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5L8.25 12l7.5-7.5"
            />
          </svg>
        </button>
        <span className="text-body-sm text-heading! font-medium">
          {formatMonthYear(currentMonth)}
        </span>
        <button
          onClick={nextMonth}
          className="btn-ghost rounded-lg p-1.5 cursor-pointer"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.25 4.5l7.5 7.5-7.5 7.5"
            />
          </svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_LABELS.map((label) => (
          <div
            key={label}
            className="text-center text-[0.65rem] text-muted font-medium py-1"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((date, index) => {
          if (!date) {
            return <div key={`empty-${index}`} className="h-8" />;
          }

          const dateStr = toDateString(date);
          const isCompleted = completedSet.has(dateStr);
          const isToday = dateStr === todayStr;
          const isFuture = dateStr > todayStr;

          return (
            <button
              key={dateStr}
              className={cn(
                "h-8 w-full rounded-md text-xs flex items-center justify-center cursor-pointer transition-colors",
                isFuture && "text-neutral-600 cursor-default",
                isToday && !isCompleted && "ring-1 ring-brand-500",
                !isCompleted && !isFuture && "hover:bg-surface-tertiary"
              )}
              style={
                isCompleted
                  ? {
                      backgroundColor: `${color}20`,
                      borderBottom: `2px solid ${color}`,
                      color: color,
                      fontWeight: 600,
                    }
                  : undefined
              }
              onClick={() => {
                if (!isFuture && onToggleDate) {
                  onToggleDate(habitId, dateStr);
                }
              }}
              disabled={isFuture}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

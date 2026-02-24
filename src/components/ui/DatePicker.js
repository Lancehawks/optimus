"use client";

import { useState, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import { useClickOutside } from "@/hooks/useClickOutside";
import { useKeyboard } from "@/hooks/useKeyboard";

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

function isSameDay(a, b) {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isToday(date) {
  return isSameDay(date, new Date());
}

export default function DatePicker({
  value,
  onChange,
  placeholder = "Select date",
  minDate,
  maxDate,
  label,
  error,
  className,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  const initial = value ? new Date(value) : new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  useClickOutside(ref, () => setIsOpen(false), isOpen);
  useKeyboard({ Escape: () => setIsOpen(false) }, isOpen);

  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
    const days = [];

    // Empty slots before first day
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(viewYear, viewMonth, d));
    }

    return days;
  }, [viewYear, viewMonth]);

  function goToPrevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }

  function goToNextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  }

  function selectDate(date) {
    onChange?.(date);
    setIsOpen(false);
  }

  function isDisabled(date) {
    if (!date) return true;
    if (minDate && date < new Date(new Date(minDate).setHours(0, 0, 0, 0))) return true;
    if (maxDate && date > new Date(new Date(maxDate).setHours(23, 59, 59, 999))) return true;
    return false;
  }

  const selectedDate = value ? new Date(value) : null;

  return (
    <div ref={ref} className={cn("relative w-full", className)}>
      {label && (
        <label className="text-body-sm text-heading! font-medium block mb-1.5">
          {label}
        </label>
      )}

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "input-base flex items-center justify-between text-left cursor-pointer",
          !value && "text-placeholder",
          isOpen && "input-focus",
          error && "border-danger!"
        )}
      >
        <span>{value ? formatDate(value) : placeholder}</span>
        <svg
          className="h-4 w-4 text-muted shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
          />
        </svg>
      </button>

      {error && <p className="text-caption text-danger! mt-1.5">{error}</p>}

      {/* Calendar dropdown */}
      {isOpen && (
        <div className="absolute z-40 mt-1.5 w-full min-w-70 rounded-xl bg-surface border border-border shadow-dropdown animate-slide-down p-3">
          {/* Month/year navigation */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={goToPrevMonth}
              className="btn-ghost rounded-lg p-1.5 cursor-pointer"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <span className="text-body-sm text-heading! font-medium">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={goToNextMonth}
              className="btn-ghost rounded-lg p-1.5 cursor-pointer"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((day) => (
              <div
                key={day}
                className="text-center text-caption font-medium py-1"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((date, i) => {
              if (!date) {
                return <div key={`empty-${i}`} />;
              }

              const disabled = isDisabled(date);
              const selected = isSameDay(date, selectedDate);
              const today = isToday(date);

              return (
                <button
                  key={i}
                  type="button"
                  disabled={disabled}
                  onClick={() => selectDate(date)}
                  className={cn(
                    "h-9 w-full rounded-lg text-body-sm transition-colors cursor-pointer",
                    disabled && "text-disabled! cursor-not-allowed",
                    selected && "bg-brand-500 text-white! font-medium",
                    !selected && !disabled && "hover:bg-surface-tertiary",
                    today && !selected && "text-brand-400! font-semibold"
                  )}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          {/* Today shortcut */}
          <div className="mt-2 pt-2 border-t border-border-light">
            <button
              type="button"
              onClick={() => selectDate(new Date())}
              className="w-full text-center text-caption text-brand-500! hover:text-brand-600! font-medium py-1 cursor-pointer"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

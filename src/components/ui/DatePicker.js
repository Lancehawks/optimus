"use client";

import { useState, useRef, useMemo } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { FieldLabel } from "./Field";
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
      <FieldLabel>{label}</FieldLabel>

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "input-base flex cursor-pointer items-center justify-between text-left",
          !value && "text-placeholder",
          isOpen && "input-focus",
          error && "border-danger!"
        )}
      >
        <span>{value ? formatDate(value) : placeholder}</span>
        <CalendarDays className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
      </button>

      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}

      {/* Calendar dropdown */}
      {isOpen && (
        <div className="absolute z-40 mt-1.5 w-full min-w-68 animate-slide-down rounded-xl border border-border bg-surface p-3 shadow-md">
          {/* Month/year navigation */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={goToPrevMonth}
              aria-label="Previous month"
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-surface-tertiary hover:text-heading"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium text-heading">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={goToNextMonth}
              aria-label="Next month"
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-surface-tertiary hover:text-heading"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((day) => (
              <div
                key={day}
                className="py-1 text-center font-mono text-2xs uppercase text-muted"
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
                    "h-8 w-full cursor-pointer rounded-md text-sm tabular-nums text-body transition-colors",
                    disabled && "text-disabled! cursor-not-allowed",
                    selected && "bg-brand-500 font-medium text-white!",
                    !selected && !disabled && "hover:bg-surface-tertiary",
                    today && !selected && "font-semibold text-brand-500! underline decoration-2 underline-offset-4"
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
              className="w-full cursor-pointer rounded-md py-1 text-center text-xs font-medium text-body hover:bg-surface-tertiary hover:text-heading"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

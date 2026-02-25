"use client";

import { useState, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { getMonthGrid, isSameDay, isToday } from "@/lib/calendarUtils";
import { useClickOutside } from "@/hooks/useClickOutside";

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function CalendarSidebar({
  currentDate,
  onDateSelect,
  calendars,
  selectedCalendarIds,
  onToggleCalendar,
  onManageCalendars,
  isOpen,
  onClose,
}) {
  const [miniYear, setMiniYear] = useState(currentDate.getFullYear());
  const [miniMonth, setMiniMonth] = useState(currentDate.getMonth());
  const sidebarRef = useRef(null);

  useClickOutside(sidebarRef, () => onClose?.(), isOpen);

  const miniGrid = useMemo(
    () => getMonthGrid(miniYear, miniMonth),
    [miniYear, miniMonth]
  );

  function goMiniPrev() {
    if (miniMonth === 0) {
      setMiniMonth(11);
      setMiniYear(miniYear - 1);
    } else {
      setMiniMonth(miniMonth - 1);
    }
  }

  function goMiniNext() {
    if (miniMonth === 11) {
      setMiniMonth(0);
      setMiniYear(miniYear + 1);
    } else {
      setMiniMonth(miniMonth + 1);
    }
  }

  const weeks = [];
  for (let i = 0; i < miniGrid.length; i += 7) {
    weeks.push(miniGrid.slice(i, i + 7));
  }

  const sidebarContent = (
    <>
      {/* Mini calendar */}
      <div className="mb-6">
        {/* Month nav */}
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={goMiniPrev}
            className="btn-ghost rounded-lg p-1 cursor-pointer"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <span className="text-caption font-medium text-heading">
            {MONTHS[miniMonth]} {miniYear}
          </span>
          <button
            type="button"
            onClick={goMiniNext}
            className="btn-ghost rounded-lg p-1 cursor-pointer"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS.map((day, i) => (
            <div key={i} className="text-center text-[10px] text-muted font-medium py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7">
              {week.map((day, di) => {
                const isCurrentMonth = day.getMonth() === miniMonth;
                const selected = isSameDay(day, currentDate);
                const today = isToday(day);

                return (
                  <button
                    key={di}
                    type="button"
                    onClick={() => {
                      onDateSelect?.(day);
                      onClose?.();
                    }}
                    className={cn(
                      "h-7 w-full rounded text-[11px] transition-colors cursor-pointer",
                      !isCurrentMonth && "opacity-30",
                      selected && "bg-brand-500 text-white! font-semibold",
                      !selected && today && "text-brand-400! font-semibold",
                      !selected && !today && "text-body hover:bg-surface-tertiary"
                    )}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Calendars list */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-caption font-medium text-heading uppercase tracking-wider">
            Calendars
          </h3>
          <button
            type="button"
            onClick={onManageCalendars}
            className="text-brand-400 hover:text-brand-500 cursor-pointer"
            title="Manage calendars"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>

        <div className="space-y-1">
          {calendars.map((cal) => {
            const isSelected = selectedCalendarIds.has(cal.id);
            return (
              <button
                key={cal.id}
                type="button"
                onClick={() => onToggleCalendar?.(cal.id)}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-surface-tertiary transition-colors cursor-pointer text-left"
              >
                {/* Checkbox */}
                <div
                  className={cn(
                    "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                    isSelected ? "border-transparent" : "border-neutral-500"
                  )}
                  style={
                    isSelected
                      ? { backgroundColor: cal.color }
                      : undefined
                  }
                >
                  {isSelected && (
                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </div>
                <span className="text-body-sm truncate">{cal.name}</span>
                {cal.is_google && (
                  <svg
                    className="h-3 w-3 text-muted shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    title="Google Calendar"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="w-60 shrink-0 border-r border-border-light p-4 overflow-y-auto scrollbar-thin hidden lg:block">
        {sidebarContent}
      </div>

      {/* Mobile overlay */}
      <div
        className={cn(
          "fixed inset-0 bg-black/60 z-40 lg:hidden transition-opacity",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Mobile drawer */}
      <div
        ref={sidebarRef}
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 bg-surface border-r border-border-light p-4 overflow-y-auto scrollbar-thin lg:hidden",
          "transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Close button */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-body font-semibold text-heading">Calendar</h2>
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost rounded-lg p-1.5 cursor-pointer"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {sidebarContent}
      </div>
    </>
  );
}

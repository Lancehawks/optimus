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
  googleConnected,
  googleLoading,
  onGoogleSync,
  onGoogleConnect,
  isSyncing,
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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
              </button>
            );
          })}
        </div>

        {/* Google Sync button */}
        {googleConnected && (
          <button
            type="button"
            onClick={onGoogleSync}
            disabled={isSyncing}
            className={cn(
              "flex items-center gap-2 w-full mt-3 px-2 py-1.5 rounded-lg text-left transition-colors cursor-pointer",
              "text-muted hover:text-body hover:bg-surface-tertiary",
              isSyncing && "opacity-60 pointer-events-none"
            )}
          >
            <svg
              className={cn("h-3.5 w-3.5 shrink-0", isSyncing && "animate-spin")}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
            </svg>
            <span className="text-body-sm">
              {isSyncing ? "Syncing..." : "Sync Google Calendar"}
            </span>
          </button>
        )}

        {/* Connect Google Calendar button */}
        {!googleLoading && !googleConnected && (
          <button
            type="button"
            onClick={onGoogleConnect}
            className="flex items-center gap-2 w-full mt-3 px-2 py-1.5 rounded-lg text-left transition-colors cursor-pointer text-muted hover:text-body hover:bg-surface-tertiary"
          >
            <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span className="text-body-sm">Connect Google</span>
          </button>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="optimus-context-sidebar w-60 shrink-0 border-r border-border-light p-4 overflow-y-auto scrollbar-thin hidden lg:block">
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
          "optimus-context-drawer fixed inset-y-0 left-0 z-50 w-72 bg-surface border-r border-border-light p-4 overflow-y-auto scrollbar-thin lg:hidden",
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

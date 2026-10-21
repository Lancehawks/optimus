"use client";
import { useAuth } from '@/context/AuthContext';
import { resolveTimeZone } from '@/lib/calendarTime';

import { useState, useMemo, useRef } from "react";
import { Check, ChevronLeft, ChevronRight, Link2, RefreshCw, Settings2, X } from "lucide-react";
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
  const { user } = useAuth();
  const timeZone = resolveTimeZone(user?.timezone);
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
      <div className="mb-7">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-heading">
            {MONTHS[miniMonth]} <span className="font-mono text-xs font-normal text-muted">{miniYear}</span>
          </span>
          <div className="flex items-center">
            <button type="button" onClick={goMiniPrev} className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-tertiary hover:text-heading" aria-label="Previous month">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={goMiniNext} className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-tertiary hover:text-heading" aria-label="Next month">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="mb-0.5 grid grid-cols-7">
          {DAYS.map((day, i) => (
            <div key={i} className="py-1 text-center font-mono text-[0.625rem] text-muted">{day}</div>
          ))}
        </div>

        <div>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7">
              {week.map((day, di) => {
                const isCurrentMonth = day.getMonth() === miniMonth;
                const selected = isSameDay(day, currentDate);
                const today = isToday(day, timeZone);
                return (
                  <button
                    key={di}
                    type="button"
                    onClick={() => {
                      onDateSelect?.(day);
                      onClose?.();
                    }}
                    className={cn(
                      "mx-auto flex h-7 w-7 cursor-pointer items-center justify-center rounded-full font-mono text-[0.6875rem] tabular-nums transition-colors",
                      !isCurrentMonth && "text-placeholder",
                      selected && "bg-heading font-medium text-surface!",
                      !selected && today && "font-semibold text-brand-500",
                      !selected && !today && isCurrentMonth && "text-body hover:bg-surface-tertiary"
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

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <h3 className="text-overline">Calendars</h3>
          <button
            type="button"
            onClick={onManageCalendars}
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-tertiary hover:text-heading"
            title="Manage calendars"
            aria-label="Manage calendars"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="space-y-0.5">
          {calendars.map((cal) => {
            const isSelected = selectedCalendarIds.has(cal.id);
            return (
              <button
                key={cal.id}
                type="button"
                onClick={() => onToggleCalendar?.(cal.id)}
                aria-pressed={isSelected}
                className="-mx-1.5 flex w-[calc(100%+0.75rem)] cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-surface-tertiary"
              >
                <span
                  className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border-[1.5px] transition-colors"
                  style={isSelected ? { backgroundColor: cal.color, borderColor: cal.color } : { borderColor: cal.color }}
                >
                  {isSelected && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3.5} />}
                </span>
                <span className={cn("truncate text-sm", isSelected ? "text-heading" : "text-muted")}>{cal.name}</span>
              </button>
            );
          })}
        </div>

        {googleConnected && (
          <button
            type="button"
            onClick={onGoogleSync}
            disabled={isSyncing}
            className={cn(
              "-mx-1.5 mt-3 flex w-[calc(100%+0.75rem)] cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left text-sm text-muted transition-colors hover:bg-surface-tertiary hover:text-heading",
              isSyncing && "pointer-events-none opacity-60"
            )}
          >
            <RefreshCw className={cn("h-3.5 w-3.5 shrink-0", isSyncing && "animate-spin")} />
            {isSyncing ? "Syncing…" : "Sync Google Calendar"}
          </button>
        )}

        {!googleLoading && !googleConnected && (
          <button
            type="button"
            onClick={onGoogleConnect}
            className="-mx-1.5 mt-3 flex w-[calc(100%+0.75rem)] cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left text-sm text-muted transition-colors hover:bg-surface-tertiary hover:text-heading"
          >
            <Link2 className="h-3.5 w-3.5 shrink-0" />
            Connect Google Calendar
          </button>
        )}
      </div>
    </>
  );

  return (
    <>
      <aside className="hidden w-60 shrink-0 overflow-y-auto border-r border-border p-5 scrollbar-thin xl:block">
        {sidebarContent}
      </aside>

      <div
        className={cn("overlay z-40 transition-opacity xl:hidden", isOpen ? "opacity-100" : "pointer-events-none opacity-0")}
        onClick={onClose}
      />

      <aside
        ref={sidebarRef}
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 overflow-y-auto border-r border-border bg-surface p-5 shadow-lg scrollbar-thin xl:hidden",
          "transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-heading">Calendars</h2>
          <button type="button" onClick={onClose} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-surface-tertiary hover:text-heading" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        {sidebarContent}
      </aside>
    </>
  );
}

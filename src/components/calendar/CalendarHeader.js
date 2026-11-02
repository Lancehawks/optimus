"use client";

import { CalendarClock, ChevronLeft, ChevronRight, PanelLeft, Plus } from "lucide-react";
import { getHeaderLabel } from "@/lib/calendarUtils";
import { Button, Tabs } from "@/components/ui";

const VIEW_TABS = [
  { key: "month", label: "Month" },
  { key: "week", label: "Week" },
  { key: "day", label: "Day" },
];

export default function CalendarHeader({
  currentDate,
  viewMode,
  onViewChange,
  onToday,
  onPrev,
  onNext,
  onNewEvent,
  onToggleSidebar,
  onTogglePlan,
}) {
  const label = getHeaderLabel(currentDate, viewMode);

  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-surface-tertiary hover:text-heading xl:hidden"
          aria-label="Show calendars"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        <h1 className="min-w-0 truncate font-serif text-[1.75rem] leading-8 text-heading">{label}</h1>
        <div className="flex shrink-0 items-center rounded-lg border border-border bg-surface shadow-xs">
          <button
            type="button"
            onClick={onPrev}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-l-lg text-muted hover:bg-surface-tertiary hover:text-heading"
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onToday}
            className="h-7 cursor-pointer border-x border-border px-2.5 text-xs font-medium text-heading hover:bg-surface-tertiary"
          >
            Today
          </button>
          <button
            type="button"
            onClick={onNext}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-r-lg text-muted hover:bg-surface-tertiary hover:text-heading"
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Tabs tabs={VIEW_TABS} activeTab={viewMode} onChange={onViewChange} />
        {onTogglePlan && (
          <Button variant="ghost" onClick={onTogglePlan} leftIcon={<CalendarClock />} className="2xl:hidden" aria-label="Plan time">
            <span className="hidden md:inline">Plan time</span>
          </Button>
        )}
        <Button onClick={onNewEvent} leftIcon={<Plus />} aria-label="New event">
          <span className="hidden sm:inline">New event</span>
        </Button>
      </div>
    </header>
  );
}

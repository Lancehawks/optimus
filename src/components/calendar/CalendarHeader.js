"use client";

import { cn } from "@/lib/utils";
import { getHeaderLabel } from "@/lib/calendarUtils";
import { Button } from "@/components/ui";

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
  isSidebarOpen,
}) {
  const label = getHeaderLabel(currentDate, viewMode);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-6 py-3 border-b border-border-light shrink-0 gap-2">
      {/* Left: Navigation */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Mobile sidebar toggle */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className="btn-ghost rounded-lg p-1.5 cursor-pointer lg:hidden shrink-0"
          title="Calendars"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
        </button>

        <button
          type="button"
          onClick={onToday}
          className="btn-secondary text-body-sm px-2.5 sm:px-3 py-1.5 rounded-lg cursor-pointer shrink-0"
        >
          Today
        </button>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={onPrev}
            className="btn-ghost rounded-lg p-2 cursor-pointer hover:bg-surface-tertiary"
            title="Previous"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onNext}
            className="btn-ghost rounded-lg p-2 cursor-pointer hover:bg-surface-tertiary"
            title="Next"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>

        <h1 className="text-body sm:text-h3 text-heading font-semibold truncate">{label}</h1>
      </div>

      {/* Right: View tabs + New Event */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* View mode tabs */}
        <div className="flex items-center bg-surface-tertiary rounded-lg p-0.5">
          {VIEW_TABS.map((tab) => {
            const isActive = viewMode === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onViewChange(tab.key)}
                className={cn(
                  "px-2.5 sm:px-3 py-1.5 text-caption sm:text-body-sm rounded-md cursor-pointer select-none",
                  "transition-[background-color,color] duration-150 transform-none!",
                  isActive
                    ? "bg-surface text-heading shadow-sm"
                    : "text-muted hover:text-body"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* New Event button */}
        <Button
          variant="primary"
          size="sm"
          onClick={onNewEvent}
          leftIcon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          }
        >
          <span className="hidden sm:inline">New Event</span>
        </Button>
      </div>
    </div>
  );
}

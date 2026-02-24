"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";

export default function JournalView({ notes, onSelectNote, onCreateJournalEntry }) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  // Map journal dates to notes
  const journalDates = useMemo(() => {
    const map = {};
    notes.forEach((note) => {
      if (note.journal_date) {
        const dateKey = note.journal_date.split("T")[0];
        map[dateKey] = note;
      }
    });
    return map;
  }, [notes]);

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const monthName = new Date(currentYear, currentMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleDayClick = (day) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const existingNote = journalDates[dateStr];

    if (existingNote) {
      onSelectNote(existingNote);
    } else {
      onCreateJournalEntry(dateStr);
    }
  };

  const isToday = (day) => {
    return day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
  };

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="btn-ghost p-2 rounded-[var(--radius-md)] cursor-pointer">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h3 className="text-h4">{monthName}</h3>
        <button onClick={nextMonth} className="btn-ghost p-2 rounded-[var(--radius-md)] cursor-pointer">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="text-center text-overline py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Empty cells before first day */}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const hasEntry = journalDates[dateStr];

          return (
            <button
              key={day}
              onClick={() => handleDayClick(day)}
              className={cn(
                "aspect-square flex flex-col items-center justify-center rounded-[var(--radius-md)] text-body-sm transition-colors cursor-pointer relative",
                isToday(day) && "ring-2 ring-brand-500 font-semibold",
                hasEntry
                  ? "bg-brand-50 text-brand-700 hover:bg-brand-100"
                  : "hover:bg-surface-tertiary text-muted hover:text-heading"
              )}
            >
              {day}
              {hasEntry && (
                <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-brand-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* Today's entry shortcut */}
      <div className="mt-4 pt-4 border-t border-border">
        <Button
          variant="secondary"
          fullWidth
          onClick={() => {
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
            handleDayClick(today.getDate());
          }}
          leftIcon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          }
        >
          {journalDates[`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`]
            ? "Open today's entry"
            : "Start today's entry"}
        </Button>
      </div>
    </div>
  );
}

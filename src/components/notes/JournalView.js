"use client";

import { useState, useMemo } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Plus } from "lucide-react";
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

  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-serif text-xl text-heading">{monthName}</h3>
        <div className="flex items-center">
          <button type="button" onClick={prevMonth} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-surface-tertiary hover:text-heading" aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={nextMonth} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-surface-tertiary hover:text-heading" aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mb-1 grid grid-cols-7">
        {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
          <div key={`${day}-${index}`} className="py-1 text-center font-mono text-3xs text-muted">{day}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const hasEntry = journalDates[dateStr];
          return (
            <button
              key={day}
              type="button"
              onClick={() => handleDayClick(day)}
              aria-label={`${dateStr}${hasEntry ? ", has entry" : ""}`}
              className={cn(
                "relative flex aspect-square cursor-pointer flex-col items-center justify-center rounded-md font-mono text-2xs tabular-nums transition-colors",
                isToday(day) ? "bg-heading font-medium text-surface" : hasEntry ? "text-heading hover:bg-surface-tertiary" : "text-muted hover:bg-surface-tertiary hover:text-heading"
              )}
            >
              {day}
              {hasEntry && <span className={cn("absolute bottom-1 h-1 w-1 rounded-full", isToday(day) ? "bg-surface" : "bg-brand-500")} />}
            </button>
          );
        })}
      </div>

      <Button
        variant="secondary"
        fullWidth
        className="mt-4"
        onClick={() => handleDayClick(today.getDate())}
        leftIcon={journalDates[todayKey] ? <BookOpen /> : <Plus />}
      >
        {journalDates[todayKey] ? "Open today's entry" : "Write today's entry"}
      </Button>
    </div>
  );
}

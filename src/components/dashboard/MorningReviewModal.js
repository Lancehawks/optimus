"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Modal from "@/components/ui/Modal";
import { useTasks } from "@/hooks/useTasks";
import { useHabits } from "@/hooks/useHabits";
import { useEvents } from "@/hooks/useCalendar";

const STORAGE_KEY = "optimus-morning-review";

const SNOOZE_OPTIONS = [
  { label: "30 minutes", ms: 30 * 60 * 1000 },
  { label: "1 hour", ms: 60 * 60 * 1000 },
  { label: "2 hours", ms: 2 * 60 * 60 * 1000 },
];

const MOTIVATIONAL_LINES = [
  "Small steps compound into extraordinary results.",
  "Focus on progress, not perfection.",
  "Today is another chance to move the needle.",
  "Discipline is choosing between what you want now and what you want most.",
  "The best time to start was yesterday. The second best is now.",
  "You don't have to be great to start, but you have to start to be great.",
  "Consistency beats intensity every single time.",
];

function getToday() {
  return new Date().toISOString().split("T")[0];
}

function shouldShowReview() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const today = getToday();
    if (stored.dismissedDate === today) return false;
    if (stored.snoozedUntil && Date.now() < stored.snoozedUntil) return false;
    return true;
  } catch {
    return true;
  }
}

function getSnoozedRemainingMs() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (stored.snoozedUntil && Date.now() < stored.snoozedUntil) {
      return stored.snoozedUntil - Date.now();
    }
  } catch {}
  return null;
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function isAllDay(event) {
  const s = new Date(event.start_time);
  const e = new Date(event.end_time);
  return s.getHours() === 0 && s.getMinutes() === 0 && e.getHours() === 0 && e.getMinutes() === 0;
}

export default function MorningReviewModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const snoozeTimerRef = useRef(null);
  const snoozeDropdownRef = useRef(null);

  // Data hooks
  const { tasks, isLoading: tasksLoading } = useTasks({ sort: "due_date", order: "asc" });
  const { habits, isLoading: habitsLoading } = useHabits();

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const todayEnd = useMemo(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  }, []);
  const { events, isLoading: eventsLoading } = useEvents(todayStart, todayEnd, null);

  const isLoading = tasksLoading || habitsLoading || eventsLoading;

  // Filter tasks: overdue + due today
  const todayStr = getToday();
  const relevantTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (t.status === "done" || t.is_archived) return false;
      if (!t.due_date) return false;
      const taskDate = new Date(t.due_date).toISOString().split("T")[0];
      return taskDate <= todayStr;
    });
  }, [tasks, todayStr]);

  const overdueTasks = useMemo(() => {
    return relevantTasks.filter((t) => {
      const taskDate = new Date(t.due_date).toISOString().split("T")[0];
      return taskDate < todayStr;
    });
  }, [relevantTasks, todayStr]);

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  }, [events]);

  // Check on mount & listen for external trigger
  useEffect(() => {
    if (shouldShowReview()) {
      setIsOpen(true);
    } else {
      // If snoozed, set timer for re-show
      const remaining = getSnoozedRemainingMs();
      if (remaining) {
        snoozeTimerRef.current = setTimeout(() => setIsOpen(true), remaining);
      }
    }

    const handleOpenReview = () => setIsOpen(true);
    window.addEventListener("optimus-open-review", handleOpenReview);

    return () => {
      window.removeEventListener("optimus-open-review", handleOpenReview);
      if (snoozeTimerRef.current) clearTimeout(snoozeTimerRef.current);
    };
  }, []);

  // Close snooze dropdown on outside click
  useEffect(() => {
    if (!snoozeOpen) return;
    function handleClick(e) {
      if (snoozeDropdownRef.current && !snoozeDropdownRef.current.contains(e.target)) {
        setSnoozeOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [snoozeOpen]);

  function handleDismiss() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ dismissedDate: getToday() }));
    setIsOpen(false);
    setSnoozeOpen(false);
  }

  function handleSnooze(delayMs) {
    const snoozedUntil = Date.now() + delayMs;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ snoozedUntil }));
    setIsOpen(false);
    setSnoozeOpen(false);

    if (snoozeTimerRef.current) clearTimeout(snoozeTimerRef.current);
    snoozeTimerRef.current = setTimeout(() => setIsOpen(true), delayMs);
  }

  const now = new Date();
  const weekday = now.toLocaleDateString("en-US", { weekday: "long" });
  const fullDate = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const motivationalLine = MOTIVATIONAL_LINES[now.getDay() % MOTIVATIONAL_LINES.length];

  const habitsDone = habits.filter((h) => h.completed_today).length;
  const habitsRemaining = habits.length - habitsDone;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleDismiss}
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          {/* Snooze */}
          <div className="relative" ref={snoozeDropdownRef}>
            <button
              onClick={() => setSnoozeOpen(!snoozeOpen)}
              className="btn-base btn-ghost text-body-sm flex items-center gap-1.5"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Snooze
            </button>
            {snoozeOpen && (
              <div className="absolute bottom-full left-0 mb-1 card py-1 min-w-[140px] shadow-lg animate-slide-up z-10">
                {SNOOZE_OPTIONS.map((opt) => (
                  <button
                    key={opt.ms}
                    onClick={() => handleSnooze(opt.ms)}
                    className="w-full text-left px-3 py-2 text-body-sm text-muted hover:bg-white/6 hover:text-heading transition-colors cursor-pointer"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dismiss */}
          <button
            onClick={handleDismiss}
            className="btn-base btn-primary"
          >
            Let&apos;s go
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Date header */}
        <div>
          <p className="text-brand-400 font-medium text-body-sm">{weekday}</p>
          <h2 className="text-h2 text-heading">{fullDate}</h2>
          <p className="text-body-sm text-muted italic mt-1">{motivationalLine}</p>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-8 rounded-lg bg-neutral-700/50 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* Schedule */}
            <div>
              <p className="text-overline mb-2">Schedule</p>
              {sortedEvents.length === 0 ? (
                <p className="text-body-sm text-muted">No events today — open schedule.</p>
              ) : (
                <div className="space-y-1">
                  {sortedEvents.slice(0, 6).map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.03] transition-colors"
                    >
                      <div
                        className="shrink-0 h-2 w-2 rounded-full"
                        style={{ backgroundColor: event.calendar_color || "#6366f1" }}
                      />
                      <span className="text-body-sm text-heading flex-1 truncate">
                        {event.title}
                      </span>
                      <span className="text-caption text-muted shrink-0">
                        {isAllDay(event) ? "All day" : formatTime(event.start_time)}
                      </span>
                    </div>
                  ))}
                  {sortedEvents.length > 6 && (
                    <p className="text-caption text-muted px-3">
                      +{sortedEvents.length - 6} more events
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Tasks Due */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-overline">Tasks Due</p>
                {overdueTasks.length > 0 && (
                  <span className="text-[10px] font-semibold text-red-400">
                    {overdueTasks.length} overdue
                  </span>
                )}
              </div>
              {relevantTasks.length === 0 ? (
                <p className="text-body-sm text-muted">No tasks due today — all clear.</p>
              ) : (
                <div className="space-y-1">
                  {relevantTasks.slice(0, 8).map((task) => {
                    const taskDate = new Date(task.due_date).toISOString().split("T")[0];
                    const isOverdue = taskDate < todayStr;
                    return (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.03] transition-colors"
                      >
                        <div
                          className={`shrink-0 h-2 w-2 rounded-full ${
                            task.priority === "urgent"
                              ? "bg-red-500"
                              : task.priority === "high"
                                ? "bg-amber-500"
                                : task.priority === "medium"
                                  ? "bg-blue-400"
                                  : "bg-neutral-500"
                          }`}
                        />
                        <span className={`flex-1 text-body-sm truncate ${isOverdue ? "text-red-400" : "text-heading"}`}>
                          {task.title}
                        </span>
                        {isOverdue && (
                          <span className="text-[10px] font-medium text-red-500 shrink-0">overdue</span>
                        )}
                      </div>
                    );
                  })}
                  {relevantTasks.length > 8 && (
                    <p className="text-caption text-muted px-3">
                      +{relevantTasks.length - 8} more tasks
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Habits */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-overline">Habits</p>
                {habits.length > 0 && (
                  <span className={`text-caption font-medium ${habitsRemaining === 0 ? "text-emerald-400" : "text-muted"}`}>
                    {habitsRemaining === 0 ? "All done!" : `${habitsRemaining} remaining`}
                  </span>
                )}
              </div>
              {habits.length === 0 ? (
                <p className="text-body-sm text-muted">No habits set up yet.</p>
              ) : (
                <div className="space-y-1">
                  {habits.slice(0, 8).map((habit) => (
                    <div
                      key={habit.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.03] transition-colors"
                    >
                      <div
                        className={`shrink-0 h-4 w-4 rounded border flex items-center justify-center ${
                          habit.completed_today
                            ? "bg-emerald-500 border-emerald-500"
                            : "border-neutral-600"
                        }`}
                      >
                        {habit.completed_today && (
                          <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                      </div>
                      <span className={`flex-1 text-body-sm truncate ${habit.completed_today ? "line-through text-muted" : "text-heading"}`}>
                        {habit.name}
                      </span>
                      {habit.current_streak > 0 && (
                        <span className="text-caption text-amber-400 font-medium shrink-0">
                          🔥{habit.current_streak}
                        </span>
                      )}
                    </div>
                  ))}
                  {habits.length > 8 && (
                    <p className="text-caption text-muted px-3">
                      +{habits.length - 8} more habits
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

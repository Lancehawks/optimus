"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { AlarmClock } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { useTasks } from "@/hooks/useTasks";
import { useEvents } from "@/hooks/useCalendar";
import { useDayPlan, useDayPlanStatus } from "@/hooks/useDayPlan";
import DayPlanReview from "@/components/day-plan/DayPlanReview";
import { getEventDisplayColor } from "@/lib/eventDisplay";
import { toLocalDateStr } from "@/lib/utils";
import { useAuth } from '@/context/AuthContext';
import { dateKey, wallDate, resolveTimeZone } from '@/lib/calendarTime';
import { getVisibleRange } from '@/lib/calendarUtils';

const STORAGE_KEY = "optimus-morning-review";

const SNOOZE_OPTIONS = [
  { label: "30 minutes", ms: 30 * 60 * 1000 },
  { label: "1 hour", ms: 60 * 60 * 1000 },
  { label: "2 hours", ms: 2 * 60 * 60 * 1000 },
];

export function dismissReviewForToday(timeZone) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ dismissedDate: getToday(timeZone) }));
  } catch {
    // The prompt simply reappears on the next visit when storage is blocked.
  }
  window.dispatchEvent(new Event(REVIEW_DISMISSED_EVENT));
}

export function getToday(timeZone) {
  return dateKey(new Date(), timeZone);
}

export const REVIEW_DISMISSED_EVENT = "optimus-review-dismissed";

export function shouldShowReview(timeZone) {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const today = getToday(timeZone);
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

function formatTime(dateStr, timeZone) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone });
}

function isAllDay(event) {
  return Boolean(event.all_day);
}

export default function MorningReviewModal() {
  const { user } = useAuth();
  const timeZone = resolveTimeZone(user?.timezone);
  const [isOpen, setIsOpen] = useState(false);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const snoozeTimerRef = useRef(null);
  const snoozeDropdownRef = useRef(null);

  // Data hooks
  const { tasks, isLoading: tasksLoading } = useTasks({ sort: "due_date", order: "asc" });

  const { start: todayStart, end: todayEnd } = useMemo(
    () => getVisibleRange(wallDate(new Date(), timeZone), 'day', timeZone), [timeZone]);
  const { events, isLoading: eventsLoading } = useEvents(todayStart, todayEnd, null);

  // Day plan
  const { blocks: dayPlanBlocks, isLoading: dayPlanLoading } = useDayPlan();
  const { status: dayPlanStatus, refetch: refetchDayPlanStatus } = useDayPlanStatus(getToday(timeZone));
  const [dayPlanApplied, setDayPlanApplied] = useState(false);

  const isLoading = tasksLoading || eventsLoading || dayPlanLoading;

  // Filter tasks: overdue + due today
  const todayStr = getToday(timeZone);
  const relevantTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (t.status === "done" || t.is_archived) return false;
      if (!t.due_date) return false;
      const taskDate = toLocalDateStr(t.due_date);
      return taskDate <= todayStr;
    });
  }, [tasks, todayStr]);

  const overdueTasks = useMemo(() => {
    return relevantTasks.filter((t) => {
      const taskDate = toLocalDateStr(t.due_date);
      return taskDate < todayStr;
    });
  }, [relevantTasks, todayStr]);

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  }, [events]);

  // The review opens on request; Today shows an inline prompt instead of
  // interrupting the page. A snoozed review reopens when its timer ends.
  useEffect(() => {
    const remaining = getSnoozedRemainingMs();
    if (remaining) {
      snoozeTimerRef.current = setTimeout(() => setIsOpen(true), remaining);
    }

    const handleOpenReview = () => setIsOpen(true);
    window.addEventListener("optimus-open-review", handleOpenReview);

    return () => {
      window.removeEventListener("optimus-open-review", handleOpenReview);
      if (snoozeTimerRef.current) clearTimeout(snoozeTimerRef.current);
    };
  }, [timeZone]);

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
    dismissReviewForToday(timeZone);
    setIsOpen(false);
    setSnoozeOpen(false);
  }

  function handleSnooze(delayMs) {
    const snoozedUntil = Date.now() + delayMs;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ snoozedUntil }));
    } catch {
      // Snooze still applies for this session.
    }
    window.dispatchEvent(new Event(REVIEW_DISMISSED_EVENT));
    setIsOpen(false);
    setSnoozeOpen(false);

    if (snoozeTimerRef.current) clearTimeout(snoozeTimerRef.current);
    snoozeTimerRef.current = setTimeout(() => setIsOpen(true), delayMs);
  }

  const now = wallDate(new Date(), timeZone);
  const weekday = now.toLocaleDateString("en-US", { weekday: "long" });
  const fullDate = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleDismiss}
      size="lg"
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="relative" ref={snoozeDropdownRef}>
            <Button variant="ghost" leftIcon={<AlarmClock />} onClick={() => setSnoozeOpen(!snoozeOpen)}>
              Snooze
            </Button>
            {snoozeOpen && (
              <div className="absolute bottom-full left-0 z-10 mb-1.5 min-w-36 animate-slide-up rounded-xl border border-border bg-surface p-1 shadow-md">
                {SNOOZE_OPTIONS.map((opt) => (
                  <button
                    key={opt.ms}
                    type="button"
                    onClick={() => handleSnooze(opt.ms)}
                    className="flex h-8 w-full cursor-pointer items-center rounded-md px-2 text-left text-sm text-body hover:bg-surface-tertiary hover:text-heading"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button onClick={handleDismiss}>Let&apos;s go</Button>
        </div>
      }
    >
      <div className="space-y-7 pt-2">
        <div>
          <p className="text-overline">{weekday}</p>
          <h2 className="text-display mt-2">{fullDate}</h2>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-7" />
            ))}
          </div>
        ) : (
          <>
            <section>
              <p className="text-overline mb-2">Schedule</p>
              {sortedEvents.length === 0 ? (
                <p className="text-sm text-muted">Nothing on the calendar today.</p>
              ) : (
                <div className="divide-y divide-border rounded-lg border border-border">
                  {sortedEvents.slice(0, 6).map((event) => (
                    <div key={event.id} className="flex items-center gap-3 px-3 py-2">
                      <span className="h-3.5 w-0.5 shrink-0 rounded-full" style={{ backgroundColor: getEventDisplayColor(event, "#3346d3") }} />
                      <span className="flex-1 truncate text-sm text-heading">{event.title}</span>
                      <span className="shrink-0 font-mono text-xs tabular-nums text-muted">
                        {isAllDay(event) ? "All day" : formatTime(event.start_time, timeZone)}
                      </span>
                    </div>
                  ))}
                  {sortedEvents.length > 6 && (
                    <p className="px-3 py-2 text-xs text-muted">+{sortedEvents.length - 6} more events</p>
                  )}
                </div>
              )}
            </section>

            <section>
              <div className="mb-2 flex items-center gap-2">
                <p className="text-overline">Tasks due</p>
                {overdueTasks.length > 0 && (
                  <span className="font-mono text-[0.6875rem] text-danger">{overdueTasks.length} overdue</span>
                )}
              </div>
              {relevantTasks.length === 0 ? (
                <p className="text-sm text-muted">No tasks due today.</p>
              ) : (
                <div className="divide-y divide-border rounded-lg border border-border">
                  {relevantTasks.slice(0, 8).map((task) => {
                    const isOverdue = toLocalDateStr(task.due_date) < todayStr;
                    return (
                      <div key={task.id} className="flex items-center gap-3 px-3 py-2">
                        <span className="h-3.5 w-3.5 shrink-0 rounded-full border-[1.5px] border-border-strong" />
                        <span className="flex-1 truncate text-sm text-heading">{task.title}</span>
                        {isOverdue && <span className="shrink-0 font-mono text-[0.6875rem] text-danger">Overdue</span>}
                      </div>
                    );
                  })}
                  {relevantTasks.length > 8 && (
                    <p className="px-3 py-2 text-xs text-muted">+{relevantTasks.length - 8} more tasks</p>
                  )}
                </div>
              )}
            </section>

            {dayPlanBlocks.length > 0 && (
              <section>
                <div className="mb-2 flex items-center gap-2">
                  <p className="text-overline">Day plan</p>
                  {(dayPlanStatus || dayPlanApplied) && (
                    <span className="font-mono text-[0.6875rem] text-success">
                      {dayPlanStatus === "rejected" ? "Skipped" : "Applied"}
                    </span>
                  )}
                </div>
                {dayPlanStatus || dayPlanApplied ? (
                  <p className="text-sm text-muted">
                    Today&apos;s plan has been {dayPlanStatus === "rejected" ? "skipped" : "added to your calendar"}.
                  </p>
                ) : (
                  <DayPlanReview
                    blocks={dayPlanBlocks}
                    compact
                    onComplete={() => {
                      setDayPlanApplied(true);
                      refetchDayPlanStatus();
                    }}
                  />
                )}
              </section>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

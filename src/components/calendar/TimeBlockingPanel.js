"use client";

import { useMemo } from "react";
import { Spinner } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useTasks } from "@/hooks/useTasks";
import { FOCUS_BLOCK_COLOR, formatTimeRange } from "@/lib/eventDisplay";

const WORK_START_HOUR = 8;
const WORK_END_HOUR = 18;
const MIN_FREE_MINUTES = 30;

function isSameLocalDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

function roundToNextHalfHour(date) {
  const next = new Date(date);
  const minutes = next.getMinutes();
  next.setSeconds(0, 0);
  if (minutes === 0 || minutes === 30) return next;
  next.setMinutes(minutes < 30 ? 30 : 60);
  return next;
}

function getDefaultStart(date) {
  const start = new Date(date);
  start.setHours(9, 0, 0, 0);

  const now = new Date();
  if (isSameLocalDay(start, now) && now > start) {
    return roundToNextHalfHour(now);
  }

  return start;
}

function getFreeSlots(date, events) {
  const dayStart = new Date(date);
  dayStart.setHours(WORK_START_HOUR, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(WORK_END_HOUR, 0, 0, 0);

  const now = new Date();
  const windowStart = isSameLocalDay(dayStart, now) && now > dayStart
    ? roundToNextHalfHour(now)
    : dayStart;

  const busy = events
    .filter((event) => !event.all_day)
    .map((event) => ({
      start: new Date(event.start_time),
      end: new Date(event.end_time),
    }))
    .filter((slot) => slot.end > windowStart && slot.start < dayEnd)
    .map((slot) => ({
      start: slot.start < windowStart ? windowStart : slot.start,
      end: slot.end > dayEnd ? dayEnd : slot.end,
    }))
    .sort((a, b) => a.start - b.start);

  const merged = [];
  for (const slot of busy) {
    const last = merged[merged.length - 1];
    if (!last || slot.start > last.end) {
      merged.push(slot);
    } else if (slot.end > last.end) {
      last.end = slot.end;
    }
  }

  const free = [];
  let cursor = windowStart;
  for (const slot of merged) {
    if ((slot.start - cursor) / 60000 >= MIN_FREE_MINUTES) {
      free.push({ start: cursor, end: slot.start });
    }
    if (slot.end > cursor) cursor = slot.end;
  }
  if ((dayEnd - cursor) / 60000 >= MIN_FREE_MINUTES) {
    free.push({ start: cursor, end: dayEnd });
  }

  return free.slice(0, 4);
}

function taskDragPayload(task) {
  return {
    id: task.id,
    title: task.title,
    project_id: task.project_id || null,
    project_name: task.project_name || null,
    priority: task.priority,
  };
}

export default function TimeBlockingPanel({
  currentDate,
  events,
  onScheduleTask,
  onCreateFocusBlock,
}) {
  const { tasks, isLoading } = useTasks({ sort: "due_date", order: "asc" });

  const dayEvents = useMemo(
    () => events.filter((event) => isSameLocalDay(new Date(event.start_time), currentDate)),
    [events, currentDate]
  );

  const freeSlots = useMemo(
    () => getFreeSlots(currentDate, dayEvents),
    [currentDate, dayEvents]
  );

  const defaultStart = freeSlots[0]?.start || getDefaultStart(currentDate);
  const openTasks = tasks
    .filter((task) => task.status !== "done" && !task.deferred)
    .slice(0, 8);

  return (
    <aside className="hidden xl:flex w-72 shrink-0 flex-col border-l border-border-light bg-surface/70">
      <div className="border-b border-border-light px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-body-sm font-semibold text-heading!">Time Blocking</h2>
            <p className="mt-0.5 text-caption text-muted">{freeSlots.length} free slot{freeSlots.length === 1 ? "" : "s"}</p>
          </div>
          <button
            type="button"
            onClick={() => onCreateFocusBlock?.(defaultStart)}
            className="btn-base btn-secondary px-3 py-1.5 text-xs"
          >
            Focus
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 scrollbar-thin">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-caption font-medium uppercase text-muted">Free Time</h3>
          </div>
          <div className="space-y-2">
            {freeSlots.length > 0 ? freeSlots.map((slot) => (
              <button
                key={`${slot.start.toISOString()}-${slot.end.toISOString()}`}
                type="button"
                onClick={() => onCreateFocusBlock?.(slot.start)}
                className="w-full rounded-lg border border-border bg-surface-secondary px-3 py-2 text-left transition-colors hover:border-border-strong"
              >
                <span className="text-body-sm font-medium text-heading!">{formatTimeRange(slot.start, slot.end)}</span>
                <span className="mt-1 block text-caption text-muted">{Math.round((slot.end - slot.start) / 60000)} min open</span>
              </button>
            )) : (
              <div className="rounded-lg border border-dashed border-border-light bg-surface-secondary/45 px-3 py-4 text-center text-caption text-muted">
                No open focus slots today
              </div>
            )}
          </div>
        </section>

        <section className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-caption font-medium uppercase text-muted">Tasks</h3>
            {isLoading && <Spinner size="sm" />}
          </div>
          <div className="space-y-2">
            {openTasks.map((task) => (
              <div
                key={task.id}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData("application/x-optimus-task", JSON.stringify(taskDragPayload(task)));
                  event.dataTransfer.effectAllowed = "copy";
                }}
                className="group rounded-lg border border-border bg-surface-secondary px-3 py-2 transition-colors hover:border-border-strong"
              >
                <div className="flex items-start gap-2">
                  <span
                    className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      task.priority === "urgent" ? "bg-red-400" : task.priority === "high" ? "bg-amber-400" : "bg-brand-500"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-sm font-medium text-heading!">{task.title}</p>
                    <p className="mt-0.5 truncate text-caption text-muted">{task.project_name || "Personal"}</p>
                  </div>
                </div>
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => onScheduleTask?.(taskDragPayload(task), defaultStart)}
                    className="rounded-md px-2 py-1 text-caption font-medium text-brand-300 opacity-0 transition-opacity hover:bg-brand-500/10 group-hover:opacity-100"
                  >
                    Schedule
                  </button>
                </div>
              </div>
            ))}
            {!isLoading && openTasks.length === 0 && (
              <div className="rounded-lg border border-dashed border-border-light bg-surface-secondary/45 px-3 py-4 text-center text-caption text-muted">
                No open tasks
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="border-t border-border-light px-4 py-3">
        <div className="flex items-center gap-2 text-caption text-muted">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: FOCUS_BLOCK_COLOR }} />
          <span>Focus block</span>
        </div>
      </div>
    </aside>
  );
}

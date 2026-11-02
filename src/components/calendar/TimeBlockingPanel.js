"use client";
import { useAuth } from '@/context/AuthContext';
import { resolveTimeZone } from '@/lib/calendarTime';
import { getEventsForDay } from '@/lib/calendarUtils';

import { useEffect, useMemo, useState } from "react";
import { GripVertical, Target, X } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { PriorityIcon, ScheduledChip } from "@/components/tasks/TaskGlyphs";
import { useTasks } from "@/hooks/useTasks";
import { formatTimeRange } from "@/lib/eventDisplay";
import { getDefaultStart, getFreeSlots } from "@/lib/timeBlocking";

function taskDragPayload(task) {
  return {
    id: task.id,
    title: task.title,
    project_id: task.project_id || null,
    project_name: task.project_name || null,
    priority: task.priority,
    estimated_minutes: task.estimated_minutes || null,
  };
}

export default function TimeBlockingPanel({
  isOpen = false,
  onClose,
  currentDate,
  events,
  onScheduleTask,
  onCreateFocusBlock,
}) {
  const { user } = useAuth();
  const timeZone = resolveTimeZone(user?.timezone);
  const { tasks, isLoading } = useTasks({ sort: "due_date", order: "asc" });

  const dayEvents = useMemo(
    () => getEventsForDay(events, currentDate, timeZone),
    [events, currentDate, timeZone]
  );

  // Free time depends on the current clock, so it is computed only in the
  // browser; the server render shows the empty state without a mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const freeSlots = useMemo(
    () => (mounted ? getFreeSlots(currentDate, dayEvents, timeZone) : []),
    [mounted, currentDate, dayEvents, timeZone]
  );

  const defaultStart = freeSlots[0]?.start || getDefaultStart(currentDate, timeZone);
  const openTasks = tasks
    .filter((task) => task.status !== "done" && !task.deferred)
    .slice(0, 8);

  const content = (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-heading">Plan time</h2>
          <p className="mt-0.5 font-mono text-2xs text-muted">
            {freeSlots.length} free slot{freeSlots.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="secondary" leftIcon={<Target />} onClick={() => onCreateFocusBlock?.(defaultStart)}>
            Focus block
          </Button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-surface-tertiary hover:text-heading 2xl:hidden"
              aria-label="Close planning panel"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 scrollbar-thin">
        <section>
          <h3 className="mb-2 text-overline">Free today</h3>
          {freeSlots.length > 0 ? (
            <div className="divide-y divide-border rounded-lg border border-border">
              {freeSlots.map((slot) => (
                <button
                  key={`${slot.start.toISOString()}-${slot.end.toISOString()}`}
                  type="button"
                  onClick={() => onCreateFocusBlock?.(slot.start)}
                  className="group flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-surface-secondary"
                >
                  <span className="font-mono text-xs tabular-nums text-heading">{formatTimeRange(slot.start, slot.end)}</span>
                  <span className="font-mono text-2xs text-muted group-hover:hidden">{Math.round((slot.end - slot.start) / 60000)}m</span>
                  <span className="hidden text-2xs font-medium text-brand-500 group-hover:inline">Block</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted">No open slots left today.</p>
          )}
        </section>

        <section className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-overline">Drag onto the calendar</h3>
            {isLoading && <Spinner size="sm" />}
          </div>
          <div className="space-y-1.5">
            {openTasks.map((task) => (
              <div
                key={task.id}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData("application/x-optimus-task", JSON.stringify(taskDragPayload(task)));
                  event.dataTransfer.effectAllowed = "copy";
                }}
                className="group flex cursor-grab items-center gap-2.5 rounded-lg border border-border bg-surface px-2.5 py-2 shadow-xs transition-colors hover:border-border-strong active:cursor-grabbing"
              >
                <GripVertical className="h-3.5 w-3.5 shrink-0 text-placeholder" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-heading">{task.title}</p>
                  <p className="flex min-w-0 items-center gap-1.5 text-2xs text-muted">
                    <span className="truncate">{task.project_name || "Personal"}</span>
                    {task.next_block && <ScheduledChip block={task.next_block} />}
                  </p>
                </div>
                <PriorityIcon priority={task.priority} className="group-hover:hidden" />
                <button
                  type="button"
                  onClick={() => onScheduleTask?.(taskDragPayload(task), defaultStart)}
                  className="hidden cursor-pointer rounded px-1.5 py-0.5 text-2xs font-medium text-brand-500 hover:bg-brand-50 group-hover:block"
                >
                  Schedule
                </button>
              </div>
            ))}
            {!isLoading && openTasks.length === 0 && <p className="text-xs text-muted">No open tasks to schedule.</p>}
          </div>
        </section>
      </div>
    </>
  );

  return (
    <>
      <aside className="hidden w-72 shrink-0 flex-col border-l border-border 2xl:flex">{content}</aside>
      {isOpen && (
        <>
          <div className="overlay z-40 animate-fade-in 2xl:hidden" onClick={onClose} />
          <aside className="fixed inset-y-2 right-2 z-50 flex w-[min(20rem,calc(100vw-1rem))] animate-sheet-in flex-col overflow-hidden rounded-2xl bg-surface shadow-lg 2xl:hidden">
            {content}
          </aside>
        </>
      )}
    </>
  );
}

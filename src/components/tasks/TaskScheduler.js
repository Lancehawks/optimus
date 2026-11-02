"use client";

import { useId, useMemo, useState } from "react";
import { Button, DatePicker, Input, Modal, Select, Spinner, useToast } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useEvents } from "@/hooks/useCalendar";
import { eventService } from "@/services/api";
import { addDateDays, dateKey, resolveTimeZone, wallDate, zonedInputToDate } from "@/lib/calendarTime";
import { formatTimeRange } from "@/lib/eventDisplay";
import { formatEstimate } from "@/lib/taskEstimate";
import {
  BLOCK_LENGTH_OPTIONS,
  WORK_END_HOUR,
  defaultBlockMinutes,
  formatBlockDay,
  formatBlockTime,
  getDefaultStart,
  getFreeSlots,
  taskBlockEvent,
} from "@/lib/timeBlocking";
import { cn, toLocalDateStr } from "@/lib/utils";

const lengthOptions = BLOCK_LENGTH_OPTIONS.map((minutes) => ({ value: String(minutes), label: formatEstimate(minutes) }));

function clockValue(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

// Once the working day is over, the next free time is tomorrow.
function firstDay(timeZone) {
  const today = dateKey(new Date(), timeZone);
  return wallDate(new Date(), timeZone).getHours() >= WORK_END_HOUR ? addDateDays(today, 1) : today;
}

function Choice({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 cursor-pointer items-center rounded-md border px-2.5 text-xs font-medium transition-colors",
        active
          ? "border-heading bg-heading text-surface"
          : "border-border bg-surface text-body hover:border-border-strong hover:text-heading"
      )}
    >
      {children}
    </button>
  );
}

/**
 * Puts a focus block for a task on the calendar, the same block the
 * calendar's planning panel makes. The day's open time is offered first, and
 * any start time can be typed instead.
 */
export default function TaskScheduler({ task, onScheduled, onCancel, className }) {
  const { user } = useAuth();
  const timeZone = resolveTimeZone(user?.timezone);
  const { addToast } = useToast();
  const fieldId = useId();
  const [day, setDay] = useState(() => firstDay(timeZone));
  const [minutes, setMinutes] = useState(() => defaultBlockMinutes(task));
  // Empty follows the day's first open slot.
  const [chosenStart, setChosenStart] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const today = dateKey(new Date(), timeZone);
  const tomorrow = addDateDays(today, 1);
  const range = useMemo(() => ({
    start: zonedInputToDate(`${day}T00:00`, timeZone),
    end: zonedInputToDate(`${addDateDays(day, 1)}T00:00`, timeZone),
  }), [day, timeZone]);
  const { events, isLoading } = useEvents(range.start, range.end);

  const wallDay = useMemo(() => new Date(`${day}T00:00:00`), [day]);
  const freeSlots = useMemo(
    () => getFreeSlots(wallDay, events, timeZone, { minMinutes: minutes }),
    [wallDay, events, timeZone, minutes]
  );
  const startClock = chosenStart || clockValue(freeSlots[0]?.start || getDefaultStart(wallDay, timeZone));

  let block = null;
  try {
    const start = zonedInputToDate(`${day}T${startClock}`, timeZone);
    block = { start, end: new Date(start.getTime() + minutes * 60000) };
  } catch {
    // A time that doesn't exist on this day, at a daylight saving change.
  }
  const hasPassed = Boolean(block && block.end <= new Date());
  const clash = block && events.find((event) => (
    !event.all_day
    && event.status !== "cancelled"
    && new Date(event.start_time) < block.end
    && new Date(event.end_time) > block.start
  ));

  const pickDay = (nextDay) => {
    setDay(nextDay);
    setChosenStart("");
  };

  const schedule = async () => {
    if (!block || hasPassed || isSaving) return;
    setIsSaving(true);
    try {
      const result = await eventService.create(taskBlockEvent(task, block.start, block.end));
      const startTime = block.start.toISOString();
      addToast({
        message: `Scheduled ${formatBlockDay({ start_time: startTime }, timeZone)} at ${formatBlockTime(startTime, timeZone)}`,
        type: "success",
      });
      if (result?.googleError) {
        addToast({ message: `Google sync failed: ${result.googleError}`, type: "error" });
      }
      onScheduled?.(result.event);
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  let notice = null;
  if (!block) notice = <p className="text-xs text-danger">That time doesn&apos;t exist on this day. Pick another.</p>;
  else if (hasPassed) notice = <p className="text-xs text-danger">That time has already passed.</p>;
  else if (clash) notice = <p className="text-xs text-warning">Overlaps “{clash.title}”.</p>;

  return (
    <div
      className={cn("space-y-4", className)}
      onKeyDown={(event) => {
        // This can sit inside the task form; Enter schedules instead of saving the task.
        if (event.key === "Enter" && event.target.tagName === "INPUT") {
          event.preventDefault();
          schedule();
        }
      }}
    >
      <div>
        <p className="mb-1.5 text-xs font-medium text-heading">Day</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Choice active={day === today} onClick={() => pickDay(today)}>Today</Choice>
          <Choice active={day === tomorrow} onClick={() => pickDay(tomorrow)}>Tomorrow</Choice>
          <DatePicker
            value={wallDay}
            onChange={(date) => date && pickDay(toLocalDateStr(date))}
            minDate={new Date(`${today}T00:00:00`)}
            className="min-w-36 flex-1"
          />
        </div>
      </div>

      <div>
        <p className="mb-1.5 flex items-center gap-2 text-xs font-medium text-heading">
          Open time
          {isLoading && <Spinner size="sm" />}
        </p>
        {freeSlots.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {freeSlots.map((slot) => {
              const value = clockValue(slot.start);
              return (
                <Choice key={value} active={startClock === value} onClick={() => setChosenStart(value)}>
                  <span className="font-mono tabular-nums">{formatTimeRange(slot.start, slot.end)}</span>
                </Choice>
              );
            })}
          </div>
        ) : (
          !isLoading && (
            <p className="text-xs text-muted">
              No {formatEstimate(minutes)} gap between 8 AM and 6 PM. Type a start time instead.
            </p>
          )
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          id={`${fieldId}-start`}
          label="Starts"
          type="time"
          className="font-mono"
          value={startClock}
          onChange={(event) => setChosenStart(event.target.value)}
        />
        <Select
          id={`${fieldId}-length`}
          label="Length"
          value={String(minutes)}
          onChange={(event) => setMinutes(Number(event.target.value))}
          options={lengthOptions}
        />
      </div>

      {notice}

      <div className="flex justify-end gap-2">
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel} disabled={isSaving}>Cancel</Button>}
        <Button type="button" onClick={schedule} isLoading={isSaving} disabled={!block || hasPassed}>
          Schedule
        </Button>
      </div>
    </div>
  );
}

/** The scheduler on its own, for a task picked from a list. */
export function ScheduleTaskModal({ task, onClose, onScheduled }) {
  return (
    <Modal isOpen={Boolean(task)} onClose={onClose} title="Schedule task" description={task?.title} size="sm">
      {task && (
        <TaskScheduler
          key={task.id}
          task={task}
          onCancel={onClose}
          onScheduled={(event) => {
            onScheduled?.(task, event);
            onClose();
          }}
        />
      )}
    </Modal>
  );
}

import { addDateDays, dateKey, wallDate } from "./calendarTime.js";
import { FOCUS_BLOCK_COLOR } from "./eventDisplay.js";

// Free time is looked for inside the working day, on wall dates in the
// member's timezone: 7 AM until midnight.
export const WORK_START_HOUR = 7;
export const WORK_END_HOUR = 24;

export const BLOCK_LENGTH_OPTIONS = [15, 30, 45, 60, 90, 120, 180, 240];
const DEFAULT_BLOCK_MINUTES = 60;

function isSameLocalDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function roundToNextHalfHour(date) {
  const next = new Date(date);
  const minutes = next.getMinutes();
  next.setSeconds(0, 0);
  if (minutes === 0 || minutes === 30) return next;
  next.setMinutes(minutes < 30 ? 30 : 60);
  return next;
}

/** 9:00 on `date`, or the next half hour when that has passed today. */
export function getDefaultStart(date, timeZone) {
  const start = new Date(date);
  start.setHours(9, 0, 0, 0);

  const now = wallDate(new Date(), timeZone);
  if (isSameLocalDay(start, now) && now > start) {
    return roundToNextHalfHour(now);
  }

  return start;
}

/** Gaps of at least `minMinutes` between the timed events of a working day. */
export function getFreeSlots(date, events, timeZone, { minMinutes = 30, limit = 4 } = {}) {
  const dayStart = new Date(date);
  dayStart.setHours(WORK_START_HOUR, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(WORK_END_HOUR, 0, 0, 0);

  const now = wallDate(new Date(), timeZone);
  const windowStart = isSameLocalDay(dayStart, now) && now > dayStart
    ? roundToNextHalfHour(now)
    : dayStart;

  const busy = events
    .filter((event) => !event.all_day && event.status !== "cancelled")
    .map((event) => ({
      start: wallDate(event.start_time, timeZone),
      end: wallDate(event.end_time, timeZone),
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
    if ((slot.start - cursor) / 60000 >= minMinutes) {
      free.push({ start: cursor, end: slot.start });
    }
    if (slot.end > cursor) cursor = slot.end;
  }
  if ((dayEnd - cursor) / 60000 >= minMinutes) {
    free.push({ start: cursor, end: dayEnd });
  }

  return free.slice(0, limit);
}

/** A block's default length: the task's estimate rounded up to a listed length, at most four hours. */
export function defaultBlockMinutes(task) {
  const estimate = Number(task?.estimated_minutes) || 0;
  if (!estimate) return DEFAULT_BLOCK_MINUTES;
  return BLOCK_LENGTH_OPTIONS.find((minutes) => minutes >= estimate) ?? BLOCK_LENGTH_OPTIONS.at(-1);
}

/** The calendar event that sets time aside for a task. */
export function taskBlockEvent(task, start, end) {
  return {
    title: `Focus: ${task.title}`,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    projectId: task.project_id || null,
    task_ids: [task.id],
    event_color: FOCUS_BLOCK_COLOR,
    status: "scheduled",
    event_type: "focus",
  };
}

/** The day a block falls on, as "Today", "Tomorrow", "Thu" within the week, or "Nov 12". */
export function formatBlockDay(block, timeZone, now = new Date()) {
  const day = dateKey(block.start_time, block.all_day ? "UTC" : timeZone);
  const today = dateKey(now, timeZone);
  if (day === today) return "Today";
  if (day === addDateDays(today, 1)) return "Tomorrow";
  const date = new Date(`${day}T00:00:00Z`);
  const daysAway = (date - new Date(`${today}T00:00:00Z`)) / 86400000;
  if (daysAway > 0 && daysAway < 7) {
    return date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  }
  const sameYear = day.slice(0, 4) === today.slice(0, 4);
  return date.toLocaleDateString("en-US", {
    month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }), timeZone: "UTC",
  });
}

export function formatBlockTime(value, timeZone) {
  return new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone });
}

/** When a task's next block happens, short enough for a task row. */
export function formatBlockWhen(block, timeZone, now = new Date()) {
  if (block.repeats) return "Repeats";
  if (!block.all_day && new Date(block.start_time) <= now) return "Now";
  const day = formatBlockDay(block, timeZone, now);
  return block.all_day ? day : `${day} ${formatBlockTime(block.start_time, timeZone)}`;
}

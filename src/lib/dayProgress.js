import { dateKey, wallDate, zonedInputToDate } from "./calendarTime.js";

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

function nextDateKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

// How far through today the member is, midnight to midnight in their own
// time zone. A day is 23 or 25 hours long when the clocks change.
export function dayProgress(now, timeZone) {
  const key = dateKey(now, timeZone);
  let start;
  let end;
  try {
    start = zonedInputToDate(`${key}T00:00`, timeZone).getTime();
    end = zonedInputToDate(`${nextDateKey(key)}T00:00`, timeZone).getTime();
  } catch {
    // Midnight that doesn't exist on the wall clock: count from the clock instead.
    const wall = wallDate(now, timeZone);
    start = now.getTime() - ((wall.getHours() * 60 + wall.getMinutes()) * 60 + wall.getSeconds()) * 1000;
    end = start + DAY_MS;
  }

  const total = end - start;
  const elapsed = Math.min(Math.max(now.getTime() - start, 0), total);
  return {
    fraction: elapsed / total,
    elapsedMinutes: Math.floor(elapsed / MINUTE_MS),
    remainingMinutes: Math.ceil((total - elapsed) / MINUTE_MS),
  };
}

export function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

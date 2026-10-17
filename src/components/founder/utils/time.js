const DAY_MS = 86_400_000;

/** Value for an `<input type="datetime-local">` in the browser's timezone. */
export function toDateTimeInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

export function getRemainingTime(targetAt, now) {
  if (!targetAt) return null;

  const targetTime = new Date(targetAt).getTime();
  if (Number.isNaN(targetTime)) return null;

  const total = Math.max(0, targetTime - now);
  return {
    days: Math.floor(total / DAY_MS),
    hours: Math.floor((total / 3_600_000) % 24),
    minutes: Math.floor((total / 60_000) % 60),
    seconds: Math.floor((total / 1_000) % 60),
    complete: total === 0,
  };
}

/** Day number since the company start date (Day 1 is the start date itself). */
export function getBuildingDay(startedOn, now = new Date()) {
  if (!startedOn) return null;
  const start = Date.parse(`${startedOn}T00:00:00Z`);
  if (Number.isNaN(start)) return null;
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((today - start) / DAY_MS) + 1;
}

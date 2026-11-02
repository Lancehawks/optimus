// Sprint dates are plain "YYYY-MM-DD" strings. Everything here works in UTC so a
// date never shifts with the browser's timezone.

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_SPRINT_DAYS = 14;
const VELOCITY_WINDOW = 3;

const rangeFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function toUtcMs(date) {
  return Date.parse(`${date}T00:00:00Z`);
}

export function addDays(date, days) {
  return new Date(toUtcMs(date) + days * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(from, to) {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}

export function formatSprintRange(startDate, endDate) {
  return `${rangeFormat.format(toUtcMs(startDate))} – ${rangeFormat.format(toUtcMs(endDate))}`;
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

// How an open sprint stands against today. `overdue` means its end date passed
// and it's waiting to be closed; sprints never close themselves.
export function sprintTimeStatus(sprint, today) {
  if (sprint.status === "planned") {
    const untilStart = daysBetween(today, sprint.start_date);
    return { label: untilStart > 0 ? `Starts in ${plural(untilStart, "day")}` : "Ready to start", overdue: false };
  }
  const left = daysBetween(today, sprint.end_date);
  if (left > 0) return { label: `${plural(left, "day")} left`, overdue: false };
  if (left === 0) return { label: "Ends today", overdue: false };
  return { label: `Ended ${plural(-left, "day")} ago`, overdue: true };
}

// A new sprint picks up the day after the last open one ends, or today.
export function nextSprintDefaults(sprints, today) {
  const lastEnd = sprints
    .filter((sprint) => sprint.status !== "completed")
    .map((sprint) => sprint.end_date)
    .sort()
    .at(-1);
  const startDate = lastEnd && lastEnd >= today ? addDays(lastEnd, 1) : today;
  return {
    name: `Sprint ${sprints.length + 1}`,
    goal: "",
    startDate,
    endDate: addDays(startDate, DEFAULT_SPRINT_DAYS - 1),
  };
}

// Tasks finished per sprint over the most recent closed sprints. Expects them
// newest first, as the API returns them.
export function averageVelocity(completedSprints) {
  const recent = completedSprints.slice(0, VELOCITY_WINDOW);
  if (recent.length === 0) return null;
  const total = recent.reduce((sum, sprint) => sum + sprint.done_count, 0);
  return Math.round((total / recent.length) * 10) / 10;
}

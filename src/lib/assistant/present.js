// Small formatting helpers shared by the assistant's lookups and its actions.

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatDay(key) {
  if (!key) return null;
  return `${WEEKDAYS[new Date(`${key}T00:00:00Z`).getUTCDay()]} ${key}`;
}

// Drops empty fields so results stay short. Zero counts and empty top-level
// lists are kept: they tell the model there is nothing, rather than nothing known.
export function compact(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== null && value !== undefined && value !== "")
  );
}

export function taskHref(id) {
  return `/tasks?task_id=${id}`;
}

export function noteHref(row) {
  const params = new URLSearchParams({ ...(row.project_id ? { project_id: row.project_id } : {}), note_id: row.id });
  return `/notes?${params.toString()}`;
}

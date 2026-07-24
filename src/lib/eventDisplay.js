export const EVENT_COLOR_OPTIONS = [
  { name: "Ocean", value: "#0d6b88" },
  { name: "Cobalt", value: "#3868c6" },
  { name: "Sky", value: "#3598b0" },
  { name: "Jade", value: "#27836c" },
  { name: "Violet", value: "#745388" },
  { name: "Coral", value: "#cf5c63" },
  { name: "Rose", value: "#a85078" },
  { name: "Yellow", value: "#d2a526" },
  { name: "Amber", value: "#c7832c" },
  { name: "Slate", value: "#676c66" },
];

export const EVENT_STATUS_OPTIONS = [
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "missed", label: "Missed" },
  { value: "cancelled", label: "Cancelled" },
];

export const EVENT_STATUS_META = {
  scheduled: { label: "Scheduled", color: null, className: "bg-brand-500/15 text-brand-300" },
  in_progress: { label: "In progress", color: null, className: "bg-blue-500/15 text-blue-300" },
  done: { label: "Done", color: "#22c55e", className: "bg-green-500/15 text-green-400" },
  missed: { label: "Missed", color: "#ef4444", className: "bg-red-500/15 text-red-400" },
  cancelled: { label: "Cancelled", color: "#64748b", className: "bg-surface-tertiary text-muted" },
};

export const DEFAULT_EVENT_COLOR = EVENT_COLOR_OPTIONS[0].value;
export const FOCUS_BLOCK_COLOR = "#27836c";

export function getLinkedTaskCompletion(event) {
  const tasks = Array.isArray(event?.linked_tasks) ? event.linked_tasks : [];
  const done = tasks.filter((task) => task.status === "done").length;
  return {
    total: tasks.length,
    done,
    allDone: tasks.length > 0 && done === tasks.length,
    hasOpen: tasks.length > 0 && done < tasks.length,
  };
}

export function getEventDisplayStatus(event, now = new Date()) {
  const status = event?.status || "scheduled";
  if (status === "cancelled" || status === "done" || status === "missed") return status;

  const taskCompletion = getLinkedTaskCompletion(event);
  if (taskCompletion.allDone) return "done";

  if (event?.start_time && event?.end_time) {
    const start = new Date(event.start_time);
    const end = new Date(event.end_time);
    if (end < now) return "missed";
    if (now >= start && now <= end) return "in_progress";
  }

  if (status === "in_progress") return "in_progress";
  return "scheduled";
}

export function getEventDisplayColor(event, fallback = DEFAULT_EVENT_COLOR) {
  const status = getEventDisplayStatus(event);
  const statusColor = EVENT_STATUS_META[status]?.color;
  return statusColor || event?.calendar_color || event?.event_color || fallback;
}

export function getEventStatusMeta(event) {
  return EVENT_STATUS_META[getEventDisplayStatus(event)] || EVENT_STATUS_META.scheduled;
}

export function isEventStatusLit(event) {
  const status = getEventDisplayStatus(event);
  return status === "done" || status === "missed";
}

export function formatTimeRange(start, end) {
  const options = { hour: "numeric", minute: "2-digit" };
  return `${new Date(start).toLocaleTimeString([], options)} - ${new Date(end).toLocaleTimeString([], options)}`;
}

import { normalizeNotificationPreferences } from "@/lib/notificationPreferences";

export function notificationPreferenceSqlClause(alias, preferences) {
  const prefs = normalizeNotificationPreferences(preferences);
  const prefix = alias ? `${alias}.` : "";
  const clauses = [];

  if (!prefs.projectActivity) {
    clauses.push(`${prefix}type <> 'project_activity'`);
  }

  if (!prefs.taskReminders) {
    clauses.push(`NOT (${prefix}type = 'time_alert' AND ${prefix}metadata->>'source' = 'task_due')`);
  }

  if (!prefs.eventReminders) {
    clauses.push(`NOT (${prefix}type = 'time_alert' AND ${prefix}metadata->>'source' = 'event_time')`);
  }

  return clauses.length > 0 ? `AND ${clauses.join(" AND ")}` : "";
}

export function normalizeNotificationStatus(status) {
  return ["all", "read", "unread"].includes(status) ? status : "all";
}

export function normalizeNotificationLimit(limit, fallback = 50) {
  return Math.min(Math.max(Number(limit) || fallback, 1), 100);
}

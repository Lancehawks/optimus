import { normalizeNotificationPreferences } from "@/lib/notificationPreferences";

export function notificationPreferenceSqlClause(alias, preferences) {
  const prefs = normalizeNotificationPreferences(preferences);
  const prefix = alias ? `${alias}.` : "";
  const clauses = [
    `${prefix}type IN ('project_activity', 'project_invitation')`,
  ];

  if (!prefs.projectActivity) {
    clauses.push(`${prefix}type <> 'project_activity'`);
  }

  return `AND ${clauses.join(" AND ")}`;
}

export function normalizeNotificationStatus(status) {
  return ["all", "read", "unread"].includes(status) ? status : "all";
}

export function normalizeNotificationLimit(limit, fallback = 50) {
  return Math.min(Math.max(Number(limit) || fallback, 1), 100);
}

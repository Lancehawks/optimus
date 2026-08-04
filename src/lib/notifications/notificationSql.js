export function notificationPreferenceSqlClause(alias) {
  const prefix = alias ? `${alias}.` : "";
  return `AND ${prefix}type IN ('project_invitation', 'project_invitation_accepted')`;
}

export function normalizeNotificationStatus(status) {
  return ["all", "read", "unread"].includes(status) ? status : "all";
}

export function normalizeNotificationLimit(limit, fallback = 50) {
  return Math.min(Math.max(Number(limit) || fallback, 1), 100);
}

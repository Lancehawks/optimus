const SHARED_EVENT_FALLBACK_COLOR = "#0d6b88";

function toProjectSet(projectIds = []) {
  if (projectIds instanceof Set) return projectIds;
  return new Set(Array.isArray(projectIds) ? projectIds : []);
}

export function isSharedProjectEventForViewer(event, viewerId) {
  return Boolean(event?.project_id && event?.user_id && event.user_id !== viewerId);
}

export function canEditEventStatus(event, viewerId) {
  return Boolean(event?.user_id && event.user_id === viewerId);
}

export function canViewEventForViewer(event, viewerId, memberProjectIds = []) {
  if (!event || !viewerId) return false;
  if (!event.project_id) return event.user_id === viewerId;
  return toProjectSet(memberProjectIds).has(event.project_id);
}

export function sanitizeEventForViewer(event, viewerId) {
  if (!event || !isSharedProjectEventForViewer(event, viewerId)) return event;

  const sanitized = { ...event };
  const projectName = event.project_name || "Shared project";
  const projectColor = event.project_color || SHARED_EVENT_FALLBACK_COLOR;

  sanitized.calendar_id = null;
  sanitized.calendar_name = projectName;
  sanitized.calendar_color = projectColor;
  sanitized.google_event_id = undefined;
  sanitized.google_rrule = undefined;
  sanitized.synced_at = undefined;

  return sanitized;
}

export function sanitizeEventsForViewer(events, viewerId) {
  return Array.isArray(events)
    ? events.map((event) => sanitizeEventForViewer(event, viewerId))
    : [];
}

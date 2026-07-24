const EVENT_STATUSES = new Set(["scheduled", "in_progress", "done", "missed", "cancelled"]);
const EVENT_TYPES = new Set(["event", "focus", "time_block"]);
const RESERVED_EVENT_COLORS = new Set(["#ef4444", "#dc2626", "#b91c1c", "#22c55e", "#16a34a", "#15803d"]);
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export function normalizeEventColor(color) {
  if (!color) return null;
  const normalized = color.trim().toLowerCase();
  return HEX_COLOR_RE.test(normalized) ? normalized : null;
}

export function isReservedEventColor(color) {
  const normalized = normalizeEventColor(color);
  return !!normalized && RESERVED_EVENT_COLORS.has(normalized);
}

export function validateEventMeta({ eventColor, status, eventType }) {
  const normalizedColor = normalizeEventColor(eventColor);
  if (eventColor && !normalizedColor) {
    return { error: "Choose a valid event color" };
  }
  if (normalizedColor && isReservedEventColor(normalizedColor)) {
    return { error: "Red and green are reserved for event status" };
  }
  if (status && !EVENT_STATUSES.has(status)) {
    return { error: "Invalid event status" };
  }
  if (eventType && !EVENT_TYPES.has(eventType)) {
    return { error: "Invalid event type" };
  }
  return {
    eventColor: normalizedColor,
    status: status || "scheduled",
    eventType: eventType || "event",
  };
}

export function eventColorSql(viewerParam) {
  // Keep this as the event identity color only. Done/missed colors are derived
  // in the UI after recurrence expansion so each rendered occurrence is correct.
  return `CASE
          WHEN e.event_color IS NOT NULL THEN e.event_color
          WHEN e.project_id IS NOT NULL AND e.user_id <> ${viewerParam} THEN COALESCE(p.color, '#0d6b88')
          ELSE c.color
        END`;
}

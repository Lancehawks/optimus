import { query } from "@/lib/db";
import { eventColorSql } from "@/lib/eventServerUtils";
import { projectOwnerCondition, projectScopedAccessCondition } from "@/lib/projectAccess";

function eventViewerSelect(viewerParam = "$1") {
  return `e.id,
        CASE WHEN e.user_id = ${viewerParam} THEN e.calendar_id ELSE NULL END AS calendar_id,
        e.user_id,
        ${projectOwnerCondition("e", viewerParam)} AS is_project_owner,
        e.title,
        e.description,
        e.location,
        e.start_time,
        e.end_time,
        e.all_day,
        e.recurrence_rule,
        e.project_id,
        e.event_color,
        COALESCE(e.status, 'scheduled') AS status,
        COALESCE(e.event_type, 'event') AS event_type,
        CASE WHEN e.user_id = ${viewerParam} THEN e.google_event_id ELSE NULL END AS google_event_id,
        CASE WHEN e.user_id = ${viewerParam} THEN e.google_rrule ELSE NULL END AS google_rrule,
        CASE WHEN e.user_id = ${viewerParam} THEN e.synced_at ELSE NULL END AS synced_at,
        e.created_at,
        e.updated_at,
        ${eventColorSql(viewerParam)} AS calendar_color,
        CASE
          WHEN e.project_id IS NOT NULL AND e.user_id <> ${viewerParam} THEN COALESCE(p.name, 'Shared project')
          ELSE c.name
        END AS calendar_name,
        p.name AS project_name,
        p.color AS project_color`;
}

const CURRENT_EVENT_SELECT = `e.id,
     e.user_id,
     e.calendar_id,
     e.project_id,
     e.title,
     e.start_time,
     e.end_time,
     e.recurrence_rule,
     COALESCE(e.status, 'scheduled') AS status`;

export async function findEventForViewer(userId, eventId) {
  const result = await query(
    `SELECT ${eventViewerSelect("$1")}
     FROM events e
     JOIN calendars c ON c.id = e.calendar_id
     LEFT JOIN projects p ON p.id = e.project_id
     WHERE ${projectScopedAccessCondition("e")} AND e.id = $2`,
    [userId, eventId]
  );

  return result.rows[0] || null;
}

export async function listNonRecurringEventsForRange({
  userId,
  rangeStart,
  rangeEnd,
  calendarId,
}) {
  const params = [userId, rangeStart.toISOString(), rangeEnd.toISOString()];
  let calendarFilter = "";
  if (calendarId) {
    calendarFilter = " AND e.calendar_id = $4";
    params.push(calendarId);
  }

  const result = await query(
    `SELECT ${eventViewerSelect("$1")}
     FROM events e
     JOIN calendars c ON c.id = e.calendar_id
     LEFT JOIN projects p ON p.id = e.project_id
     WHERE ${projectScopedAccessCondition("e")}
       AND e.recurrence_rule IS NULL
       AND e.start_time < $3
       AND e.end_time > $2
       ${calendarFilter}
     ORDER BY e.start_time ASC`,
    params
  );

  return result.rows;
}

export async function listRecurringEventMastersForRange({
  userId,
  rangeEnd,
  calendarId,
}) {
  const params = [userId, rangeEnd.toISOString()];
  let calendarFilter = "";
  if (calendarId) {
    calendarFilter = " AND e.calendar_id = $3";
    params.push(calendarId);
  }

  const result = await query(
    `SELECT ${eventViewerSelect("$1")}
     FROM events e
     JOIN calendars c ON c.id = e.calendar_id
     LEFT JOIN projects p ON p.id = e.project_id
     WHERE ${projectScopedAccessCondition("e")}
       AND e.recurrence_rule IS NOT NULL
       AND e.start_time <= $2
       ${calendarFilter}`,
    params
  );

  return result.rows;
}

export async function findCurrentEventForViewer(userId, eventId) {
  const existing = await query(
    `SELECT ${CURRENT_EVENT_SELECT}
     FROM events e
     WHERE ${projectScopedAccessCondition("e")} AND e.id = $2`,
    [userId, eventId]
  );

  return existing.rows[0] || null;
}

export async function listLinkedTasksForEvent(userId, eventId) {
  const linkedTasks = await query(
    `SELECT t.id, t.title, t.status, t.priority
     FROM event_tasks et JOIN tasks t ON t.id = et.task_id
     WHERE ${projectScopedAccessCondition("t")} AND et.event_id = $2`,
    [userId, eventId]
  );

  return linkedTasks.rows;
}

export async function listLinkedTasksForEvents(userId, eventIds) {
  if (!Array.isArray(eventIds) || eventIds.length === 0) return {};

  const linkedTasksResult = await query(
    `SELECT et.event_id, t.id, t.title, t.status, t.priority
     FROM event_tasks et
     JOIN tasks t ON t.id = et.task_id
     WHERE ${projectScopedAccessCondition("t")}
       AND et.event_id = ANY($2::uuid[])`,
    [userId, eventIds]
  );

  return linkedTasksResult.rows.reduce((tasksByEvent, row) => {
    if (!tasksByEvent[row.event_id]) tasksByEvent[row.event_id] = [];
    tasksByEvent[row.event_id].push({
      id: row.id,
      title: row.title,
      status: row.status,
      priority: row.priority,
    });
    return tasksByEvent;
  }, {});
}

export async function findEventWithGoogleCalendar(eventId) {
  const event = await query(
    `SELECT e.id, e.user_id, c.google_calendar_id
     FROM events e
     JOIN calendars c ON c.id = e.calendar_id
     WHERE e.id = $1`,
    [eventId]
  );

  return event.rows[0] || null;
}

export async function userOwnsCalendar(userId, calendarId) {
  const result = await query(
    "SELECT id FROM calendars WHERE id = $1 AND user_id = $2",
    [calendarId, userId]
  );

  return result.rows.length > 0;
}

export async function findDefaultCalendarForUser(userId) {
  const result = await query(
    "SELECT id FROM calendars WHERE user_id = $1 AND is_default = true LIMIT 1",
    [userId]
  );

  return result.rows[0] || null;
}

export async function createDefaultCalendarForUser(userId) {
  const result = await query(
    `INSERT INTO calendars (user_id, name, color, is_default)
     VALUES ($1, 'My Calendar', '#6366f1', true)
     RETURNING id`,
    [userId]
  );

  return result.rows[0] || null;
}

export async function createEventRecord({
  userId,
  calendarId,
  title,
  description,
  location,
  startTime,
  endTime,
  allDay,
  recurrenceRule,
  projectId,
  eventColor,
  status,
  eventType,
}) {
  const result = await query(
    `INSERT INTO events (user_id, calendar_id, title, description, location, start_time, end_time, all_day, recurrence_rule, project_id, event_color, status, event_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING id`,
    [
      userId,
      calendarId,
      title,
      description || null,
      location || null,
      startTime,
      endTime,
      allDay || false,
      recurrenceRule || null,
      projectId,
      eventColor,
      status,
      eventType,
    ]
  );

  return result.rows[0] || null;
}

export async function updateEventFields({ eventId, fields, values, paramIndex }) {
  await query(
    `UPDATE events SET ${fields.join(", ")}
     WHERE id = $${paramIndex}
     RETURNING id`,
    [...values, eventId]
  );
}

export async function replaceLinkedTasksForEvent({
  userId,
  eventId,
  taskIds,
  projectId,
}) {
  if (taskIds === undefined) return;

  await query("DELETE FROM event_tasks WHERE event_id = $1", [eventId]);

  if (!taskIds || taskIds.length === 0) return;

  const validTasks = await query(
    `SELECT t.id
     FROM tasks t
     WHERE ${projectScopedAccessCondition("t")}
       AND t.id = ANY($2::uuid[])
       ${projectId ? "AND t.project_id = $3" : ""}`,
    projectId
      ? [userId, taskIds, projectId]
      : [userId, taskIds]
  );
  const validIds = validTasks.rows.map((row) => row.id);
  if (validIds.length === 0) return;

  const valuesClause = validIds
    .map((_, index) => `($1, $${index + 2})`)
    .join(", ");
  await query(
    `INSERT INTO event_tasks (event_id, task_id) VALUES ${valuesClause}`,
    [eventId, ...validIds]
  );
}

export async function findEventForDelete(userId, eventId) {
  const eventRow = await query(
    `SELECT e.id, e.user_id, e.project_id, e.title, e.google_event_id, c.google_calendar_id
     FROM events e
     JOIN calendars c ON c.id = e.calendar_id
     WHERE ${projectScopedAccessCondition("e")} AND e.id = $2`,
    [userId, eventId]
  );

  return eventRow.rows[0] || null;
}

export async function deleteEventForOwner(eventId) {
  await query("DELETE FROM events WHERE id = $1", [eventId]);
}

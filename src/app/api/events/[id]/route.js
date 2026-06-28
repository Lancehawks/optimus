import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { recordProjectActivity } from "@/lib/collaborationActivity";
import { getMasterEventId } from "@/lib/recurrence";
import { pushEventToGoogle, deleteEventFromGoogle } from "@/lib/googleSync";
import { getProjectForMember, projectScopedAccessCondition } from "@/lib/projectAccess";

export const GET = withAuth(async (request, { params }) => {
  const { id } = await params;
  const masterId = getMasterEventId(id);

  const result = await query(
    `SELECT e.*,
        CASE
          WHEN e.project_id IS NOT NULL AND e.user_id <> $1 THEN COALESCE(p.color, '#6366f1')
          ELSE c.color
        END AS calendar_color,
        CASE
          WHEN e.project_id IS NOT NULL AND e.user_id <> $1 THEN COALESCE(p.name, 'Shared project')
          ELSE c.name
        END AS calendar_name,
        p.name AS project_name, p.color AS project_color
     FROM events e
     JOIN calendars c ON c.id = e.calendar_id
     LEFT JOIN projects p ON p.id = e.project_id
     WHERE ${projectScopedAccessCondition("e")} AND e.id = $2`,
    [request.user.id, masterId]
  );

  if (result.rows.length === 0) {
    return apiError("Event not found", 404);
  }

  // Fetch linked tasks
  const linkedTasks = await query(
    `SELECT t.id, t.title, t.status, t.priority
     FROM event_tasks et JOIN tasks t ON t.id = et.task_id
     WHERE ${projectScopedAccessCondition("t")} AND et.event_id = $2`,
    [request.user.id, masterId]
  );

  return apiResponse({ event: { ...result.rows[0], linked_tasks: linkedTasks.rows } });
});

export const PUT = withAuth(async (request, { params }) => {
  const { id } = await params;
  const masterId = getMasterEventId(id);
  const body = await request.json();
  const {
    title,
    description,
    location,
    start_time,
    end_time,
    all_day,
    recurrence_rule,
    calendar_id,
    task_ids,
    project_id,
    projectId,
  } = body;
  const requestedProjectId = project_id !== undefined ? project_id : projectId;

  // Verify personal ownership or shared project membership.
  const existing = await query(
    `SELECT e.*
     FROM events e
     WHERE ${projectScopedAccessCondition("e")} AND e.id = $2`,
    [request.user.id, masterId]
  );
  if (existing.rows.length === 0) {
    return apiError("Event not found", 404);
  }
  const currentEvent = existing.rows[0];

  if (currentEvent.user_id !== request.user.id) {
    return apiError("Only the event creator can edit this event", 403);
  }

  const effectiveProjectId = requestedProjectId !== undefined
    ? requestedProjectId || null
    : currentEvent.project_id;

  if (requestedProjectId !== undefined) {
    if (effectiveProjectId) {
      const project = await getProjectForMember(request.user.id, effectiveProjectId);
      if (!project) {
        return apiError("Project not found", 404);
      }
    } else if (currentEvent.user_id !== request.user.id) {
      return apiError("Only the event creator can move it back to personal events", 403);
    }
  }

  // If changing calendar, verify new calendar ownership. Keeping another
  // member's existing project-event calendar is allowed.
  if (calendar_id && calendar_id !== currentEvent.calendar_id) {
    const calCheck = await query(
      "SELECT id FROM calendars WHERE id = $1 AND user_id = $2",
      [calendar_id, request.user.id]
    );
    if (calCheck.rows.length === 0) {
      return apiError("Calendar not found", 404);
    }
  }

  const fields = [];
  const values = [];
  let paramIndex = 1;

  if (title !== undefined) {
    fields.push(`title = $${paramIndex++}`);
    values.push(title.trim());
  }
  if (description !== undefined) {
    fields.push(`description = $${paramIndex++}`);
    values.push(description || null);
  }
  if (location !== undefined) {
    fields.push(`location = $${paramIndex++}`);
    values.push(location || null);
  }
  if (start_time !== undefined) {
    fields.push(`start_time = $${paramIndex++}`);
    values.push(new Date(start_time).toISOString());
  }
  if (end_time !== undefined) {
    fields.push(`end_time = $${paramIndex++}`);
    values.push(new Date(end_time).toISOString());
  }
  if (all_day !== undefined) {
    fields.push(`all_day = $${paramIndex++}`);
    values.push(all_day);
  }
  if (recurrence_rule !== undefined) {
    fields.push(`recurrence_rule = $${paramIndex++}`);
    values.push(recurrence_rule || null);
  }
  if (calendar_id !== undefined) {
    fields.push(`calendar_id = $${paramIndex++}`);
    values.push(calendar_id);
  }
  if (requestedProjectId !== undefined) {
    fields.push(`project_id = $${paramIndex++}`);
    values.push(effectiveProjectId);
  }

  if (fields.length === 0) {
    return apiError("No fields to update");
  }

  fields.push(`updated_at = NOW()`);
  values.push(masterId);

  const result = await query(
    `UPDATE events SET ${fields.join(", ")}
     WHERE id = $${paramIndex}
     RETURNING *`,
    values
  );

  // Fetch with calendar info
  const event = await query(
    `SELECT e.*, c.color AS calendar_color, c.name AS calendar_name, c.google_calendar_id
     FROM events e
     JOIN calendars c ON c.id = e.calendar_id
     WHERE e.id = $1`,
    [masterId]
  );

  // Update linked tasks if provided
  if (task_ids !== undefined) {
    await query("DELETE FROM event_tasks WHERE event_id = $1", [masterId]);
    if (task_ids && task_ids.length > 0) {
      const validTasks = await query(
        `SELECT t.id
         FROM tasks t
         WHERE ${projectScopedAccessCondition("t")}
           AND t.id = ANY($2::uuid[])
           ${effectiveProjectId ? "AND t.project_id = $3" : ""}`,
        effectiveProjectId
          ? [request.user.id, task_ids, effectiveProjectId]
          : [request.user.id, task_ids]
      );
      const validIds = validTasks.rows.map((r) => r.id);
      if (validIds.length > 0) {
        const valuesClause = validIds
          .map((_, i) => `($1, $${i + 2})`)
          .join(", ");
        await query(
          `INSERT INTO event_tasks (event_id, task_id) VALUES ${valuesClause}`,
          [masterId, ...validIds]
        );
      }
    }
  }

  // Fetch linked tasks for the response
  const linkedTasks = await query(
    `SELECT t.id, t.title, t.status, t.priority
     FROM event_tasks et JOIN tasks t ON t.id = et.task_id
     WHERE ${projectScopedAccessCondition("t")} AND et.event_id = $2`,
    [request.user.id, masterId]
  );

  // Push update to Google if this is a Google-linked calendar
  let googleError = null;
  if (event.rows[0]?.google_calendar_id && event.rows[0]?.user_id === request.user.id) {
    try {
      await pushEventToGoogle(request.user.id, masterId);
    } catch (err) {
      console.error("Google push error:", err);
      googleError = err.message || "Failed to sync to Google Calendar";
    }
  }

  // Re-fetch to include google_event_id set by push
  const finalEvent = await query(
    `SELECT e.*,
        CASE
          WHEN e.project_id IS NOT NULL AND e.user_id <> $2 THEN COALESCE(p.color, '#6366f1')
          ELSE c.color
        END AS calendar_color,
        CASE
          WHEN e.project_id IS NOT NULL AND e.user_id <> $2 THEN COALESCE(p.name, 'Shared project')
          ELSE c.name
        END AS calendar_name,
        p.name AS project_name, p.color AS project_color
     FROM events e JOIN calendars c ON c.id = e.calendar_id
     LEFT JOIN projects p ON p.id = e.project_id
     WHERE e.id = $1`,
    [masterId, request.user.id]
  );

  const updatedEvent = finalEvent.rows[0];
  if (requestedProjectId !== undefined && currentEvent.project_id && !effectiveProjectId) {
    await recordProjectActivity({
      projectId: currentEvent.project_id,
      actorUserId: request.user.id,
      action: "moved_to_personal",
      entityType: "event",
      entityId: currentEvent.id,
      entityTitle: currentEvent.title,
    });
  } else if (effectiveProjectId) {
    await recordProjectActivity({
      projectId: effectiveProjectId,
      actorUserId: request.user.id,
      action: requestedProjectId !== undefined && currentEvent.project_id !== effectiveProjectId
        ? "moved_to_project"
        : "updated",
      entityType: "event",
      entityId: updatedEvent.id,
      entityTitle: updatedEvent.title,
    });
  }

  return apiResponse({ event: { ...finalEvent.rows[0], linked_tasks: linkedTasks.rows }, googleError });
});

export const DELETE = withAuth(async (request, { params }) => {
  const { id } = await params;
  const masterId = getMasterEventId(id);

  // Fetch event's Google IDs before deleting
  const eventRow = await query(
    `SELECT e.id, e.user_id, e.project_id, e.title, e.google_event_id, c.google_calendar_id
     FROM events e
     JOIN calendars c ON c.id = e.calendar_id
     WHERE ${projectScopedAccessCondition("e")} AND e.id = $2`,
    [request.user.id, masterId]
  );

  if (eventRow.rows.length === 0) {
    return apiError("Event not found", 404);
  }

  if (eventRow.rows[0].user_id !== request.user.id) {
    return apiError("Only the event creator can delete this event", 403);
  }

  const event = eventRow.rows[0];

  await query(
    "DELETE FROM events WHERE id = $1 AND user_id = $2",
    [masterId, request.user.id]
  );

  if (event.project_id) {
    await recordProjectActivity({
      projectId: event.project_id,
      actorUserId: request.user.id,
      action: "deleted",
      entityType: "event",
      entityId: event.id,
      entityTitle: event.title,
    });
  }

  // Delete from Google if it was a Google event
  if (
    eventRow.rows[0]?.user_id === request.user.id &&
    eventRow.rows[0]?.google_event_id &&
    eventRow.rows[0]?.google_calendar_id
  ) {
    deleteEventFromGoogle(
      request.user.id,
      eventRow.rows[0].google_event_id,
      eventRow.rows[0].google_calendar_id
    ).catch((err) => console.error("Google delete error:", err));
  }

  return apiResponse({ message: "Event deleted" });
});

import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { recordProjectActivity } from "@/lib/collaborationActivity";
import { expandRecurrences } from "@/lib/recurrence";
import { pushEventToGoogle } from "@/lib/googleSync";
import { getProjectForMember, projectScopedAccessCondition } from "@/lib/projectAccess";

export const GET = withAuth(async (request) => {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const calendarId = searchParams.get("calendar_id");

  if (!start || !end) {
    return apiError("start and end query parameters are required");
  }

  const rangeStart = new Date(start);
  const rangeEnd = new Date(end);

  // 1. Fetch non-recurring events overlapping the range
  const nonRecurringParams = [request.user.id, rangeStart.toISOString(), rangeEnd.toISOString()];
  let nonRecurringFilter = "";
  if (calendarId) {
    nonRecurringFilter = " AND e.calendar_id = $4";
    nonRecurringParams.push(calendarId);
  }

  const nonRecurring = await query(
    `SELECT e.*, c.color AS calendar_color, c.name AS calendar_name, p.name AS project_name, p.color AS project_color
     FROM events e
     JOIN calendars c ON c.id = e.calendar_id
     LEFT JOIN projects p ON p.id = e.project_id
     WHERE ${projectScopedAccessCondition("e")}
       AND e.recurrence_rule IS NULL
       AND e.start_time < $3
       AND e.end_time > $2
       ${nonRecurringFilter}
     ORDER BY e.start_time ASC`,
    nonRecurringParams
  );

  // 2. Fetch recurring event masters created before range end
  const recurringParams = [request.user.id, rangeEnd.toISOString()];
  let recurringFilter = "";
  if (calendarId) {
    recurringFilter = " AND e.calendar_id = $3";
    recurringParams.push(calendarId);
  }

  const recurringMasters = await query(
    `SELECT e.*, c.color AS calendar_color, c.name AS calendar_name, p.name AS project_name, p.color AS project_color
     FROM events e
     JOIN calendars c ON c.id = e.calendar_id
     LEFT JOIN projects p ON p.id = e.project_id
     WHERE ${projectScopedAccessCondition("e")}
       AND e.recurrence_rule IS NOT NULL
       AND e.start_time <= $2
       ${recurringFilter}`,
    recurringParams
  );

  // 3. Expand recurring events into virtual instances
  const recurringInstances = expandRecurrences(
    recurringMasters.rows,
    rangeStart,
    rangeEnd
  );

  // 4. Merge and sort
  const allEvents = [...nonRecurring.rows, ...recurringInstances].sort(
    (a, b) => new Date(a.start_time) - new Date(b.start_time)
  );

  // 5. Batch-fetch linked tasks for all events
  const masterEventIds = [
    ...new Set(allEvents.map((e) => e._masterEventId || e.id)),
  ];
  if (masterEventIds.length > 0) {
    const linkedTasksResult = await query(
      `SELECT et.event_id, t.id, t.title, t.status, t.priority
       FROM event_tasks et
       JOIN tasks t ON t.id = et.task_id
       WHERE ${projectScopedAccessCondition("t")}
         AND et.event_id = ANY($2::uuid[])`,
      [request.user.id, masterEventIds]
    );

    const tasksByEvent = {};
    for (const row of linkedTasksResult.rows) {
      if (!tasksByEvent[row.event_id]) tasksByEvent[row.event_id] = [];
      tasksByEvent[row.event_id].push({
        id: row.id,
        title: row.title,
        status: row.status,
        priority: row.priority,
      });
    }

    for (const event of allEvents) {
      const key = event._masterEventId || event.id;
      event.linked_tasks = tasksByEvent[key] || [];
    }
  } else {
    for (const event of allEvents) {
      event.linked_tasks = [];
    }
  }

  return apiResponse({ events: allEvents });
});

export const POST = withAuth(async (request) => {
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
  const targetProjectId = project_id || projectId || null;

  if (!title || !title.trim()) {
    return apiError("Title is required");
  }
  if (!start_time || !end_time) {
    return apiError("Start and end times are required");
  }

  const startDate = new Date(start_time);
  const endDate = new Date(end_time);
  if (!all_day && endDate <= startDate) {
    return apiError("End time must be after start time");
  }

  if (targetProjectId) {
    const project = await getProjectForMember(request.user.id, targetProjectId);
    if (!project) {
      return apiError("Project not found", 404);
    }
  }

  // Resolve calendar — use provided or default
  let resolvedCalendarId = calendar_id;
  if (!resolvedCalendarId) {
    const defaultCal = await query(
      "SELECT id FROM calendars WHERE user_id = $1 AND is_default = true LIMIT 1",
      [request.user.id]
    );
    if (defaultCal.rows.length === 0) {
      // Auto-create default calendar
      const newCal = await query(
        `INSERT INTO calendars (user_id, name, color, is_default)
         VALUES ($1, 'My Calendar', '#6366f1', true)
         RETURNING id`,
        [request.user.id]
      );
      resolvedCalendarId = newCal.rows[0].id;
    } else {
      resolvedCalendarId = defaultCal.rows[0].id;
    }
  } else {
    // Verify calendar ownership
    const calCheck = await query(
      "SELECT id FROM calendars WHERE id = $1 AND user_id = $2",
      [calendar_id, request.user.id]
    );
    if (calCheck.rows.length === 0) {
      return apiError("Calendar not found", 404);
    }
  }

  const result = await query(
    `INSERT INTO events (user_id, calendar_id, title, description, location, start_time, end_time, all_day, recurrence_rule, project_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      request.user.id,
      resolvedCalendarId,
      title.trim(),
      description || null,
      location || null,
      startDate.toISOString(),
      endDate.toISOString(),
      all_day || false,
      recurrence_rule || null,
      targetProjectId,
    ]
  );

  // Fetch with calendar info
  const event = await query(
    `SELECT e.*, c.color AS calendar_color, c.name AS calendar_name, c.google_calendar_id
     FROM events e
     JOIN calendars c ON c.id = e.calendar_id
     WHERE e.id = $1`,
    [result.rows[0].id]
  );

  // Link tasks if provided
  const eventId = result.rows[0].id;
  if (task_ids && task_ids.length > 0) {
    const taskParams = [request.user.id, task_ids];
    let taskProjectClause = "";
    if (targetProjectId) {
      taskProjectClause = "AND t.project_id = $3";
      taskParams.push(targetProjectId);
    }

    const validTasks = await query(
      `SELECT t.id
       FROM tasks t
       WHERE ${projectScopedAccessCondition("t")}
         AND t.id = ANY($2::uuid[])
         ${taskProjectClause}`,
      taskParams
    );
    const validIds = validTasks.rows.map((r) => r.id);
    if (validIds.length > 0) {
      const valuesClause = validIds
        .map((_, i) => `($1, $${i + 2})`)
        .join(", ");
      await query(
        `INSERT INTO event_tasks (event_id, task_id) VALUES ${valuesClause}`,
        [eventId, ...validIds]
      );
    }
  }

  // Fetch linked tasks for the response
  const linkedTasksResult = await query(
    `SELECT t.id, t.title, t.status, t.priority
     FROM event_tasks et JOIN tasks t ON t.id = et.task_id
     WHERE ${projectScopedAccessCondition("t")} AND et.event_id = $2`,
    [request.user.id, eventId]
  );

  // Push to Google if this is a Google-linked calendar
  let googleError = null;
  if (event.rows[0].google_calendar_id) {
    try {
      await pushEventToGoogle(request.user.id, eventId);
    } catch (err) {
      console.error("Google push error:", err);
      googleError = err.message || "Failed to sync to Google Calendar";
    }
  }

  // Re-fetch to include google_event_id set by push
  const finalEvent = await query(
    `SELECT e.*, c.color AS calendar_color, c.name AS calendar_name, p.name AS project_name, p.color AS project_color
     FROM events e JOIN calendars c ON c.id = e.calendar_id
     LEFT JOIN projects p ON p.id = e.project_id
     WHERE e.id = $1`,
    [eventId]
  );

  if (targetProjectId) {
    await recordProjectActivity({
      projectId: targetProjectId,
      actorUserId: request.user.id,
      action: "created",
      entityType: "event",
      entityId: eventId,
      entityTitle: title.trim(),
    });
  }

  return apiResponse({ event: { ...finalEvent.rows[0], linked_tasks: linkedTasksResult.rows }, googleError }, 201);
});

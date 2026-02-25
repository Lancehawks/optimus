import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { getMasterEventId } from "@/lib/recurrence";
import { pushEventToGoogle, deleteEventFromGoogle } from "@/lib/googleSync";

export const GET = withAuth(async (request, { params }) => {
  const { id } = await params;
  const masterId = getMasterEventId(id);

  const result = await query(
    `SELECT e.*, c.color AS calendar_color, c.name AS calendar_name
     FROM events e
     JOIN calendars c ON c.id = e.calendar_id
     WHERE e.id = $1 AND e.user_id = $2`,
    [masterId, request.user.id]
  );

  if (result.rows.length === 0) {
    return apiError("Event not found", 404);
  }

  return apiResponse({ event: result.rows[0] });
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
  } = body;

  // Verify ownership
  const existing = await query(
    "SELECT id FROM events WHERE id = $1 AND user_id = $2",
    [masterId, request.user.id]
  );
  if (existing.rows.length === 0) {
    return apiError("Event not found", 404);
  }

  // If changing calendar, verify new calendar ownership
  if (calendar_id) {
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

  if (fields.length === 0) {
    return apiError("No fields to update");
  }

  fields.push(`updated_at = NOW()`);
  values.push(masterId, request.user.id);

  const result = await query(
    `UPDATE events SET ${fields.join(", ")}
     WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
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

  // Push update to Google if this is a Google-linked calendar
  if (event.rows[0]?.google_calendar_id) {
    pushEventToGoogle(request.user.id, masterId).catch((err) =>
      console.error("Google push error:", err)
    );
  }

  return apiResponse({ event: event.rows[0] });
});

export const DELETE = withAuth(async (request, { params }) => {
  const { id } = await params;
  const masterId = getMasterEventId(id);

  // Fetch event's Google IDs before deleting
  const eventRow = await query(
    `SELECT e.google_event_id, c.google_calendar_id
     FROM events e
     JOIN calendars c ON c.id = e.calendar_id
     WHERE e.id = $1 AND e.user_id = $2`,
    [masterId, request.user.id]
  );

  const result = await query(
    "DELETE FROM events WHERE id = $1 AND user_id = $2 RETURNING id",
    [masterId, request.user.id]
  );

  if (result.rows.length === 0) {
    return apiError("Event not found", 404);
  }

  // Delete from Google if it was a Google event
  if (eventRow.rows[0]?.google_event_id && eventRow.rows[0]?.google_calendar_id) {
    deleteEventFromGoogle(
      request.user.id,
      eventRow.rows[0].google_event_id,
      eventRow.rows[0].google_calendar_id
    ).catch((err) => console.error("Google delete error:", err));
  }

  return apiResponse({ message: "Event deleted" });
});

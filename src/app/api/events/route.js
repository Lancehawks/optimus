import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { expandRecurrences } from "@/lib/recurrence";
import { pushEventToGoogle } from "@/lib/googleSync";

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
    `SELECT e.*, c.color AS calendar_color, c.name AS calendar_name
     FROM events e
     JOIN calendars c ON c.id = e.calendar_id
     WHERE e.user_id = $1
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
    `SELECT e.*, c.color AS calendar_color, c.name AS calendar_name
     FROM events e
     JOIN calendars c ON c.id = e.calendar_id
     WHERE e.user_id = $1
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
  } = body;

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
    `INSERT INTO events (user_id, calendar_id, title, description, location, start_time, end_time, all_day, recurrence_rule)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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

  // Push to Google if this is a Google-linked calendar
  if (event.rows[0].google_calendar_id) {
    pushEventToGoogle(request.user.id, result.rows[0].id).catch((err) =>
      console.error("Google push error:", err)
    );
  }

  return apiResponse({ event: event.rows[0] }, 201);
});

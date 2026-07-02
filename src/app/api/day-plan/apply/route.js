import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { isReservedEventColor, normalizeEventColor } from "@/lib/eventServerUtils";

const DEFAULT_TIME_BLOCK_COLOR = "#14b8a6";

export const POST = withAuth(async (request) => {
  try {
    const body = await request.json();
    const { date, status, blocks } = body;

    if (!date || !status) {
      return apiError("date and status are required");
    }
    if (!["accepted", "edited", "rejected"].includes(status)) {
      return apiError("status must be accepted, edited, or rejected");
    }

    // Log the decision
    await query(
      `INSERT INTO day_plan_logs (user_id, log_date, status)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, log_date)
       DO UPDATE SET status = EXCLUDED.status
       RETURNING *`,
      [request.user.id, date, status]
    );

    // If rejected, we're done
    if (status === "rejected") {
      return apiResponse({ success: true, events: [] });
    }

    // For accepted/edited, create calendar events
    if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
      return apiResponse({ success: true, events: [] });
    }

    // Resolve default calendar
    let calendarId;
    const defaultCal = await query(
      "SELECT id FROM calendars WHERE user_id = $1 AND is_default = true LIMIT 1",
      [request.user.id]
    );
    if (defaultCal.rows.length === 0) {
      const newCal = await query(
        `INSERT INTO calendars (user_id, name, color, is_default)
         VALUES ($1, 'My Calendar', '#6366f1', true)
         RETURNING id`,
        [request.user.id]
      );
      calendarId = newCal.rows[0].id;
    } else {
      calendarId = defaultCal.rows[0].id;
    }

    // Create events for each block
    const createdEvents = [];
    for (const block of blocks) {
      // Client sends full ISO timestamps with timezone info
      const startTime = block.start_time;
      const endTime = block.end_time;

      const blockColor = normalizeEventColor(block.color);
      const eventColor = blockColor && !isReservedEventColor(blockColor)
        ? blockColor
        : DEFAULT_TIME_BLOCK_COLOR;

      const result = await query(
        `INSERT INTO events (user_id, calendar_id, title, start_time, end_time, event_color, status, event_type)
         VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', 'time_block')
         RETURNING *`,
        [request.user.id, calendarId, block.title, startTime, endTime, eventColor]
      );
      createdEvents.push(result.rows[0]);
    }

    return apiResponse({ success: true, events: createdEvents }, 201);
  } catch (error) {
    console.error("Day plan apply error:", error);
    return apiError("Internal server error", 500);
  }
});

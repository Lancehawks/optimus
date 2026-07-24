import crypto from "node:crypto";
import { transaction } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { isReservedEventColor, normalizeEventColor } from "@/lib/eventServerUtils";

const DEFAULT_TIME_BLOCK_COLOR = "#14b8a6";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function normalizeBlocks(blocks, date) {
  if (blocks === undefined || blocks === null) return [];
  if (!Array.isArray(blocks) || blocks.length > 50) {
    throw new Error("blocks must be an array with at most 50 items");
  }

  return blocks.map((block, index) => {
    const title = typeof block?.title === "string" ? block.title.trim() : "";
    const startTime = new Date(block?.start_time);
    const endTime = new Date(block?.end_time);
    if (!title || title.length > 255 || Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
      throw new Error(`Block ${index + 1} has an invalid title or time`);
    }
    if (endTime <= startTime) throw new Error(`Block ${index + 1} must end after it starts`);

    const blockColor = normalizeEventColor(block.color);
    const eventColor = blockColor && !isReservedEventColor(blockColor)
      ? blockColor
      : DEFAULT_TIME_BLOCK_COLOR;
    const identity = block.id || crypto
      .createHash("sha256")
      .update(`${index}:${title}:${block.start_time}:${block.end_time}`)
      .digest("hex")
      .slice(0, 24);

    return {
      title,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      eventColor,
      sourceKey: `day-plan:${date}:${identity}`,
    };
  });
}

export const POST = withAuth(async (request) => {
  try {
    const body = await request.json().catch(() => ({}));
    const { date, status } = body;
    if (typeof date !== "string" || !DATE_PATTERN.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
      return apiError("date must use YYYY-MM-DD format");
    }
    if (!["accepted", "edited", "rejected"].includes(status)) {
      return apiError("status must be accepted, edited, or rejected");
    }

    let blocks;
    try {
      blocks = status === "rejected" ? [] : normalizeBlocks(body.blocks, date);
    } catch (error) {
      return apiError(error.message);
    }

    const createdEvents = await transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`day-plan:${request.user.id}:${date}`]);
      await client.query(
        `INSERT INTO day_plan_logs (user_id, log_date, status)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, log_date)
         DO UPDATE SET status = EXCLUDED.status`,
        [request.user.id, date, status]
      );

      const sourceKeys = blocks.map((block) => block.sourceKey);
      await client.query(
        `DELETE FROM events
         WHERE user_id = $1
           AND source_key LIKE $2
           AND NOT (source_key = ANY($3::text[]))`,
        [request.user.id, `day-plan:${date}:%`, sourceKeys]
      );
      if (blocks.length === 0) return [];

      const defaultCalendar = await client.query(
        `INSERT INTO calendars (user_id, name, color, is_default)
         VALUES ($1, 'My Calendar', '#0d6b88', TRUE)
         ON CONFLICT (user_id) WHERE is_default = TRUE
         DO UPDATE SET is_default = TRUE
         RETURNING id`,
        [request.user.id]
      );
      const calendarId = defaultCalendar.rows[0].id;
      const events = [];

      for (const block of blocks) {
        const result = await client.query(
          `INSERT INTO events
             (user_id, calendar_id, title, start_time, end_time, event_color, status, event_type, source_key)
           VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', 'time_block', $7)
           ON CONFLICT (user_id, source_key) WHERE source_key IS NOT NULL
           DO UPDATE SET calendar_id = EXCLUDED.calendar_id, title = EXCLUDED.title,
             start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time,
             event_color = EXCLUDED.event_color, updated_at = NOW()
           RETURNING *`,
          [request.user.id, calendarId, block.title, block.startTime, block.endTime, block.eventColor, block.sourceKey]
        );
        events.push(result.rows[0]);
      }
      return events;
    });

    return apiResponse({ success: true, events: createdEvents });
  } catch (error) {
    console.error("Day plan apply error:", error);
    return apiError("Internal server error", 500);
  }
});

import crypto from "node:crypto";
import { isReservedEventColor, normalizeEventColor } from "./eventServerUtils.js";

// Applying a day plan puts its time blocks on the calendar as events, one set
// per day. Applying again replaces that day's set.

const DEFAULT_TIME_BLOCK_COLOR = "#14b8a6";
const MAX_BLOCKS = 50;

// Throws a message written for the member when a block can't be used.
export function normalizeDayPlanBlocks(blocks, date) {
  if (blocks === undefined || blocks === null) return [];
  if (!Array.isArray(blocks) || blocks.length > MAX_BLOCKS) {
    throw new Error(`blocks must be an array with at most ${MAX_BLOCKS} items`);
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

// Records the day's decision and replaces its blocks on the calendar, returning
// the events now there. Takes normalized blocks. Call inside a transaction.
export async function saveDayPlan(client, userId, { date, status, blocks }) {
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`day-plan:${userId}:${date}`]);
  await client.query(
    `INSERT INTO day_plan_logs (user_id, log_date, status)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, log_date)
     DO UPDATE SET status = EXCLUDED.status`,
    [userId, date, status]
  );

  const sourceKeys = blocks.map((block) => block.sourceKey);
  await client.query(
    `DELETE FROM events
     WHERE user_id = $1
       AND source_key LIKE $2
       AND NOT (source_key = ANY($3::text[]))`,
    [userId, `day-plan:${date}:%`, sourceKeys]
  );
  if (blocks.length === 0) return [];

  const defaultCalendar = await client.query(
    `INSERT INTO calendars (user_id, name, color, is_default)
     VALUES ($1, 'My Calendar', '#0d6b88', TRUE)
     ON CONFLICT (user_id) WHERE is_default = TRUE
     DO UPDATE SET is_default = TRUE
     RETURNING id`,
    [userId]
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
      [userId, calendarId, block.title, block.startTime, block.endTime, block.eventColor, block.sourceKey]
    );
    events.push(result.rows[0]);
  }
  return events;
}

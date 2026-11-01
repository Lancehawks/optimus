import { dateKey, resolveTimeZone } from "./calendarTime.js";

// A routine's day is the member's own, from their timezone setting. The
// database's date is usually UTC, which can be a day off for hours at a time.
// `db` has query(text, params).

export function routineToday(user, now = new Date()) {
  return dateKey(now, resolveTimeZone(user.timezone));
}

// { itemId: completed } for the member's current day.
export async function loadTodayRoutineLogs(db, user, now = new Date()) {
  const logs = await db.query(
    `SELECT cl.item_id, cl.completed
     FROM checklist_logs cl
     JOIN checklist_items ci ON ci.id = cl.item_id
     JOIN checklist_sections cs ON cs.id = ci.section_id
     WHERE cs.user_id = $1 AND cl.log_date = $2::date`,
    [user.id, routineToday(user, now)]
  );
  return Object.fromEntries(logs.rows.map((log) => [log.item_id, log.completed]));
}

// Without a date, this logs the member's current day.
export async function logRoutineItem(db, user, { itemId, date = null, completed = true }, now = new Date()) {
  const result = await db.query(
    `INSERT INTO checklist_logs (item_id, log_date, completed)
     VALUES ($1, $2::date, $3)
     ON CONFLICT (item_id, log_date)
     DO UPDATE SET completed = EXCLUDED.completed
     RETURNING *`,
    [itemId, date || routineToday(user, now), completed]
  );
  return result.rows[0];
}

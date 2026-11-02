import { projectScopedAccessCondition } from "./projectAccessSql.js";

// A task is scheduled when a calendar event the viewer ($1) can see is linked
// to it and is still ahead: a one-off event that hasn't ended and wasn't
// finished or cancelled, or a repeating event.
const LINKED_UPCOMING_BLOCKS = `FROM event_tasks block_link
     JOIN events block ON block.id = block_link.event_id
     WHERE ${projectScopedAccessCondition("block")}
       AND (block.recurrence_rule IS NOT NULL
         OR (block.end_time > NOW() AND COALESCE(block.status, 'scheduled') IN ('scheduled', 'in_progress')))`;

/** True when the task whose id is `taskIdSql` has an upcoming block. */
export function hasUpcomingBlockSql(taskIdSql) {
  return `EXISTS (SELECT 1 ${LINKED_UPCOMING_BLOCKS} AND block_link.task_id = ${taskIdSql})`;
}

/** The task's upcoming blocks: one-off blocks soonest first, then repeating ones. */
export function upcomingBlocksSql(taskIdSql, { limit }) {
  return `SELECT block.id, block.title, block.start_time, block.end_time, block.all_day,
            block.recurrence_rule IS NOT NULL AS repeats,
            block.user_id = $1 AS is_mine
     ${LINKED_UPCOMING_BLOCKS} AND block_link.task_id = ${taskIdSql}
     ORDER BY (block.recurrence_rule IS NOT NULL), block.start_time, block.id
     LIMIT ${Number(limit)}`;
}

// An event made in Google Calendar arrives with no task attached. When its
// title names exactly one open task the member can see ("Write deck" or
// "Focus: Write deck", ignoring case and outer spaces), the event becomes that
// task's block. Events that already have tasks are left alone, and a title
// shared by several open tasks links none of them.
const IMPORTED_TITLE_TASK_MATCH = `lower(btrim(t.title)) = lower(btrim(regexp_replace(e.title, '^\\s*focus\\s*:\\s*', '', 'i')))`;

/**
 * Links the member's upcoming Google events in a calendar to the open task
 * their title names. Every upcoming event is checked, not only the ones this
 * import changed, so a task created after its event is still found.
 */
export function linkImportedEventsToTasks(client, { userId, calendarId }) {
  return client.query(
    `INSERT INTO event_tasks (event_id, task_id)
     SELECT e.id, match.id
     FROM events e
     CROSS JOIN LATERAL (
       SELECT t.id, COUNT(*) OVER () AS matches
       FROM tasks t
       WHERE ${projectScopedAccessCondition("t")}
         AND t.status <> 'done' AND t.is_archived = false
         AND ${IMPORTED_TITLE_TASK_MATCH}
       LIMIT 2
     ) match
     WHERE e.user_id = $1 AND e.calendar_id = $2 AND e.google_event_id IS NOT NULL
       AND (e.recurrence_rule IS NOT NULL OR e.end_time > NOW())
       AND match.matches = 1
       AND NOT EXISTS (SELECT 1 FROM event_tasks linked WHERE linked.event_id = e.id)
     ON CONFLICT DO NOTHING`,
    [userId, calendarId]
  );
}

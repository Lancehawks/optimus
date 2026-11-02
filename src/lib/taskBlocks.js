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

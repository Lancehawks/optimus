import { query } from "@/lib/db";
import { projectScopedAccessCondition } from "@/lib/projectAccess";
import { expandRecurrences } from "@/lib/recurrence";
import {
  applyMissedEventDisplayStatuses,
  applyOccurrenceStatuses,
  syncMissedEventStatuses,
} from "@/lib/eventOccurrenceStatus";

const EVENT_COMPLETION_GRACE_MINUTES = 5;
const EVENT_COMPLETION_LOOKBACK_HOURS = 24;
const TERMINAL_EVENT_STATUSES = new Set(["done", "missed", "cancelled"]);

function isOpenEvent(event) {
  return !TERMINAL_EVENT_STATUSES.has(event.status || "scheduled");
}

export async function listTaskReminderCandidates({ userId, windowEnd }) {
  const tasksResult = await query(
    `SELECT t.id, t.title, t.due_date, t.priority, t.project_id,
            p.name AS project_name, p.color AS project_color,
            (t.due_date::time <> TIME '00:00') AS due_has_time,
            CASE
              WHEN t.due_date < CURRENT_DATE
                OR (t.due_date::time <> TIME '00:00' AND t.due_date < NOW())
                THEN 'overdue'
              WHEN t.due_date::time <> TIME '00:00'
                THEN 'due_soon'
              ELSE 'due_today'
            END AS due_status
     FROM tasks t
     LEFT JOIN projects p ON p.id = t.project_id
     WHERE ${projectScopedAccessCondition("t")}
       AND t.parent_task_id IS NULL
       AND t.status <> 'done'
       AND t.is_archived = false
       AND t.due_date IS NOT NULL
       AND (
         t.due_date < CURRENT_DATE
         OR (
           t.due_date >= CURRENT_DATE
           AND t.due_date < CURRENT_DATE + INTERVAL '1 day'
           AND t.priority IN ('urgent', 'high')
         )
         OR (
           t.due_date::time <> TIME '00:00'
           AND t.due_date <= $2
         )
       )
     ORDER BY
       CASE WHEN t.due_date < CURRENT_DATE THEN 0 ELSE 1 END,
       CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,
       t.due_date ASC
     LIMIT 4`,
    [userId, windowEnd.toISOString()]
  );

  return tasksResult.rows;
}

async function listNonRecurringEventReminderCandidates({ userId, windowStart, windowEnd }) {
  const result = await query(
    `SELECT e.id, e.title, e.start_time, e.end_time, e.all_day, e.project_id,
            p.name AS project_name, p.color AS project_color
     FROM events e
     LEFT JOIN projects p ON p.id = e.project_id
     WHERE ${projectScopedAccessCondition("e")}
       AND e.recurrence_rule IS NULL
       AND COALESCE(e.status, 'scheduled') NOT IN ('done', 'missed', 'cancelled')
       AND COALESCE(e.all_day, false) = false
       AND e.start_time <= $3
       AND e.end_time >= $2
     ORDER BY e.start_time ASC
     LIMIT 5`,
    [userId, windowStart.toISOString(), windowEnd.toISOString()]
  );

  return result.rows;
}

async function listRecurringEventReminderMasters({ userId, windowEnd }) {
  const result = await query(
    `SELECT e.id, e.title, e.start_time, e.end_time, e.all_day, e.recurrence_rule, e.project_id,
            p.name AS project_name, p.color AS project_color
     FROM events e
     LEFT JOIN projects p ON p.id = e.project_id
     WHERE ${projectScopedAccessCondition("e")}
       AND e.recurrence_rule IS NOT NULL
       AND COALESCE(e.status, 'scheduled') NOT IN ('done', 'missed', 'cancelled')
       AND COALESCE(e.all_day, false) = false
       AND e.start_time <= $2`,
    [userId, windowEnd.toISOString()]
  );

  return result.rows;
}

export async function listEventReminderCandidates({
  userId,
  windowStart,
  windowEnd,
  now,
}) {
  const [nonRecurringEvents, recurringMasters] = await Promise.all([
    listNonRecurringEventReminderCandidates({ userId, windowStart, windowEnd }),
    listRecurringEventReminderMasters({ userId, windowEnd }),
  ]);

  const recurringEvents = expandRecurrences(
    recurringMasters,
    windowStart,
    windowEnd
  ).filter((event) => {
    const start = new Date(event.start_time);
    const end = new Date(event.end_time);
    return start <= windowEnd && end >= windowStart;
  });

  const eventCandidates = [...nonRecurringEvents, ...recurringEvents];
  await applyOccurrenceStatuses(eventCandidates);
  applyMissedEventDisplayStatuses(eventCandidates, now);

  return eventCandidates
    .filter(isOpenEvent)
    .filter((event) => new Date(event.end_time) >= now)
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
    .slice(0, 5);
}

// Worker-only persistence path. It is intentionally separate from calendar and
// notification HTTP reads so rendering data never mutates event state.
export async function persistMissedEventStatusesForUser(userId, now = new Date()) {
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const windowStart = new Date(cutoff.getTime() - 24 * 60 * 60 * 1000);

  await query(
    `UPDATE events
     SET status = 'missed', updated_at = NOW()
     WHERE user_id = $1
       AND recurrence_rule IS NULL
       AND end_time <= $2
       AND COALESCE(status, 'scheduled') NOT IN ('done', 'missed', 'cancelled')`,
    [userId, cutoff.toISOString()]
  );

  const recurringMasters = await query(
    `SELECT e.id, e.user_id, e.title, e.start_time, e.end_time, e.all_day,
            e.recurrence_rule, e.project_id, e.status
     FROM events e
     WHERE e.user_id = $1
       AND e.recurrence_rule IS NOT NULL
       AND e.start_time <= $2
       AND COALESCE(e.status, 'scheduled') NOT IN ('done', 'cancelled')
     ORDER BY e.updated_at DESC
     LIMIT 500`,
    [userId, cutoff.toISOString()]
  );
  const occurrences = expandRecurrences(recurringMasters.rows, windowStart, cutoff)
    .filter((event) => new Date(event.end_time) <= cutoff);
  await applyOccurrenceStatuses(occurrences);
  await syncMissedEventStatuses(occurrences, userId, now, {
    persistAfterMs: 24 * 60 * 60 * 1000,
  });
}

export async function listEventCompletionCandidates(userId, now) {
  const graceEnd = new Date(now.getTime() - EVENT_COMPLETION_GRACE_MINUTES * 60 * 1000);
  const lookbackStart = new Date(now.getTime() - EVENT_COMPLETION_LOOKBACK_HOURS * 60 * 60 * 1000);

  const [nonRecurringEventsResult, recurringMastersResult] = await Promise.all([
    query(
      `SELECT e.id, e.user_id, e.title, e.start_time, e.end_time, e.all_day, e.project_id, e.status,
              p.name AS project_name, p.color AS project_color
       FROM events e
       LEFT JOIN projects p ON p.id = e.project_id
       WHERE e.user_id = $1
         AND e.recurrence_rule IS NULL
         AND e.end_time <= $2
         AND e.end_time >= $3
         AND COALESCE(e.status, 'scheduled') NOT IN ('done', 'missed', 'cancelled')
       ORDER BY e.end_time DESC
       LIMIT 20`,
      [userId, graceEnd.toISOString(), lookbackStart.toISOString()]
    ),
    query(
      `SELECT e.id, e.user_id, e.title, e.start_time, e.end_time, e.all_day, e.recurrence_rule, e.project_id, e.status,
              p.name AS project_name, p.color AS project_color
       FROM events e
       LEFT JOIN projects p ON p.id = e.project_id
       WHERE e.user_id = $1
         AND e.recurrence_rule IS NOT NULL
         AND e.start_time <= $2
         AND COALESCE(e.status, 'scheduled') NOT IN ('done', 'cancelled')
       ORDER BY e.start_time DESC
       LIMIT 50`,
      [userId, graceEnd.toISOString()]
    ),
  ]);

  const recurringEvents = expandRecurrences(
    recurringMastersResult.rows,
    lookbackStart,
    graceEnd
  ).filter((event) => {
    const end = new Date(event.end_time);
    return end <= graceEnd && end >= lookbackStart;
  });

  const candidates = [...nonRecurringEventsResult.rows, ...recurringEvents];
  await applyOccurrenceStatuses(candidates);

  return candidates
    .filter(isOpenEvent)
    .sort((a, b) => new Date(b.end_time) - new Date(a.end_time))
    .slice(0, 20);
}

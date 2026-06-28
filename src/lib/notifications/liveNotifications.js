import { query } from "@/lib/db";
import { normalizeNotificationPreferences } from "@/lib/notificationPreferences";
import { projectScopedAccessCondition } from "@/lib/projectAccess";
import { expandRecurrences } from "@/lib/recurrence";

function toNotificationDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().slice(0, 10);
}

function buildTaskLiveNotification(task) {
  const isOverdue = task.due_status === "overdue";
  const liveKeyDate = task.due_has_time
    ? new Date(task.due_date).toISOString()
    : toNotificationDateKey(task.due_date);
  const liveKey = `task_due:${task.id}:${liveKeyDate}`;
  const title = isOverdue
    ? "Task is overdue"
    : task.due_status === "due_soon"
      ? "Task is due soon"
      : "Important task due today";

  return {
    projectId: task.project_id,
    type: "time_alert",
    title,
    body: task.title,
    entityType: "task",
    entityId: task.id,
    metadata: {
      live: true,
      live_key: liveKey,
      source: "task_due",
      href: task.project_id ? `/projects?project_id=${task.project_id}` : "/tasks",
      priority: task.priority,
      due_date: task.due_date,
      due_status: task.due_status,
    },
  };
}

function buildEventLiveNotification(event, now = new Date()) {
  const start = new Date(event.start_time);
  const end = new Date(event.end_time);
  const minutesUntilStart = Math.round((start.getTime() - now.getTime()) / 60000);
  const isHappeningNow = start <= now && end >= now;
  const statusText = isHappeningNow
    ? "Event is happening now"
    : minutesUntilStart <= 1
      ? "Event is starting now"
      : `Event starts in ${minutesUntilStart} min`;
  const eventId = event._masterEventId || event.id;
  const liveKey = `event_time:${eventId}:${new Date(event.start_time).toISOString()}`;

  return {
    projectId: event.project_id,
    type: "time_alert",
    title: statusText,
    body: event.title,
    entityType: "event",
    entityId: eventId,
    metadata: {
      live: true,
      live_key: liveKey,
      source: "event_time",
      href: event.project_id ? `/projects?project_id=${event.project_id}` : "/calendar",
      start_time: event.start_time,
      end_time: event.end_time,
    },
  };
}

async function insertLiveNotification(userId, notification) {
  const liveKey = notification.metadata?.live_key;
  if (!liveKey) return null;

  const result = await query(
    `INSERT INTO notifications
       (user_id, actor_user_id, project_id, activity_id, type, entity_type, entity_id, title, body, metadata)
     SELECT $1, NULL, $2, NULL, $3, $4, $5, $6, $7, $8::jsonb
     WHERE NOT EXISTS (
       SELECT 1
       FROM notifications
       WHERE user_id = $1
         AND type = $3
         AND metadata->>'live_key' = $9
     )
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [
      userId,
      notification.projectId || null,
      notification.type,
      notification.entityType,
      notification.entityId,
      notification.title,
      notification.body,
      JSON.stringify(notification.metadata || {}),
      liveKey,
    ]
  );

  return result.rows[0] || null;
}

export async function syncLiveNotifications(userId, preferences) {
  if (!userId) return 0;

  const prefs = normalizeNotificationPreferences(preferences);
  if (!prefs.taskReminders && !prefs.eventReminders) return 0;

  const now = new Date();
  const windowStart = new Date(now.getTime() - 5 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + prefs.reminderLeadMinutes * 60 * 1000);

  try {
    const [tasksResult, nonRecurringEventsResult, recurringMastersResult] = await Promise.all([
      prefs.taskReminders
        ? query(
          `SELECT t.id, t.title, t.due_date, t.priority, t.project_id,
                  p.name AS project_name, p.color AS project_color,
                  (t.due_date::time <> TIME '00:00') AS due_has_time,
                  CASE
                    WHEN t.due_date::date < CURRENT_DATE
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
               t.due_date::date < CURRENT_DATE
               OR (
                 t.due_date::date = CURRENT_DATE
                 AND t.priority IN ('urgent', 'high')
               )
               OR (
                 t.due_date::time <> TIME '00:00'
                 AND t.due_date <= $2
               )
             )
           ORDER BY
             CASE WHEN t.due_date::date < CURRENT_DATE THEN 0 ELSE 1 END,
             CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,
             t.due_date ASC
           LIMIT 4`,
          [userId, windowEnd.toISOString()]
        )
        : Promise.resolve({ rows: [] }),
      prefs.eventReminders
        ? query(
          `SELECT e.id, e.title, e.start_time, e.end_time, e.all_day, e.project_id,
                  p.name AS project_name, p.color AS project_color
           FROM events e
           LEFT JOIN projects p ON p.id = e.project_id
           WHERE ${projectScopedAccessCondition("e")}
             AND e.recurrence_rule IS NULL
             AND COALESCE(e.all_day, false) = false
             AND e.start_time <= $3
             AND e.end_time >= $2
           ORDER BY e.start_time ASC
           LIMIT 5`,
          [userId, windowStart.toISOString(), windowEnd.toISOString()]
        )
        : Promise.resolve({ rows: [] }),
      prefs.eventReminders
        ? query(
          `SELECT e.id, e.title, e.start_time, e.end_time, e.all_day, e.recurrence_rule, e.project_id,
                  p.name AS project_name, p.color AS project_color
           FROM events e
           LEFT JOIN projects p ON p.id = e.project_id
           WHERE ${projectScopedAccessCondition("e")}
             AND e.recurrence_rule IS NOT NULL
             AND COALESCE(e.all_day, false) = false
             AND e.start_time <= $2`,
          [userId, windowEnd.toISOString()]
        )
        : Promise.resolve({ rows: [] }),
    ]);

    const recurringEvents = expandRecurrences(
      recurringMastersResult.rows,
      windowStart,
      windowEnd
    ).filter((event) => {
      const start = new Date(event.start_time);
      const end = new Date(event.end_time);
      return start <= windowEnd && end >= windowStart;
    });

    const events = [...nonRecurringEventsResult.rows, ...recurringEvents]
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
      .slice(0, 5);

    const liveNotifications = [
      ...events.map((event) => buildEventLiveNotification(event, now)),
      ...tasksResult.rows.map(buildTaskLiveNotification),
    ];

    let createdCount = 0;
    for (const notification of liveNotifications) {
      const inserted = await insertLiveNotification(userId, notification);
      if (inserted) createdCount++;
    }

    return createdCount;
  } catch (error) {
    if (error.code === "42P01") return 0;
    throw error;
  }
}

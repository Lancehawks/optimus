function toNotificationDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().slice(0, 10);
}

export function buildTaskLiveNotification(task) {
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

export function buildEventLiveNotification(event, now = new Date()) {
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

function getEventCompletionKey(event) {
  const masterId = event._masterEventId || event.id;
  const occurrenceDate = event._occurrenceDate || null;
  return occurrenceDate
    ? `event_completion:${masterId}:${occurrenceDate}`
    : `event_completion:${event.id}`;
}

export function buildEventCompletionNotification(event) {
  const masterId = event._masterEventId || event.id;
  const eventInstanceId = event._isRecurrenceInstance ? event.id : masterId;
  const occurrenceDate = event._occurrenceDate || null;
  const completionKey = getEventCompletionKey(event);

  return {
    userId: event.user_id,
    projectId: event.project_id,
    type: "event_completion_check",
    title: "Event finished",
    body: `Did you complete "${event.title}"?`,
    entityType: "event",
    entityId: masterId,
    metadata: {
      source: "event_completion_check",
      status: "pending",
      completion_key: completionKey,
      event_id: masterId,
      event_instance_id: eventInstanceId,
      occurrence_date: occurrenceDate,
      href: event.project_id ? `/projects?project_id=${event.project_id}` : "/calendar",
      start_time: event.start_time,
      end_time: event.end_time,
    },
  };
}

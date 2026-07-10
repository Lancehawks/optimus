const SHARED_EVENT_FALLBACK_COLOR = "#6366f1";

function isSharedProjectEventForViewer(event, viewerId) {
  return Boolean(event?.project_id && event?.user_id && event.user_id !== viewerId);
}

function presentLinkedTasks(tasks) {
  return Array.isArray(tasks)
    ? tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
    }))
    : [];
}

export function presentEventForViewer(event, viewerId) {
  if (!event) return null;

  const sharedForViewer = isSharedProjectEventForViewer(event, viewerId);
  const calendarName = sharedForViewer
    ? event.project_name || "Shared project"
    : event.calendar_name;
  const calendarColor = sharedForViewer
    ? event.project_color || SHARED_EVENT_FALLBACK_COLOR
    : event.calendar_color;

  const presented = {
    id: event.id,
    user_id: event.user_id,
    is_project_owner: Boolean(event.is_project_owner),
    calendar_id: sharedForViewer ? null : event.calendar_id,
    title: event.title,
    description: event.description,
    location: event.location,
    start_time: event.start_time,
    end_time: event.end_time,
    all_day: event.all_day,
    recurrence_rule: event.recurrence_rule,
    project_id: event.project_id,
    event_color: event.event_color,
    status: event.status,
    event_type: event.event_type,
    created_at: event.created_at,
    updated_at: event.updated_at,
    calendar_name: calendarName,
    calendar_color: calendarColor,
    project_name: event.project_name,
    project_color: event.project_color,
    linked_tasks: presentLinkedTasks(event.linked_tasks),
  };

  if (event._isRecurrenceInstance) {
    presented._isRecurrenceInstance = true;
    presented._masterEventId = event._masterEventId;
    presented._occurrenceDate = event._occurrenceDate;
  }

  if (event.occurrence_status) {
    presented.occurrence_status = event.occurrence_status;
  }

  if (event.user_id === viewerId) {
    presented.google_event_id = event.google_event_id;
    presented.google_rrule = event.google_rrule;
    presented.synced_at = event.synced_at;
  }

  return presented;
}

export function presentEventsForViewer(events, viewerId) {
  return Array.isArray(events)
    ? events.map((event) => presentEventForViewer(event, viewerId))
    : [];
}

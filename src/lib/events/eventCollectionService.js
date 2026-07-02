import { recordProjectActivity } from "@/lib/collaborationActivity";
import { validateEventMeta } from "@/lib/eventServerUtils";
import { applyOccurrenceStatuses, syncMissedEventStatuses } from "@/lib/eventOccurrenceStatus";
import { expandRecurrences } from "@/lib/recurrence";
import { failEventRequest as fail } from "@/lib/events/eventErrors";
import { presentEventForViewer, presentEventsForViewer } from "@/lib/events/eventPresenter";
import { findProjectForEventMember } from "@/lib/events/eventPermissions";
import {
  createDefaultCalendarForUser,
  createEventRecord,
  findDefaultCalendarForUser,
  findEventForViewer,
  findEventWithGoogleCalendar,
  listLinkedTasksForEvent,
  listLinkedTasksForEvents,
  listNonRecurringEventsForRange,
  listRecurringEventMastersForRange,
  replaceLinkedTasksForEvent,
  userOwnsCalendar,
} from "@/lib/events/eventRepository";
import { pushEventUpdateToGoogle } from "@/lib/events/googleEventSyncService";

async function resolveCalendarId({ userId, calendarId }) {
  if (!calendarId) {
    const defaultCalendar = await findDefaultCalendarForUser(userId);
    if (defaultCalendar) return defaultCalendar.id;

    const newCalendar = await createDefaultCalendarForUser(userId);
    return newCalendar.id;
  }

  const isOwner = await userOwnsCalendar(userId, calendarId);
  if (!isOwner) {
    fail("Calendar not found", 404);
  }

  return calendarId;
}

export async function listEventsForRange({
  userId,
  start,
  end,
  calendarId,
}) {
  if (!start || !end) {
    fail("start and end query parameters are required");
  }

  const rangeStart = new Date(start);
  const rangeEnd = new Date(end);

  const [nonRecurringEvents, recurringMasters] = await Promise.all([
    listNonRecurringEventsForRange({
      userId,
      rangeStart,
      rangeEnd,
      calendarId,
    }),
    listRecurringEventMastersForRange({
      userId,
      rangeEnd,
      calendarId,
    }),
  ]);

  const recurringInstances = expandRecurrences(
    recurringMasters,
    rangeStart,
    rangeEnd
  );
  const allEvents = [...nonRecurringEvents, ...recurringInstances].sort(
    (a, b) => new Date(a.start_time) - new Date(b.start_time)
  );

  const masterEventIds = [
    ...new Set(allEvents.map((event) => event._masterEventId || event.id)),
  ];
  const tasksByEvent = await listLinkedTasksForEvents(userId, masterEventIds);

  for (const event of allEvents) {
    const key = event._masterEventId || event.id;
    event.linked_tasks = tasksByEvent[key] || [];
  }

  await applyOccurrenceStatuses(allEvents);
  await syncMissedEventStatuses(allEvents, userId, new Date(), {
    persistAfterMs: 24 * 60 * 60 * 1000,
  });

  return { events: presentEventsForViewer(allEvents, userId) };
}

export async function createEvent({ userId, body }) {
  const {
    title,
    description,
    location,
    start_time,
    end_time,
    all_day,
    recurrence_rule,
    calendar_id,
    task_ids,
    project_id,
    projectId,
    event_color,
    color,
    status,
    event_type,
    eventType,
  } = body;
  const targetProjectId = project_id || projectId || null;
  const meta = validateEventMeta({
    eventColor: event_color !== undefined ? event_color : color,
    status,
    eventType: event_type || eventType,
  });
  if (meta.error) {
    fail(meta.error);
  }

  if (!title || !title.trim()) {
    fail("Title is required");
  }
  if (!start_time || !end_time) {
    fail("Start and end times are required");
  }

  const startDate = new Date(start_time);
  const endDate = new Date(end_time);
  if (!all_day && endDate <= startDate) {
    fail("End time must be after start time");
  }

  if (targetProjectId) {
    const project = await findProjectForEventMember(userId, targetProjectId);
    if (!project) {
      fail("Project not found", 404);
    }
  }

  const resolvedCalendarId = await resolveCalendarId({
    userId,
    calendarId: calendar_id,
  });

  const created = await createEventRecord({
    userId,
    calendarId: resolvedCalendarId,
    title: title.trim(),
    description,
    location,
    startTime: startDate.toISOString(),
    endTime: endDate.toISOString(),
    allDay: all_day,
    recurrenceRule: recurrence_rule,
    projectId: targetProjectId,
    eventColor: meta.eventColor,
    status: meta.status,
    eventType: meta.eventType,
  });
  const eventId = created.id;

  await replaceLinkedTasksForEvent({
    userId,
    eventId,
    taskIds: task_ids,
    projectId: targetProjectId,
  });

  const googleEvent = await findEventWithGoogleCalendar(eventId);
  const googleError = await pushEventUpdateToGoogle({
    userId,
    eventId,
    event: googleEvent,
  });

  const [finalEvent, linkedTasks] = await Promise.all([
    findEventForViewer(userId, eventId),
    listLinkedTasksForEvent(userId, eventId),
  ]);

  if (targetProjectId) {
    await recordProjectActivity({
      projectId: targetProjectId,
      actorUserId: userId,
      action: "created",
      entityType: "event",
      entityId: eventId,
      entityTitle: title.trim(),
    });
  }

  return {
    event: presentEventForViewer({ ...finalEvent, linked_tasks: linkedTasks }, userId),
    googleError,
  };
}

import { recordProjectActivity } from "@/lib/collaborationActivity";
import { transaction } from "@/lib/db";
import { validateEventMeta } from "@/lib/eventServerUtils";
import { applyMissedEventDisplayStatuses, applyOccurrenceStatuses } from "@/lib/eventOccurrenceStatus";
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
import { googleEventUpsertJob } from "@/lib/integrationJobs";

async function resolveCalendarId({ userId, calendarId, db }) {
  if (!calendarId) {
    const defaultCalendar = await findDefaultCalendarForUser(userId, db);
    if (defaultCalendar) return defaultCalendar.id;

    const newCalendar = await createDefaultCalendarForUser(userId, db);
    return newCalendar.id;
  }

  const isOwner = await userOwnsCalendar(userId, calendarId, db);
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
  if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
    fail("Calendar range is invalid");
  }
  if (rangeEnd <= rangeStart) fail("Calendar range end must be after start");
  const maxRangeMs = 90 * 24 * 60 * 60 * 1000;
  if (rangeEnd.getTime() - rangeStart.getTime() > maxRangeMs) {
    fail("Calendar range cannot exceed 90 days");
  }

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
  applyMissedEventDisplayStatuses(allEvents);

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

  if (typeof title !== "string" || !title.trim()) {
    fail("Title is required");
  }
  if (title.trim().length > 255) fail("Title must be 255 characters or less");
  if (description != null && (typeof description !== "string" || description.length > 10000)) {
    fail("Description must be 10,000 characters or less");
  }
  if (location != null && (typeof location !== "string" || location.length > 255)) {
    fail("Location must be 255 characters or less");
  }
  if (!start_time || !end_time) {
    fail("Start and end times are required");
  }

  const startDate = new Date(start_time);
  const endDate = new Date(end_time);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    fail("Start and end times must be valid dates");
  }
  if (endDate <= startDate) {
    fail("End time must be after start time");
  }

  if (targetProjectId) {
    const project = await findProjectForEventMember(userId, targetProjectId);
    if (!project) {
      fail("Project not found", 404);
    }
  }

  const created = await transaction(async (client) => {
    const resolvedCalendarId = await resolveCalendarId({
      userId,
      calendarId: calendar_id,
      db: client,
    });
    const event = await createEventRecord({
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
      db: client,
    });

    await replaceLinkedTasksForEvent({
      userId,
      eventId: event.id,
      taskIds: task_ids,
      projectId: targetProjectId,
      db: client,
    });

    if (targetProjectId) {
      await recordProjectActivity({
        projectId: targetProjectId,
        actorUserId: userId,
        action: "created",
        entityType: "event",
        entityId: event.id,
        entityTitle: title.trim(),
        db: client,
        strict: true,
      });
    }

    const googleEvent = await findEventWithGoogleCalendar(event.id, client);
    let googleSyncQueued = false;
    if (googleEvent?.google_calendar_id && googleEvent.user_id === userId) {
      await googleEventUpsertJob({
        userId,
        eventId: event.id,
        version: new Date(event.updated_at).toISOString(),
        db: client,
      });
      googleSyncQueued = true;
    }
    return { ...event, googleSyncQueued };
  });
  const eventId = created.id;

  const [finalEvent, linkedTasks] = await Promise.all([
    findEventForViewer(userId, eventId),
    listLinkedTasksForEvent(userId, eventId),
  ]);

  return {
    event: presentEventForViewer({ ...finalEvent, linked_tasks: linkedTasks }, userId),
    googleError: null,
    googleSync: created.googleSyncQueued ? "queued" : "not_connected",
  };
}

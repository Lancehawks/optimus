import { recordProjectActivity } from "@/lib/collaborationActivity";
import { transaction } from "@/lib/db";
import { getMasterEventId } from "@/lib/recurrence";
import { isProjectOwner } from "@/lib/projectAccess";
import { validateEventMeta } from "@/lib/eventServerUtils";
import { EventRouteError, failEventRequest as fail } from "@/lib/events/eventErrors";
import { presentEventForViewer } from "@/lib/events/eventPresenter";
import {
  deleteEventForOwner,
  findCurrentEventForViewer,
  findEventForDelete,
  findEventForViewer,
  findEventWithGoogleCalendar,
  listLinkedTasksForEvent,
  replaceLinkedTasksForEvent,
  updateEventFields,
  userOwnsCalendar,
} from "@/lib/events/eventRepository";
import {
  canDeleteEvent,
  canEditEventStatus,
  canMoveEventToPersonal,
  findProjectForEventMember,
} from "@/lib/events/eventPermissions";
import {
  applyRecurrenceInstanceData,
  EventStatusMigrationMissingError,
  findOccurrenceInstance,
  getOccurrenceDate,
  isOccurrenceStatusOnlyUpdate,
  saveOccurrenceStatus,
} from "@/lib/events/eventStatusService";
import {
  attemptGoogleEventDelete,
  attemptGoogleEventUpsert,
  attemptGoogleOccurrenceStatus,
} from "@/lib/events/googleEventSyncService";

export { EventRouteError };

async function assertProjectChangeAllowed({
  userId,
  requestedProjectId,
  effectiveProjectId,
  currentEvent,
}) {
  if (requestedProjectId === undefined) return;

  if (effectiveProjectId) {
    const project = await findProjectForEventMember(userId, effectiveProjectId);
    if (!project) {
      fail("Project not found", 404);
    }
    return;
  }

  if (
    !canMoveEventToPersonal(currentEvent, userId) &&
    !(await isProjectOwner(userId, currentEvent.project_id))
  ) {
    fail("Only the event creator or project owner can move it back to personal events", 403);
  }
}

async function assertCalendarChangeAllowed({ userId, calendarId, currentEvent }) {
  if (!calendarId || calendarId === currentEvent.calendar_id) return;

  const isOwner = await userOwnsCalendar(userId, calendarId);
  if (!isOwner) {
    fail("Calendar not found", 404);
  }
}

function buildEventUpdateFields({
  title,
  description,
  location,
  start_time,
  end_time,
  all_day,
  recurrence_rule,
  calendar_id,
  requestedProjectId,
  effectiveProjectId,
  event_color,
  color,
  status,
  event_type,
  eventType,
  meta,
}) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  if (title !== undefined) {
    fields.push(`title = $${paramIndex++}`);
    values.push(title.trim());
  }
  if (description !== undefined) {
    fields.push(`description = $${paramIndex++}`);
    values.push(description || null);
  }
  if (location !== undefined) {
    fields.push(`location = $${paramIndex++}`);
    values.push(location || null);
  }
  if (start_time !== undefined) {
    fields.push(`start_time = $${paramIndex++}`);
    values.push(new Date(start_time).toISOString());
  }
  if (end_time !== undefined) {
    fields.push(`end_time = $${paramIndex++}`);
    values.push(new Date(end_time).toISOString());
  }
  if (all_day !== undefined) {
    fields.push(`all_day = $${paramIndex++}`);
    values.push(all_day);
  }
  if (recurrence_rule !== undefined) {
    fields.push(`recurrence_rule = $${paramIndex++}`);
    values.push(recurrence_rule || null);
  }
  if (calendar_id !== undefined) {
    fields.push(`calendar_id = $${paramIndex++}`);
    values.push(calendar_id);
  }
  if (requestedProjectId !== undefined) {
    fields.push(`project_id = $${paramIndex++}`);
    values.push(effectiveProjectId);
  }
  if (event_color !== undefined || color !== undefined) {
    fields.push(`event_color = $${paramIndex++}`);
    values.push(meta.eventColor);
  }
  if (status !== undefined) {
    fields.push(`status = $${paramIndex++}`);
    values.push(meta.status);
  }
  if (event_type !== undefined || eventType !== undefined) {
    fields.push(`event_type = $${paramIndex++}`);
    values.push(meta.eventType);
  }

  return { fields, values, paramIndex };
}

async function recordOccurrenceStatusActivity({
  userId,
  masterId,
  occurrenceDate,
  status,
  event,
  db,
}) {
  if (!event?.project_id) return;

  await recordProjectActivity({
    projectId: event.project_id,
    actorUserId: userId,
    action: status === "done" ? "completed" : "updated",
    entityType: "event",
    entityId: masterId,
    entityTitle: event.title,
    metadata: {
      occurrence_date: occurrenceDate,
      status,
    },
    db,
    strict: Boolean(db),
  });
}

async function recordEventUpdateActivity({
  userId,
  requestedProjectId,
  effectiveProjectId,
  currentEvent,
  updatedEvent,
  db,
}) {
  if (requestedProjectId !== undefined && currentEvent.project_id && !effectiveProjectId) {
    await recordProjectActivity({
      projectId: currentEvent.project_id,
      actorUserId: userId,
      action: "moved_to_personal",
      entityType: "event",
      entityId: currentEvent.id,
      entityTitle: currentEvent.title,
      db,
      strict: Boolean(db),
    });
    return;
  }

  if (!effectiveProjectId) return;

  await recordProjectActivity({
    projectId: effectiveProjectId,
    actorUserId: userId,
    action: requestedProjectId !== undefined && currentEvent.project_id !== effectiveProjectId
      ? "moved_to_project"
      : "updated",
    entityType: "event",
    entityId: updatedEvent.id,
    entityTitle: updatedEvent.title,
    db,
    strict: Boolean(db),
  });
}

async function applyOccurrenceStatus({ userId, masterId, id, body, currentEvent, meta }) {
  if (!currentEvent.recurrence_rule) {
    fail("This event is not recurring", 400);
  }

  const occurrenceDate = getOccurrenceDate(id, body.occurrence_date || currentEvent.start_time);
  if (!occurrenceDate) {
    fail("Occurrence date is required", 400);
  }

  let googleSyncUserId = null;
  try {
    googleSyncUserId = await transaction(async (client) => {
      await saveOccurrenceStatus({
        eventId: masterId,
        occurrenceDate,
        status: meta.status,
        userId,
        db: client,
      });

      await recordOccurrenceStatusActivity({
        userId,
        masterId,
        occurrenceDate,
        status: meta.status,
        event: currentEvent,
        db: client,
      });

      const googleEvent = await findEventWithGoogleCalendar(masterId, client);
      if (googleEvent?.google_calendar_id) {
        return googleEvent.user_id;
      }
      return null;
    });
  } catch (error) {
    if (error instanceof EventStatusMigrationMissingError) {
      fail(error.message, 500);
    }
    throw error;
  }

  const googleSyncResult = await attemptGoogleOccurrenceStatus({
    userId: googleSyncUserId,
    eventId: masterId,
    occurrenceDate,
    status: meta.status,
  });

  const updatedEvent = await findEventForViewer(userId, masterId);
  const linkedTasks = await listLinkedTasksForEvent(userId, masterId);

  const occurrenceInstance = findOccurrenceInstance({
    id,
    event: updatedEvent,
    occurrenceDate,
  });

  const event = {
    ...(occurrenceInstance || updatedEvent),
    id,
    status: meta.status,
    occurrence_status: meta.status,
    _isRecurrenceInstance: true,
    _masterEventId: masterId,
    _occurrenceDate: occurrenceDate,
    linked_tasks: linkedTasks,
  };

  return {
    event: presentEventForViewer(event, userId),
    ...googleSyncResult,
  };
}

async function applyEventUpdate({ userId, masterId, body, currentEvent, meta }) {
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
  const requestedProjectId = project_id !== undefined ? project_id : projectId;
  const effectiveProjectId = requestedProjectId !== undefined
    ? requestedProjectId || null
    : currentEvent.project_id;

  if (title !== undefined && (typeof title !== "string" || !title.trim() || title.trim().length > 255)) {
    fail("Title must be between 1 and 255 characters");
  }
  if (description !== undefined && description !== null && (typeof description !== "string" || description.length > 10000)) {
    fail("Description must be 10,000 characters or less");
  }
  if (location !== undefined && location !== null && (typeof location !== "string" || location.length > 255)) {
    fail("Location must be 255 characters or less");
  }
  const nextStart = new Date(start_time ?? currentEvent.start_time);
  const nextEnd = new Date(end_time ?? currentEvent.end_time);
  if (Number.isNaN(nextStart.getTime()) || Number.isNaN(nextEnd.getTime())) {
    fail("Start and end times must be valid dates");
  }
  if (nextEnd <= nextStart) fail("End time must be after start time");

  await assertProjectChangeAllowed({
    userId,
    requestedProjectId,
    effectiveProjectId,
    currentEvent,
  });
  await assertCalendarChangeAllowed({
    userId,
    calendarId: calendar_id,
    currentEvent,
  });

  const { fields, values, paramIndex } = buildEventUpdateFields({
    title,
    description,
    location,
    start_time,
    end_time,
    all_day,
    recurrence_rule,
    calendar_id,
    requestedProjectId,
    effectiveProjectId,
    event_color,
    color,
    status,
    event_type,
    eventType,
    meta,
  });

  if (fields.length === 0 && task_ids === undefined) {
    fail("No fields to update");
  }

  fields.push("updated_at = NOW()");
  const googleSyncUserId = await transaction(async (client) => {
    const changedEvent = await updateEventFields({
      eventId: masterId,
      fields,
      values,
      paramIndex,
      db: client,
    });

    await replaceLinkedTasksForEvent({
      userId,
      eventId: masterId,
      taskIds: task_ids,
      projectId: effectiveProjectId,
      db: client,
    });

    await recordEventUpdateActivity({
      userId,
      requestedProjectId,
      effectiveProjectId,
      currentEvent,
      updatedEvent: changedEvent,
      db: client,
    });

    const googleEvent = await findEventWithGoogleCalendar(masterId, client);
    if (googleEvent?.google_calendar_id) {
      return googleEvent.user_id;
    }
    return null;
  });

  const googleSyncResult = await attemptGoogleEventUpsert({
    userId: googleSyncUserId,
    eventId: masterId,
  });

  const linkedTasks = await listLinkedTasksForEvent(userId, masterId);
  const updatedEvent = await findEventForViewer(userId, masterId);

  return {
    event: presentEventForViewer({ ...updatedEvent, linked_tasks: linkedTasks }, userId),
    ...googleSyncResult,
  };
}

export async function getEventDetails({ userId, id }) {
  const masterId = getMasterEventId(id);
  const sourceEvent = await findEventForViewer(userId, masterId);

  if (!sourceEvent) {
    fail("Event not found", 404);
  }

  const linkedTasks = await listLinkedTasksForEvent(userId, masterId);
  const event = await applyRecurrenceInstanceData({
    id,
    masterId,
    event: { ...sourceEvent, linked_tasks: linkedTasks },
    sourceEvent,
  });

  return { event: presentEventForViewer(event, userId) };
}

export async function updateEventDetails({ userId, id, body }) {
  const masterId = getMasterEventId(id);
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
  const requestedProjectId = project_id !== undefined ? project_id : projectId;
  const requestedEventColor = event_color !== undefined ? event_color : color;
  const requestedEventType = event_type !== undefined ? event_type : eventType;
  const meta = validateEventMeta({
    eventColor: requestedEventColor,
    status,
    eventType: requestedEventType,
  });
  if (meta.error) {
    fail(meta.error);
  }

  const currentEvent = await findCurrentEventForViewer(userId, masterId);
  if (!currentEvent) {
    fail("Event not found", 404);
  }

  if (
    !canEditEventStatus(currentEvent, userId) &&
    !(await isProjectOwner(userId, currentEvent.project_id))
  ) {
    fail("Only the event creator or project owner can edit this event", 403);
  }

  if (isOccurrenceStatusOnlyUpdate({
    id,
    status,
    title,
    description,
    location,
    start_time,
    end_time,
    all_day,
    recurrence_rule,
    calendar_id,
    task_ids,
    requestedProjectId,
    requestedEventColor,
    requestedEventType,
  })) {
    return applyOccurrenceStatus({
      userId,
      masterId,
      id,
      body,
      currentEvent,
      meta,
    });
  }

  return applyEventUpdate({
    userId,
    masterId,
    body,
    currentEvent,
    meta,
  });
}

export async function deleteEventDetails({ userId, id }) {
  const masterId = getMasterEventId(id);
  const event = await findEventForDelete(userId, masterId);

  if (!event) {
    fail("Event not found", 404);
  }

  if (!(await canDeleteEvent(event, userId))) {
    fail("Only the project creator can delete project events", 403);
  }

  const googleSyncResult = await attemptGoogleEventDelete({
    userId: event.user_id,
    googleEventId: event.google_event_id,
    googleCalendarId: event.google_calendar_id,
  });
  if (googleSyncResult.googleSync === "failed") {
    fail(googleSyncResult.googleError, 502);
  }

  await transaction(async (client) => {
    if (event.project_id) {
      await recordProjectActivity({
        projectId: event.project_id,
        actorUserId: userId,
        action: "deleted",
        entityType: "event",
        entityId: event.id,
        entityTitle: event.title,
        db: client,
        strict: true,
      });
    }

    await deleteEventForOwner(masterId, client);
  });

  return { message: "Event deleted", ...googleSyncResult };
}

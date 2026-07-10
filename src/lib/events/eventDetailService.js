import { recordProjectActivity } from "@/lib/collaborationActivity";
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
  deleteLinkedGoogleEvent,
  pushEventUpdateToGoogle,
  pushOccurrenceStatusToGoogle,
} from "@/lib/events/googleEventSyncService";
import { resolveEventCompletionCheck } from "@/lib/notifications/notificationService";

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
  });
}

async function recordEventUpdateActivity({
  userId,
  requestedProjectId,
  effectiveProjectId,
  currentEvent,
  updatedEvent,
}) {
  if (requestedProjectId !== undefined && currentEvent.project_id && !effectiveProjectId) {
    await recordProjectActivity({
      projectId: currentEvent.project_id,
      actorUserId: userId,
      action: "moved_to_personal",
      entityType: "event",
      entityId: currentEvent.id,
      entityTitle: currentEvent.title,
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

  try {
    await saveOccurrenceStatus({
      eventId: masterId,
      occurrenceDate,
      status: meta.status,
      userId,
    });
  } catch (error) {
    if (error instanceof EventStatusMigrationMissingError) {
      fail(error.message, 500);
    }
    throw error;
  }

  const googleError = await pushOccurrenceStatusToGoogle({
    userId,
    eventId: masterId,
    occurrenceDate,
    status: meta.status,
  });

  await resolveEventCompletionCheck({
    userId,
    eventId: masterId,
    occurrenceDate,
    status: meta.status,
  });

  const updatedEvent = await findEventForViewer(userId, masterId);
  const linkedTasks = await listLinkedTasksForEvent(userId, masterId);

  await recordOccurrenceStatusActivity({
    userId,
    masterId,
    occurrenceDate,
    status: meta.status,
    event: updatedEvent,
  });

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
    googleError,
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

  if (fields.length === 0) {
    fail("No fields to update");
  }

  fields.push("updated_at = NOW()");
  await updateEventFields({ eventId: masterId, fields, values, paramIndex });

  if (status === "done" || status === "missed") {
    await resolveEventCompletionCheck({
      userId,
      eventId: masterId,
      status: meta.status,
    });
  }

  await replaceLinkedTasksForEvent({
    userId,
    eventId: masterId,
    taskIds: task_ids,
    projectId: effectiveProjectId,
  });

  const linkedTasks = await listLinkedTasksForEvent(userId, masterId);
  const googleEvent = await findEventWithGoogleCalendar(masterId);
  const googleError = await pushEventUpdateToGoogle({
    userId,
    eventId: masterId,
    event: googleEvent,
  });
  const updatedEvent = await findEventForViewer(userId, masterId);

  await recordEventUpdateActivity({
    userId,
    requestedProjectId,
    effectiveProjectId,
    currentEvent,
    updatedEvent,
  });

  return {
    event: presentEventForViewer({ ...updatedEvent, linked_tasks: linkedTasks }, userId),
    googleError,
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
    fail("Only the event creator or project owner can delete this event", 403);
  }

  await deleteEventForOwner(masterId);

  if (event.project_id) {
    await recordProjectActivity({
      projectId: event.project_id,
      actorUserId: userId,
      action: "deleted",
      entityType: "event",
      entityId: event.id,
      entityTitle: event.title,
    });
  }

  deleteLinkedGoogleEvent({ userId, event });

  return { message: "Event deleted" };
}

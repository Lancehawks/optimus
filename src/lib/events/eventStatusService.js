import {
  expandRecurrences,
  getOccurrenceDateKey,
  isRecurrenceInstanceId,
} from "@/lib/recurrence";
import { getOccurrenceStatus, upsertOccurrenceStatus } from "@/lib/eventOccurrenceStatus";

export class EventStatusMigrationMissingError extends Error {
  constructor() {
    super("Calendar occurrence status migration has not been applied");
    this.name = "EventStatusMigrationMissingError";
  }
}

export function isOccurrenceStatusOnlyUpdate({
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
}) {
  return (
    isRecurrenceInstanceId(id) &&
    status !== undefined &&
    title === undefined &&
    description === undefined &&
    location === undefined &&
    start_time === undefined &&
    end_time === undefined &&
    all_day === undefined &&
    recurrence_rule === undefined &&
    calendar_id === undefined &&
    task_ids === undefined &&
    requestedProjectId === undefined &&
    requestedEventColor === undefined &&
    requestedEventType === undefined
  );
}

export function getOccurrenceDate(id, fallbackStartTime) {
  return getOccurrenceDateKey(id, fallbackStartTime);
}

export function findOccurrenceInstance({ id, event, occurrenceDate }) {
  if (!event || !occurrenceDate) return null;

  const dayStart = new Date(`${occurrenceDate}T00:00:00`);
  const dayEnd = new Date(`${occurrenceDate}T23:59:59.999`);

  return expandRecurrences([event], dayStart, dayEnd)
    .find((item) => item.id === id) || null;
}

export async function saveOccurrenceStatus({
  eventId,
  occurrenceDate,
  status,
  userId,
  db,
}) {
  try {
    return await upsertOccurrenceStatus({
      eventId,
      occurrenceDate,
      status,
      userId,
      db,
    });
  } catch (error) {
    if (error.code === "42P01") {
      throw new EventStatusMigrationMissingError();
    }
    throw error;
  }
}

export async function applyRecurrenceInstanceData({ id, masterId, event, sourceEvent }) {
  if (!isRecurrenceInstanceId(id)) return event;

  const occurrenceDate = getOccurrenceDate(id, event.start_time);
  let occurrenceEvent = event;
  const instance = findOccurrenceInstance({ id, event: sourceEvent, occurrenceDate });

  if (instance) {
    occurrenceEvent = { ...instance, linked_tasks: event.linked_tasks };
  }

  occurrenceEvent.id = id;
  occurrenceEvent._isRecurrenceInstance = true;
  occurrenceEvent._masterEventId = masterId;
  occurrenceEvent._occurrenceDate = occurrenceDate;

  if (!occurrenceDate) return occurrenceEvent;

  try {
    const occurrenceStatus = await getOccurrenceStatus(masterId, occurrenceDate);
    if (occurrenceStatus?.status) {
      occurrenceEvent.status = occurrenceStatus.status;
      occurrenceEvent.occurrence_status = occurrenceStatus.status;
    }
  } catch (error) {
    if (error.code !== "42P01") throw error;
  }

  return occurrenceEvent;
}

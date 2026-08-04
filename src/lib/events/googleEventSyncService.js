import { logError } from "@/lib/logger";
import { getCalendarClient } from "@/lib/google";
import {
  deleteEventFromGoogle,
  importGoogleCalendars,
  pushEventOccurrenceStatusToGoogle,
  pushEventToGoogle,
  pushPendingEventsToGoogle,
  syncGoogleCalendarSet,
} from "@/lib/googleSync";

const NOT_CONNECTED = {
  googleError: null,
  googleSync: "not_connected",
};

async function attemptGoogleSync(enabled, operation, operationName) {
  if (!enabled) return NOT_CONNECTED;

  try {
    await operation();
    return {
      googleError: null,
      googleSync: "completed",
    };
  } catch (error) {
    logError("google_sync.failed", error, { operation: operationName });
    return {
      googleError: "Google Calendar sync failed",
      googleSync: "failed",
    };
  }
}

export function attemptGoogleEventUpsert({ userId, eventId }) {
  return attemptGoogleSync(
    Boolean(userId && eventId),
    () => pushEventToGoogle(userId, eventId),
    "Google event upsert"
  );
}

export function attemptGoogleOccurrenceStatus({
  userId,
  eventId,
  occurrenceDate,
  status,
}) {
  return attemptGoogleSync(
    Boolean(userId && eventId && occurrenceDate && status),
    () => pushEventOccurrenceStatusToGoogle(userId, eventId, occurrenceDate, status),
    "Google occurrence status"
  );
}

export function attemptGoogleEventDelete({
  userId,
  googleEventId,
  googleCalendarId,
}) {
  return attemptGoogleSync(
    Boolean(userId && googleEventId && googleCalendarId),
    () => deleteEventFromGoogle(userId, googleEventId, googleCalendarId),
    "Google event delete"
  );
}

export function attemptGoogleCalendarSync({ userId }) {
  return attemptGoogleSync(
    Boolean(userId),
    async () => {
      const calendarClient = await getCalendarClient(userId);
      if (!calendarClient) throw new Error("Google Calendar is not connected.");
      const calendarIds = await importGoogleCalendars(userId, calendarClient);
      await pushPendingEventsToGoogle(userId, calendarClient);
      await syncGoogleCalendarSet(userId, calendarIds, calendarClient);
    },
    "Google calendar sync"
  );
}

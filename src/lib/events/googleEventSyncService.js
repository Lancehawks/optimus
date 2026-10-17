import { logError } from "@/lib/logger";
import { getCalendarClient } from "@/lib/google";
import {
  drainGoogleEventDeletions,
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

function summarize(results) {
  const items = results.flat().filter(Boolean);
  return {
    failed: items.reduce((sum, item) => sum + (item.failed || 0), 0),
    reviewRequired: items.reduce((sum, item) => sum + (item.reviewRequired || (item.skipped ? 1 : 0)), 0),
    pending: items.some(item => item.pending),
  };
}

async function collect(operation) {
  try { return await operation(); }
  catch (error) {
    logError('google_sync.item_failed', error);
    return { failed: 1 };
  }
}

async function attemptGoogleSync(enabled, operation, operationName) {
  if (!enabled) return NOT_CONNECTED;

  try {
    const result = await operation();
    if (result?.googleSync === 'not_connected') return NOT_CONNECTED;
    const details = summarize([result]);
    if (details.failed || details.reviewRequired || details.pending) {
      return { ...details, googleSync: 'partial',
        googleError: details.reviewRequired
          ? 'Some events need review before syncing. Your local changes are saved.'
          : 'Some Google changes are still pending. Sync again to retry.' };
    }
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
    async () => {
      const deleted = await collect(() => drainGoogleEventDeletions(userId));
      const pushed = await collect(() => pushEventToGoogle(userId, eventId));
      return summarize([deleted, pushed]);
    },
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
}) {
  return attemptGoogleSync(
    Boolean(userId),
    () => drainGoogleEventDeletions(userId),
    "Google event delete"
  );
}

export function attemptGoogleCalendarSync({ userId }) {
  return attemptGoogleSync(
    Boolean(userId),
    async () => {
      const calendarClient = await getCalendarClient(userId);
      if (!calendarClient) throw new Error("Google Calendar is not connected.");
      const { calendarIds, writableCalendarIds } = await importGoogleCalendars(userId, calendarClient);
      const deleted = await collect(() => drainGoogleEventDeletions(userId, calendarClient));
      const pushed = await collect(() => pushPendingEventsToGoogle(userId, calendarClient, 100, writableCalendarIds));
      const imported = await collect(() => syncGoogleCalendarSet(userId, calendarIds, calendarClient));
      return summarize([deleted, pushed, imported]);
    },
    "Google calendar sync"
  );
}

export async function attemptGoogleDayPlanSync({ userId, eventIds }) {
  return attemptGoogleSync(true, async () => {
    const calendarClient = await getCalendarClient(userId);
    if (!calendarClient) return NOT_CONNECTED;
    const results = [await collect(() => drainGoogleEventDeletions(userId, calendarClient))];
    for (const eventId of eventIds) results.push(await collect(() => pushEventToGoogle(userId, eventId, calendarClient)));
    return summarize(results);
  }, 'Google day plan sync');
}

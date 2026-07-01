import {
  deleteEventFromGoogle,
  pushEventOccurrenceStatusToGoogle,
  pushEventToGoogle,
} from "@/lib/googleSync";

export async function pushEventUpdateToGoogle({ userId, eventId, event }) {
  if (!event?.google_calendar_id || event.user_id !== userId) {
    return null;
  }

  try {
    await pushEventToGoogle(userId, eventId);
    return null;
  } catch (err) {
    console.error("Google push error:", err);
    return err.message || "Failed to sync to Google Calendar";
  }
}

export async function pushOccurrenceStatusToGoogle({
  userId,
  eventId,
  occurrenceDate,
  status,
}) {
  try {
    await pushEventOccurrenceStatusToGoogle(userId, eventId, occurrenceDate, status);
    return null;
  } catch (err) {
    console.error("Google occurrence status push error:", err);
    return err.message || "Failed to sync occurrence status to Google Calendar";
  }
}

export function deleteLinkedGoogleEvent({ userId, event }) {
  if (!event?.google_event_id || !event?.google_calendar_id) return;

  deleteEventFromGoogle(
    userId,
    event.google_event_id,
    event.google_calendar_id
  ).catch((err) => console.error("Google delete error:", err));
}

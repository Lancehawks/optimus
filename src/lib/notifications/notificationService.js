import { resolveEventCompletionNotification } from "@/lib/notifications/notificationQueries";

export async function resolveEventCompletionCheck({
  userId,
  eventId,
  occurrenceDate,
  status,
  db,
}) {
  return resolveEventCompletionNotification({
    userId,
    eventId,
    occurrenceDate,
    status,
    db,
  });
}

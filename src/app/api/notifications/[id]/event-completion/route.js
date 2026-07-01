import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { query } from "@/lib/db";
import { recordProjectActivity } from "@/lib/collaborationActivity";
import { getMasterEventId, getOccurrenceDateKey, isRecurrenceInstanceId } from "@/lib/recurrence";
import { upsertOccurrenceStatus } from "@/lib/eventOccurrenceStatus";
import { resolveEventCompletionNotification } from "@/lib/notifications/notificationQueries";
import { pushEventToGoogle, pushEventOccurrenceStatusToGoogle } from "@/lib/googleSync";

const COMPLETION_STATUSES = new Set(["done", "missed"]);

export const PATCH = withAuth(async (request, { params }) => {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const status = body.status;

  if (!COMPLETION_STATUSES.has(status)) {
    return apiError("Choose done or missed", 400);
  }

  const notificationResult = await query(
    `SELECT id, entity_id, metadata
     FROM notifications
     WHERE id = $1
       AND user_id = $2
       AND type = 'event_completion_check'
     LIMIT 1`,
    [id, request.user.id]
  );

  const notification = notificationResult.rows[0];
  if (!notification) {
    return apiError("Notification not found", 404);
  }

  const metadata = notification.metadata || {};
  if ((metadata.status || "pending") !== "pending") {
    return apiError("This event check is already answered", 409);
  }

  const eventInstanceId = metadata.event_instance_id || metadata.event_id || notification.entity_id;
  const masterId = getMasterEventId(eventInstanceId);

  const eventResult = await query(
    `SELECT e.id, e.user_id, e.project_id, e.title, e.recurrence_rule
     FROM events e
     WHERE e.id = $1 AND e.user_id = $2
     LIMIT 1`,
    [masterId, request.user.id]
  );

  const event = eventResult.rows[0];
  if (!event) {
    return apiError("Event not found", 404);
  }

  let googleError = null;

  if (isRecurrenceInstanceId(eventInstanceId)) {
    const occurrenceDate = metadata.occurrence_date || getOccurrenceDateKey(eventInstanceId);
    if (!occurrenceDate) {
      return apiError("Occurrence date is required", 400);
    }

    await upsertOccurrenceStatus({
      eventId: masterId,
      occurrenceDate,
      status,
      userId: request.user.id,
    });

    try {
      await pushEventOccurrenceStatusToGoogle(request.user.id, masterId, occurrenceDate, status);
    } catch (err) {
      console.error("Google occurrence status push error:", err);
      googleError = err.message || "Failed to sync occurrence status to Google Calendar";
    }
  } else {
    await query(
      `UPDATE events
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3`,
      [status, masterId, request.user.id]
    );

    try {
      await pushEventToGoogle(request.user.id, masterId);
    } catch (err) {
      console.error("Google status push error:", err);
      googleError = err.message || "Failed to sync status to Google Calendar";
    }
  }

  const respondedAt = new Date().toISOString();
  await resolveEventCompletionNotification({
    userId: request.user.id,
    eventId: masterId,
    occurrenceDate: metadata.occurrence_date || null,
    status,
  });

  if (event.project_id) {
    await recordProjectActivity({
      projectId: event.project_id,
      actorUserId: request.user.id,
      action: status === "done" ? "completed" : "updated",
      entityType: "event",
      entityId: masterId,
      entityTitle: event.title,
      metadata: {
        status,
        occurrence_date: metadata.occurrence_date || null,
      },
    });
  }

  return apiResponse({
    notification: {
      id,
      status,
      read_at: respondedAt,
    },
    googleError,
  });
});

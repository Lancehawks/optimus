import crypto from "node:crypto";
import { apiError, apiResponse } from "@/lib/apiUtils";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import {
  acquireIntegrationLock,
  claimIntegrationJobs,
  completeIntegrationJob,
  googleCalendarJob,
  releaseIntegrationLock,
  retryIntegrationJob,
} from "@/lib/integrationJobs";
import { query } from "@/lib/db";
import { getNotificationPreferences } from "@/lib/notificationPreferenceStore";
import { syncLiveNotifications } from "@/lib/notifications";
import { persistMissedEventStatusesForUser } from "@/lib/notifications/live/candidates";
import { dispatchExpoPushNotifications } from "@/lib/pushDelivery";
import { getCalendarClient } from "@/lib/google";
import {
  deleteEventFromGoogle,
  importGoogleCalendars,
  pushEventOccurrenceStatusToGoogle,
  pushEventToGoogle,
  syncGoogleEvents,
} from "@/lib/googleSync";
import { logError, logInfo } from "@/lib/logger";

export const maxDuration = 60;

function jobLockKey(job) {
  switch (job.type) {
    case "notification_sync": return `notification:${job.user_id}`;
    case "google_calendar_sync": return `google-import:${job.user_id}`;
    case "google_calendar_single_sync": return `google-calendar:${job.user_id}:${job.payload.calendarId}`;
    case "google_event_upsert": return `google-event:${job.payload.eventId}`;
    case "google_event_delete": return `google-delete:${job.payload.googleCalendarId}:${job.payload.googleEventId}`;
    case "google_occurrence_status": return `google-occurrence:${job.payload.eventId}:${job.payload.occurrenceDate}`;
    default: return `job:${job.id}`;
  }
}

async function processJob(job) {
  switch (job.type) {
    case "notification_sync": {
      await persistMissedEventStatusesForUser(job.user_id);
      const preferences = await getNotificationPreferences(job.user_id);
      await syncLiveNotifications(job.user_id, preferences);
      const summary = await dispatchExpoPushNotifications(job.user_id, preferences);
      logInfo("notification_push_dispatch.completed", {
        jobId: job.id,
        userId: job.user_id,
        disabled: summary.disabled,
        claimed: summary.claimed,
        accepted: summary.accepted,
        delivered: summary.delivered,
        failed: summary.failed || 0,
      });
      return;
    }
    case "google_calendar_sync": {
      const calendarClient = await getCalendarClient(job.user_id);
      if (!calendarClient) throw new Error("Google Calendar is not connected.");
      const calendarIds = await importGoogleCalendars(job.user_id, calendarClient);
      await Promise.all(calendarIds.map((calendarId) => googleCalendarJob({
        userId: job.user_id,
        calendarId,
        parentJobId: job.id,
      })));
      return;
    }
    case "google_calendar_single_sync":
      await syncGoogleEvents(job.user_id, job.payload.calendarId);
      return;
    case "google_event_upsert":
      await pushEventToGoogle(job.user_id, job.payload.eventId);
      return;
    case "google_event_delete":
      await deleteEventFromGoogle(
        job.user_id,
        job.payload.googleEventId,
        job.payload.googleCalendarId
      );
      return;
    case "google_occurrence_status": {
      const current = await query(
        `SELECT status FROM event_occurrence_statuses
         WHERE event_id = $1 AND occurrence_date = $2::date`,
        [job.payload.eventId, job.payload.occurrenceDate]
      );
      if (!current.rows[0]) return;
      await pushEventOccurrenceStatusToGoogle(
        job.user_id,
        job.payload.eventId,
        job.payload.occurrenceDate,
        current.rows[0].status
      );
      return;
    }
    default:
      throw new Error(`Unsupported integration job type: ${job.type}`);
  }
}

export async function GET(request) {
  if (!isAuthorizedCronRequest(request)) return apiError("Unauthorized", 401);

  const workerId = `integrations-${crypto.randomUUID()}`;
  const startedAt = Date.now();
  const jobLimit = Math.min(Math.max(Number(process.env.INTEGRATION_JOB_BATCH) || 20, 1), 100);
  let claimed = 0;
  let completed = 0;
  let retried = 0;

  while (claimed < jobLimit && Date.now() - startedAt < 45_000) {
    const batch = await claimIntegrationJobs(workerId, Math.min(4, jobLimit - claimed));
    if (batch.length === 0) break;
    claimed += batch.length;
    await Promise.all(batch.map(async (job) => {
      const lockKey = jobLockKey(job);
      const lockOwner = `${workerId}:${job.id}`;
      try {
        const acquired = await acquireIntegrationLock(lockKey, lockOwner);
        if (!acquired) throw new Error("A matching integration job is already running");
        await processJob(job);
        await completeIntegrationJob(job.id);
        completed += 1;
      } catch (error) {
        logError("integration_job.failed", error, {
          jobId: job.id,
          jobType: job.type,
          attempt: job.attempts,
        });
        await retryIntegrationJob(job, error);
        retried += 1;
      } finally {
        await releaseIntegrationLock(lockKey, lockOwner);
      }
    }));
  }

  logInfo("integration_worker.completed", { claimed, completed, retried, durationMs: Date.now() - startedAt });
  return apiResponse({ claimed, completed, retried });
}

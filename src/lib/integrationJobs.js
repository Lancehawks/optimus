import { query, transaction } from "@/lib/db";

function runQuery(db, text, params) {
  return typeof db === "function" ? db(text, params) : db.query(text, params);
}

function safePayload(payload) {
  return JSON.stringify(payload && typeof payload === "object" ? payload : {});
}

export async function enqueueIntegrationJob({
  type,
  userId = null,
  payload = {},
  idempotencyKey,
  maxAttempts = 5,
  db = query,
}) {
  const result = await runQuery(
    db,
    `INSERT INTO integration_jobs
       (type, user_id, payload, idempotency_key, max_attempts)
     VALUES ($1, $2, $3::jsonb, $4, $5)
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING id, type, status, attempts, created_at`,
    [type, userId, safePayload(payload), idempotencyKey, maxAttempts]
  );
  if (result.rows[0]) return result.rows[0];

  const existing = await runQuery(
    db,
    `SELECT id, type, status, attempts, created_at
     FROM integration_jobs WHERE idempotency_key = $1`,
    [idempotencyKey]
  );
  return existing.rows[0] || null;
}

export async function claimIntegrationJobs(workerId, limit = 20) {
  return transaction(async (client) => {
    const result = await client.query(
      `WITH claimable AS (
         SELECT id
         FROM integration_jobs
         WHERE (
           (status = 'queued' AND available_at <= NOW())
           OR (status = 'processing' AND locked_at < NOW() - INTERVAL '15 minutes')
         )
           AND attempts < max_attempts
         ORDER BY available_at ASC, created_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT $1
       )
       UPDATE integration_jobs jobs
       SET status = 'processing',
           attempts = jobs.attempts + 1,
           locked_at = NOW(),
           locked_by = $2,
           updated_at = NOW()
       FROM claimable
       WHERE jobs.id = claimable.id
       RETURNING jobs.*`,
      [Math.min(Math.max(Number(limit) || 20, 1), 100), workerId]
    );
    return result.rows;
  });
}

export async function completeIntegrationJob(id) {
  await query(
    `UPDATE integration_jobs
     SET status = 'completed', completed_at = NOW(), locked_at = NULL,
         locked_by = NULL, last_error = NULL, updated_at = NOW()
     WHERE id = $1`,
    [id]
  );
}

export async function retryIntegrationJob(job, error) {
  const exhausted = Number(job.attempts) >= Number(job.max_attempts);
  const backoffSeconds = Math.min(15 * (2 ** Math.max(Number(job.attempts) - 1, 0)), 3600);
  await query(
    `UPDATE integration_jobs
     SET status = $2,
         available_at = CASE WHEN $2 = 'queued'
           THEN NOW() + ($3 * INTERVAL '1 second') ELSE available_at END,
         locked_at = NULL,
         locked_by = NULL,
         last_error = $4,
         updated_at = NOW()
     WHERE id = $1`,
    [
      job.id,
      exhausted ? "failed" : "queued",
      backoffSeconds,
      String(error?.message || error || "Background job failed").slice(0, 2000),
    ]
  );
}

export async function getLatestIntegrationJob(userId, type) {
  const result = await query(
    `SELECT id, type, status, attempts, max_attempts, last_error,
            available_at, completed_at, created_at, updated_at
     FROM integration_jobs
     WHERE user_id = $1 AND type = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, type]
  );
  return result.rows[0] || null;
}

export async function acquireIntegrationLock(lockKey, workerId, leaseSeconds = 900) {
  const result = await query(
    `INSERT INTO integration_job_locks (lock_key, locked_by, locked_until)
     VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 second'))
     ON CONFLICT (lock_key) DO UPDATE SET
       locked_by = EXCLUDED.locked_by,
       locked_until = EXCLUDED.locked_until,
       updated_at = NOW()
     WHERE integration_job_locks.locked_until < NOW()
     RETURNING lock_key`,
    [lockKey, workerId, Math.min(Math.max(Number(leaseSeconds) || 900, 30), 3600)]
  );
  return Boolean(result.rows[0]);
}

export async function releaseIntegrationLock(lockKey, workerId) {
  await query(
    "DELETE FROM integration_job_locks WHERE lock_key = $1 AND locked_by = $2",
    [lockKey, workerId]
  );
}

export function googleCalendarJob({ userId, calendarId, parentJobId, db = query }) {
  return enqueueIntegrationJob({
    type: "google_calendar_single_sync",
    userId,
    payload: { calendarId, parentJobId },
    idempotencyKey: `google-calendar-single:${parentJobId}:${calendarId}`,
    maxAttempts: 5,
    db,
  });
}

export function calendarSyncJob({ userId, source = "manual", db = query }) {
  const minuteBucket = Math.floor(Date.now() / 60_000);
  return enqueueIntegrationJob({
    type: "google_calendar_sync",
    userId,
    payload: { source },
    idempotencyKey: `google-calendar-sync:${userId}:${minuteBucket}`,
    maxAttempts: 5,
    db,
  });
}

export function googleEventUpsertJob({ userId, eventId, version, db = query }) {
  return enqueueIntegrationJob({
    type: "google_event_upsert",
    userId,
    payload: { eventId, version },
    idempotencyKey: `google-event-upsert:${eventId}:${version}`,
    maxAttempts: 8,
    db,
  });
}

export function googleEventDeleteJob({ userId, googleEventId, googleCalendarId, db = query }) {
  return enqueueIntegrationJob({
    type: "google_event_delete",
    userId,
    payload: { googleEventId, googleCalendarId },
    idempotencyKey: `google-event-delete:${googleCalendarId}:${googleEventId}`,
    maxAttempts: 8,
    db,
  });
}

export function googleOccurrenceStatusJob({ userId, eventId, occurrenceDate, status, version, db = query }) {
  return enqueueIntegrationJob({
    type: "google_occurrence_status",
    userId,
    payload: { eventId, occurrenceDate, status, version },
    idempotencyKey: `google-occurrence:${eventId}:${occurrenceDate}:${version}`,
    maxAttempts: 8,
    db,
  });
}

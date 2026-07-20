import { query } from "@/lib/db";
import {
  getOccurrenceDateKey,
  getOccurrenceDateKeyFromDate,
  isRecurrenceInstanceId,
} from "@/lib/recurrence";
import { getEventDisplayStatus } from "@/lib/eventDisplay";

const TERMINAL_EVENT_STATUSES = new Set(["done", "missed", "cancelled"]);

function runQuery(db, text, params) {
  return typeof db === "function" ? db(text, params) : db.query(text, params);
}

function normalizeDateKey(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const match = value.match(/^\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
  }
  return getOccurrenceDateKeyFromDate(value);
}

function getEventOccurrenceKey(event) {
  const masterId = event?._masterEventId || (isRecurrenceInstanceId(event?.id) ? event.id.split("___")[0] : null);
  const occurrenceDate = event?._occurrenceDate || getOccurrenceDateKey(event?.id, event?.start_time);
  if (!masterId || !occurrenceDate) return null;
  return { masterId, occurrenceDate };
}

export async function getOccurrenceStatus(eventId, occurrenceDate) {
  const dateKey = normalizeDateKey(occurrenceDate);
  if (!eventId || !dateKey) return null;

  const result = await query(
    `SELECT event_id, occurrence_date::text AS occurrence_date, status, updated_by, updated_at
     FROM event_occurrence_statuses
     WHERE event_id = $1 AND occurrence_date = $2::date
     LIMIT 1`,
    [eventId, dateKey]
  );

  return result.rows[0] || null;
}

export async function upsertOccurrenceStatus({ eventId, occurrenceDate, status, userId, db = query }) {
  const dateKey = normalizeDateKey(occurrenceDate);
  if (!eventId || !dateKey || !status) return null;

  const result = await runQuery(db,
    `INSERT INTO event_occurrence_statuses
       (event_id, occurrence_date, status, updated_by)
     VALUES ($1, $2::date, $3, $4)
     ON CONFLICT (event_id, occurrence_date)
     DO UPDATE SET
       status = EXCLUDED.status,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()
     RETURNING event_id, occurrence_date::text AS occurrence_date, status, updated_by, updated_at`,
    [eventId, dateKey, status, userId || null]
  );

  return result.rows[0] || null;
}

export async function applyOccurrenceStatuses(events) {
  if (!Array.isArray(events) || events.length === 0) return events;

  const occurrences = events
    .map((event) => ({ event, key: getEventOccurrenceKey(event) }))
    .filter((item) => item.key);

  if (occurrences.length === 0) return events;

  const masterIds = [...new Set(occurrences.map((item) => item.key.masterId))];
  const occurrenceDates = [...new Set(occurrences.map((item) => item.key.occurrenceDate))];

  try {
    const result = await query(
      `SELECT event_id, occurrence_date::text AS occurrence_date, status
       FROM event_occurrence_statuses
       WHERE event_id = ANY($1::uuid[])
         AND occurrence_date = ANY($2::date[])`,
      [masterIds, occurrenceDates]
    );

    const statusByOccurrence = new Map(
      result.rows.map((row) => [`${row.event_id}:${row.occurrence_date}`, row.status])
    );

    for (const { event, key } of occurrences) {
      event._occurrenceDate = key.occurrenceDate;
      const occurrenceStatus = statusByOccurrence.get(`${key.masterId}:${key.occurrenceDate}`);
      if (occurrenceStatus) {
        event.status = occurrenceStatus;
        event.occurrence_status = occurrenceStatus;
      }
    }
  } catch (error) {
    if (error.code !== "42P01") throw error;
  }

  return events;
}

// Read paths may derive a missed display state, but must never persist it.
// Durable status persistence is handled by the scheduled notification worker.
export function applyMissedEventDisplayStatuses(events, now = new Date()) {
  if (!Array.isArray(events)) return events;
  for (const event of events) {
    if (getEventDisplayStatus(event, now) !== "missed") continue;
    if (TERMINAL_EVENT_STATUSES.has(event.status)) continue;
    event.status = "missed";
    if (getEventOccurrenceKey(event)) event.occurrence_status = "missed";
  }
  return events;
}

export async function syncMissedEventStatuses(events, userId, now = new Date(), options = {}) {
  if (!Array.isArray(events) || events.length === 0) return events;

  const persistAfterMs = Number(options.persistAfterMs) || 0;
  const ownedNonRecurringIds = [];
  const ownedOccurrences = [];

  for (const event of events) {
    const originalStatus = event.status || "scheduled";
    const displayStatus = getEventDisplayStatus(event, now);
    if (displayStatus !== "missed") continue;

    if (originalStatus !== "missed") {
      event.status = "missed";
      if (event._masterEventId || isRecurrenceInstanceId(event.id)) {
        event.occurrence_status = "missed";
      }
    }

    if (TERMINAL_EVENT_STATUSES.has(originalStatus)) continue;
    const end = new Date(event.end_time);
    const canPersistMissed = !Number.isNaN(end.getTime()) && now.getTime() - end.getTime() >= persistAfterMs;
    if (!canPersistMissed) continue;
    if (!userId || event.user_id !== userId) continue;

    const occurrenceKey = getEventOccurrenceKey(event);
    if (occurrenceKey) {
      ownedOccurrences.push(occurrenceKey);
    } else if (event.id && !TERMINAL_EVENT_STATUSES.has(originalStatus)) {
      ownedNonRecurringIds.push(event.id);
    }
  }

  const uniqueNonRecurringIds = [...new Set(ownedNonRecurringIds)];
  if (uniqueNonRecurringIds.length > 0) {
    await query(
      `UPDATE events
       SET status = 'missed', updated_at = NOW()
       WHERE id = ANY($1::uuid[])
         AND user_id = $2
         AND COALESCE(status, 'scheduled') NOT IN ('done', 'missed', 'cancelled')`,
      [uniqueNonRecurringIds, userId]
    );
  }

  const uniqueOccurrences = new Map(
    ownedOccurrences.map((item) => [`${item.masterId}:${item.occurrenceDate}`, item])
  );

  try {
    const occurrences = [...uniqueOccurrences.values()];
    if (occurrences.length > 0) {
      await query(
        `INSERT INTO event_occurrence_statuses
           (event_id, occurrence_date, status, updated_by)
         SELECT occurrence.event_id, occurrence.occurrence_date, 'missed', $3
         FROM unnest($1::uuid[], $2::date[]) AS occurrence(event_id, occurrence_date)
         ON CONFLICT (event_id, occurrence_date)
         DO UPDATE SET
           status = CASE
             WHEN event_occurrence_statuses.status IN ('done', 'cancelled')
               THEN event_occurrence_statuses.status
             ELSE 'missed'
           END,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()`,
        [
          occurrences.map((occurrence) => occurrence.masterId),
          occurrences.map((occurrence) => occurrence.occurrenceDate),
          userId,
        ]
      );
    }
  } catch (error) {
    if (error.code !== "42P01") throw error;
  }

  return events;
}

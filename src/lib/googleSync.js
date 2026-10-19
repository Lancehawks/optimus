import { dateKey, addDateDays, zonedInputToDate } from '@/lib/calendarTime';
import { buildGooglePatch, legacyEventMatches } from "@/lib/googleEventPayload";
import { query, transaction } from "@/lib/db";
import { isSerializationFailure } from "@/lib/databaseRetry";
import { getCalendarClient } from "@/lib/google";
import { logError } from "@/lib/logger";
import { rruleToAppFormat, appFormatToRrule } from "@/lib/rruleConverter";

const OPTIMUS_STATUS_LABELS = {
  scheduled: "Scheduled",
  in_progress: "In progress",
  done: "Done",
  missed: "Missed",
  cancelled: "Cancelled",
};
const OPTIMUS_STATUS_VALUES = new Set(Object.keys(OPTIMUS_STATUS_LABELS));
const OPTIMUS_STATUS_LINE_RE = /(?:\r?\n){0,2}\[Optimus status: ([^\]]+)\]\s*$/i;
const GOOGLE_REQUEST_OPTIONS = { timeout: 15_000 };
const WRITABLE_GOOGLE_ACCESS_ROLES = new Set(["owner", "writer"]);
const SYNC_TRANSACTION_ATTEMPTS = 4;

function isReadOnlyCalendarError(error) {
  const status = Number(error?.code || error?.response?.status || 0);
  const message = String(error?.message || error?.response?.data?.error?.message || "");
  return status === 403 && /read[ -]?only/i.test(message);
}

export function normalizeOptimusStatus(status) {
  return OPTIMUS_STATUS_VALUES.has(status) ? status : "scheduled";
}

export function stripOptimusStatusLine(description) {
  if (!description) return null;
  const stripped = String(description).replace(OPTIMUS_STATUS_LINE_RE, "").trim();
  return stripped || null;
}

export function getOptimusStatusFromGoogleEvent(gEvent) {
  const privateStatus = gEvent?.extendedProperties?.private?.optimus_status;
  if (OPTIMUS_STATUS_VALUES.has(privateStatus)) return privateStatus;

  const match = String(gEvent?.description || "").match(OPTIMUS_STATUS_LINE_RE);
  if (!match) return null;

  const normalizedLabel = match[1].trim().toLowerCase().replace(/\s+/g, "_");
  return OPTIMUS_STATUS_VALUES.has(normalizedLabel) ? normalizedLabel : null;
}

export function withOptimusStatusLine(description, status) {
  const cleanDescription = stripOptimusStatusLine(description);
  const normalizedStatus = normalizeOptimusStatus(status);
  const statusLine = `[Optimus status: ${OPTIMUS_STATUS_LABELS[normalizedStatus]}]`;
  return cleanDescription ? `${cleanDescription}\n\n${statusLine}` : statusLine;
}

function buildOptimusExtendedProperties(event, extra = {}) {
  return {
    private: {
      optimus_event_id: event.id,
      optimus_status: normalizeOptimusStatus(event.status),
      optimus_event_type: event.event_type || "event",
      ...extra,
    },
  };
}

/**
 * Import Google calendars into the app.
 * Upserts by google_calendar_id. Returns all imported IDs and the subset that
 * Google allows this account to write to.
 */
export async function importGoogleCalendars(userId, calendarClient = null) {
  const calendar = calendarClient || await getCalendarClient(userId);
  if (!calendar) throw new Error("Google not connected");

  const googleCalendars = [];
  let pageToken;
  do {
    const res = await calendar.calendarList.list({ pageToken }, GOOGLE_REQUEST_OPTIONS);
    googleCalendars.push(...(res.data.items || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  if (googleCalendars.length === 0) {
    return { calendarIds: [], writableCalendarIds: [] };
  }

  return transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`google-calendars:${userId}`]);
    const current = await client.query(
      "SELECT id, google_calendar_id FROM calendars WHERE user_id = $1 AND google_calendar_id IS NOT NULL",
      [userId]
    );
    const idByGoogleId = new Map(current.rows.map((row) => [row.google_calendar_id, row.id]));
    const imported = [];
    const writable = [];
    let primaryId = null;

    for (const gcal of googleCalendars) {
      let id = idByGoogleId.get(gcal.id);
      if (id) {
        await client.query(
          "UPDATE calendars SET name = $1, color = $2, timezone = $4, is_google = TRUE, updated_at = NOW() WHERE id = $3",
          [gcal.summary || gcal.id, gcal.backgroundColor || "#4285f4", id, gcal.timeZone || "UTC"]
        );
      } else {
        const inserted = await client.query(
          `INSERT INTO calendars (user_id, name, color, google_calendar_id, is_google, is_default, timezone)
           VALUES ($1, $2, $3, $4, TRUE, FALSE, $5) RETURNING id`,
          [userId, gcal.summary || gcal.id, gcal.backgroundColor || "#4285f4", gcal.id, gcal.timeZone || "UTC"]
        );
        id = inserted.rows[0].id;
        idByGoogleId.set(gcal.id, id);
      }
      imported.push(id);
      if (WRITABLE_GOOGLE_ACCESS_ROLES.has(gcal.accessRole)) writable.push(id);
      if (gcal.primary === true) primaryId = id;
    }

    if (primaryId) {
      await client.query("UPDATE calendars SET is_default = FALSE WHERE user_id = $1", [userId]);
      await client.query("UPDATE calendars SET is_default = TRUE WHERE id = $1 AND user_id = $2", [primaryId, userId]);
    }
    return { calendarIds: imported, writableCalendarIds: writable };
  });
}

function waitBeforeSyncRetry(attempt) {
  // Jitter keeps transactions that collided once from colliding again in step.
  const delay = 50 * 2 ** attempt + Math.random() * 50;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Sync events for a Google-linked calendar.
 * Uses syncToken for incremental sync when available.
 *
 * The import is SERIALIZABLE, so a concurrent write to the user's events (a
 * local edit, or another sync) can abort it with a serialization failure.
 * Each attempt reruns from BEGIN: the aborted attempt committed nothing,
 * including the new sync token, so Google is simply read again.
 */
export async function syncGoogleEvents(userId, calendarDbId, calendarClient = null) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await transaction(async client => {
        await client.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`google-sync:${userId}:${calendarDbId}`]);
        return syncGoogleEventsLocked(userId, calendarDbId, calendarClient, client);
      });
    } catch (error) {
      if (attempt >= SYNC_TRANSACTION_ATTEMPTS || !isSerializationFailure(error)) throw error;
      await waitBeforeSyncRetry(attempt);
    }
  }
}

async function syncGoogleEventsLocked(userId, calendarDbId, calendarClient, client) {
  const calendar = calendarClient || await getCalendarClient(userId);
  if (!calendar) throw new Error("Google not connected");

  const calRow = await client.query(
    "SELECT * FROM calendars WHERE id = $1 AND user_id = $2",
    [calendarDbId, userId]
  );
  if (calRow.rows.length === 0) throw new Error("Calendar not found");
  const cal = calRow.rows[0];
  if (!cal.google_calendar_id) throw new Error("Not a Google calendar");

  const importStartedAt = new Date().toISOString();
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setUTCMonth(sixMonthsAgo.getUTCMonth() - 6, 1);
  let pageToken = undefined;
  let syncToken = cal.sync_token;
  let allEvents = [];

  try {
    do {
      const params = {
        calendarId: cal.google_calendar_id,
        maxResults: 250,
        singleEvents: false,
      };

      if (syncToken) {
        params.syncToken = syncToken;
      } else {
        params.timeMin = sixMonthsAgo.toISOString();
      }
      if (pageToken) params.pageToken = pageToken;

      const res = await calendar.events.list(params, GOOGLE_REQUEST_OPTIONS);
      allEvents = allEvents.concat(res.data.items || []);
      pageToken = res.data.nextPageToken;

      if (!pageToken) {
        syncToken = res.data.nextSyncToken;
      }
    } while (pageToken);
  } catch (err) {
    if (Number(err.code) === 410 && cal.sync_token) {
      // syncToken expired — do full re-sync
      await client.query("UPDATE calendars SET sync_token = NULL WHERE id = $1", [calendarDbId]);
      return syncGoogleEventsLocked(userId, calendarDbId, calendar, client);
    }
    throw err;
  }

  const cancelledIds = allEvents.filter((event) => event.status === "cancelled").map((event) => event.id);
  const activeGoogleEvents = allEvents.filter((event) => event.status !== "cancelled" && event.id);
  const existingStatuses = activeGoogleEvents.length > 0
    ? await client.query(
        "SELECT google_event_id, status FROM events WHERE user_id = $1 AND calendar_id = $3 AND google_event_id = ANY($2::text[])",
        [userId, activeGoogleEvents.map((event) => event.id), calendarDbId]
      )
    : { rows: [] };
  const statusByGoogleId = new Map(existingStatuses.rows.map((row) => [row.google_event_id, row.status]));
  const normalizedEvents = [];

  for (const gEvent of activeGoogleEvents) {

    const isAllDay = !gEvent.start?.dateTime;
    const startTime = gEvent.start?.dateTime || gEvent.start?.date;
    const endTime = gEvent.end?.dateTime || gEvent.end?.date;

    if (!startTime || !endTime) continue;

    const appRecurrence = rruleToAppFormat(gEvent.recurrence);
    const googleRrule = gEvent.recurrence ? JSON.stringify(gEvent.recurrence) : null;
    const googleOptimusStatus = getOptimusStatusFromGoogleEvent(gEvent);
    const cleanDescription = stripOptimusStatusLine(gEvent.description);

    normalizedEvents.push({
      google_event_id: gEvent.id,
      title: gEvent.summary || "(No title)",
      description: cleanDescription,
      location: gEvent.location || null,
      start_time: isAllDay ? `${startTime}T00:00:00Z` : startTime,
      start_date: isAllDay ? startTime : null,
      end_date: isAllDay ? endTime : null,
      event_timezone: gEvent.start?.timeZone || cal.timezone || 'UTC',
      end_time: isAllDay ? `${endTime}T00:00:00Z` : endTime,
      all_day: isAllDay,
      recurrence_rule: appRecurrence,
      google_rrule: googleRrule,
      status: googleOptimusStatus || statusByGoogleId.get(gEvent.id) || "scheduled",
    });
  }

  {
    await client.query("SELECT set_config('optimus.google_import', 'on', true)");
    if (cancelledIds.length > 0) {
      await client.query(
        "DELETE FROM events WHERE user_id = $1 AND calendar_id = $3 AND google_event_id = ANY($2::text[]) AND google_dirty_fields = '{}'::jsonb AND synced_at IS NOT NULL AND synced_at <= $4",
        [userId, cancelledIds, calendarDbId, importStartedAt]
      );
    }
    if (normalizedEvents.length > 0) {
      await client.query(
        `WITH input AS (
          SELECT * FROM jsonb_to_recordset($3::jsonb) AS x(
            google_event_id TEXT, title TEXT, description TEXT, location TEXT,
            start_time TIMESTAMPTZ, end_time TIMESTAMPTZ, all_day BOOLEAN,
            start_date DATE, end_date DATE, event_timezone TEXT,
            recurrence_rule TEXT, google_rrule TEXT, status TEXT)
        )
        INSERT INTO events AS e (user_id, calendar_id, title, description, location,
          start_time, end_time, all_day, start_date, end_date, event_timezone,
          recurrence_rule, google_event_id, google_origin_calendar_id, google_rrule, status, synced_at)
        SELECT $1, $2, i.title, i.description, i.location, i.start_time, i.end_time,
          i.all_day, i.start_date, i.end_date, i.event_timezone, i.recurrence_rule,
          i.google_event_id, $4, i.google_rrule, i.status, NOW()
        FROM input i
        WHERE NOT EXISTS (SELECT 1 FROM google_event_deletions d WHERE d.user_id = $1
          AND d.google_calendar_id = $4 AND d.google_event_id = i.google_event_id)
        AND NOT EXISTS (SELECT 1 FROM events moving WHERE moving.user_id = $1
          AND moving.google_origin_calendar_id = $4 AND moving.google_event_id = i.google_event_id
          AND moving.calendar_id <> $2)
        AND NOT EXISTS (SELECT 1 FROM events creating WHERE creating.user_id = $1
          AND creating.calendar_id = $2 AND creating.google_event_id IS NULL
          AND replace(creating.google_creation_key::text, '-', '') = i.google_event_id)
        ON CONFLICT (user_id, calendar_id, google_event_id) WHERE google_event_id IS NOT NULL
        DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description,
          location = EXCLUDED.location, start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time,
          all_day = EXCLUDED.all_day, start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date,
          event_timezone = EXCLUDED.event_timezone, recurrence_rule = EXCLUDED.recurrence_rule,
          google_rrule = EXCLUDED.google_rrule, status = EXCLUDED.status,
          google_origin_calendar_id = EXCLUDED.google_origin_calendar_id, synced_at = NOW(), updated_at = NOW()
        WHERE e.google_dirty_fields = '{}'::jsonb AND e.synced_at IS NOT NULL AND e.synced_at <= $5`,
        [userId, calendarDbId, JSON.stringify(normalizedEvents), cal.google_calendar_id, importStartedAt]
      );
    }
    await client.query(
      "UPDATE calendars SET sync_token = $1, last_synced_at = NOW() WHERE id = $2 AND user_id = $3",
      [syncToken, calendarDbId, userId]
    );
  }

  return { synced: allEvents.length };
}

/**
 * Sync a user's calendars one at a time. Each import reads the user's events
 * in their other calendars (to recognise moved events), so concurrent
 * SERIALIZABLE imports for one user abort each other: with four in parallel,
 * three of every four failed and the losing calendars never imported.
 */
export async function syncGoogleCalendarSet(userId, calendarIds, calendarClient) {
  const results = [];
  for (const calendarId of calendarIds) {
    try {
      results.push(await syncGoogleEvents(userId, calendarId, calendarClient));
    } catch (error) {
      logError("google_sync.calendar_failed", error, { calendarId });
      results.push({ failed: 1 });
    }
  }
  return results;
}

/**
 * Push a local event to Google Calendar.
 * Only acts if the event belongs to a Google-linked calendar.
 */
export async function pushEventToGoogle(userId, eventId, calendarClient = null) {
  const calendar = calendarClient || await getCalendarClient(userId);
  if (!calendar) throw new Error("Google Calendar is not connected.");
  return transaction(async (client) => {
    // This row lock also serializes local edits and deletes against an in-flight push.
    const result = await client.query(
      `SELECT e.*, c.google_calendar_id FROM events e JOIN calendars c ON c.id = e.calendar_id
       WHERE e.id = $1 AND e.user_id = $2 FOR UPDATE OF e`, [eventId, userId]);
    const event = result.rows[0];
    if (!event?.google_calendar_id) return;
    if (event.google_dirty_fields?.legacy_review_required) {
      const original = await calendar.events.get({
        calendarId: event.google_origin_calendar_id || event.google_calendar_id,
        eventId: event.google_event_id,
      }, GOOGLE_REQUEST_OPTIONS);
      if (!legacyEventMatches(event, original.data, {
        stripStatus: stripOptimusStatusLine, getStatus: getOptimusStatusFromGoogleEvent, recurrence: rruleToAppFormat,
      })) {
        // Rotate review items to the end of the next bounded batch.
        await client.query('UPDATE events SET updated_at = clock_timestamp() WHERE id = $1', [eventId]);
        return { skipped: 'review_required' };
      }
      delete event.google_dirty_fields.legacy_review_required;
    }
    let remoteId = event.google_event_id;
    if (remoteId && event.google_origin_calendar_id !== event.google_calendar_id) {
      const source = event.google_origin_calendar_id;
      try {
        const original = await calendar.events.get({calendarId: source, eventId: remoteId}, GOOGLE_REQUEST_OPTIONS);
        if (original.data.status === 'cancelled') throw Object.assign(new Error('Source event moved'), {code: 410});
        await calendar.events.patch({calendarId: source, eventId: remoteId, requestBody: {
          extendedProperties: {...original.data.extendedProperties, private: {
            ...original.data.extendedProperties?.private, optimus_event_id: event.id,
          }},
        }}, {...GOOGLE_REQUEST_OPTIONS, headers: {'If-Match': original.data.etag}});
        const moved = await calendar.events.move({ calendarId: source, eventId: remoteId,
          destination: event.google_calendar_id }, GOOGLE_REQUEST_OPTIONS);
        remoteId = moved.data.id;
      } catch (error) {
        // A prior move may have succeeded before its database commit/response failed.
        if (![404, 410].includes(Number(error.code))) throw error;
        const recovered = await calendar.events.get({calendarId: event.google_calendar_id, eventId: remoteId}, GOOGLE_REQUEST_OPTIONS);
        if (recovered.data.status === 'cancelled' || recovered.data.extendedProperties?.private?.optimus_event_id !== event.id) throw error;
      }
    }
    if (!remoteId) {
      remoteId = event.google_creation_key.replaceAll('-', '');
      const requestBody = {
        id: remoteId, summary: event.title,
        description: withOptimusStatusLine(event.description, event.status), location: event.location || '',
        start: event.all_day ? {date: event.start_date} : {dateTime: new Date(event.start_time).toISOString(), timeZone: event.event_timezone || 'UTC'},
        end: event.all_day ? {date: event.end_date} : {dateTime: new Date(event.end_time).toISOString(), timeZone: event.event_timezone || 'UTC'},
        recurrence: event.google_rrule ? JSON.parse(event.google_rrule) : appFormatToRrule(event.recurrence_rule),
        extendedProperties: buildOptimusExtendedProperties(event),
      };
      try {
        await calendar.events.insert({calendarId: event.google_calendar_id, requestBody}, GOOGLE_REQUEST_OPTIONS);
      } catch (error) {
        if (Number(error.code) !== 409) throw error;
        const existing = await calendar.events.get({calendarId: event.google_calendar_id, eventId: remoteId}, GOOGLE_REQUEST_OPTIONS);
        if (existing.data.status === 'cancelled' || existing.data.extendedProperties?.private?.optimus_event_id !== event.id) throw error;
        // The insert response may have been lost; apply any newer local changes below.
      }
    }
    const remote = await calendar.events.get({calendarId: event.google_calendar_id, eventId: remoteId}, GOOGLE_REQUEST_OPTIONS);
    const patch = buildGooglePatch(event, remote.data, {withStatus: withOptimusStatusLine, recurrence: appFormatToRrule, getStatus: getOptimusStatusFromGoogleEvent});
    if (Object.keys(patch).length) {
      if (!remote.data.etag) throw new Error('Google event did not provide a concurrency token');
      await calendar.events.patch({calendarId: event.google_calendar_id, eventId: remoteId, requestBody: patch},
        {...GOOGLE_REQUEST_OPTIONS, headers: {'If-Match': remote.data.etag}});
    }
    if (event.google_event_id && event.google_origin_calendar_id !== event.google_calendar_id) {
      await client.query(`INSERT INTO google_event_deletions(user_id, google_calendar_id, google_event_id, completed_at)
        VALUES($1, $2, $3, NOW()) ON CONFLICT DO NOTHING`, [userId, event.google_origin_calendar_id, event.google_event_id]);
      await client.query(`DELETE FROM google_event_deletions WHERE user_id = $1 AND google_calendar_id = $2
        AND google_event_id = $3`, [userId, event.google_calendar_id, remoteId]);
    }
    await client.query(`UPDATE events SET google_event_id = $1, google_origin_calendar_id = $2,
      google_dirty_fields = '{}'::jsonb, synced_at = clock_timestamp() WHERE id = $3`,
      [remoteId, event.google_calendar_id, eventId]);
    return {pushed: true};
  });
}

export async function drainGoogleEventDeletions(userId, calendarClient = null) {
  const pending = await query(`SELECT * FROM google_event_deletions WHERE user_id = $1
    AND completed_at IS NULL ORDER BY created_at LIMIT 100`, [userId]);
  if (!pending.rows.length) return;
  let failed = 0;
  const calendar = calendarClient || await getCalendarClient(userId);
  if (!calendar) throw new Error('Google Calendar is not connected. Deletions remain pending.');
  for (const item of pending.rows) {
    try {
      let matches = true;
      if (item.expected_event_id) {
        const current = await calendar.events.get({calendarId: item.google_calendar_id, eventId: item.google_event_id}, GOOGLE_REQUEST_OPTIONS);
        matches = current.data.extendedProperties?.private?.optimus_event_id === item.expected_event_id;
        if (!matches) {
          await query(`DELETE FROM google_event_deletions WHERE user_id = $1 AND google_calendar_id = $2
            AND google_event_id = $3 AND expected_event_id = $4`,
          [userId, item.google_calendar_id, item.google_event_id, item.expected_event_id]);
          continue;
        }
      }
      if (matches) await calendar.events.delete({calendarId: item.google_calendar_id, eventId: item.google_event_id}, GOOGLE_REQUEST_OPTIONS);
    } catch (error) {
      if (![404, 410].includes(Number(error.code))) { failed++; continue; }
    }
    await query(`UPDATE google_event_deletions SET completed_at = NOW() WHERE user_id = $1
      AND google_calendar_id = $2 AND google_event_id = $3`, [userId, item.google_calendar_id, item.google_event_id]);
  }
  return { failed, pending: pending.rows.length === 100 };
}

export async function pushPendingEventsToGoogle(
  userId,
  calendarClient,
  limit = 100,
  writableCalendarIds = null
) {
  const pending = await query(
    `SELECT e.id
     FROM events e
     JOIN calendars c ON c.id = e.calendar_id
     WHERE e.user_id = $1
       AND c.google_calendar_id IS NOT NULL
       AND ($3::uuid[] IS NULL OR c.id = ANY($3::uuid[]))
       AND (
         e.google_event_id IS NULL
         OR e.synced_at IS NULL
         OR e.updated_at > e.synced_at
         OR e.google_dirty_fields <> '{}'::jsonb
       )
     ORDER BY e.updated_at ASC, e.id ASC
     LIMIT $2`,
    [
      userId,
      Math.min(Math.max(Number(limit) || 100, 1), 500),
      Array.isArray(writableCalendarIds) ? writableCalendarIds : null,
    ]
  );

  const eventIds = pending.rows.map((row) => row.id);
  const summary = { pushed: 0, failed: 0, reviewRequired: 0 };
  for (let index = 0; index < eventIds.length; index += 4) {
    const batch = eventIds.slice(index, index + 4);
    const results = await Promise.allSettled(
      batch.map((eventId) => pushEventToGoogle(userId, eventId, calendarClient))
    );
    for (const result of results) {
      if (result.status === 'rejected') summary.failed++;
      else if (result.value?.skipped) summary.reviewRequired++;
      else if (result.value?.pushed) summary.pushed++;
    }
  }

  return { ...summary, pending: eventIds.length === limit };
}

export async function pushEventOccurrenceStatusToGoogle(userId, eventId, occurrenceDate, status) {
  if (!eventId || !occurrenceDate || !status) return;

  const calendar = await getCalendarClient(userId);
  if (!calendar) throw new Error("Google Calendar is not connected.");

  const eventRow = await query(
    `SELECT e.*, c.google_calendar_id FROM events e
     JOIN calendars c ON c.id = e.calendar_id
     WHERE e.id = $1 AND e.user_id = $2`,
    [eventId, userId]
  );
  if (eventRow.rows.length === 0) return;
  const event = eventRow.rows[0];
  if (!event.google_calendar_id || !event.google_event_id || !event.recurrence_rule) return;

  const timeZone = event.event_timezone || 'UTC';
  const dayStart = zonedInputToDate(occurrenceDate, timeZone);
  const dayEnd = zonedInputToDate(addDateDays(occurrenceDate, 1), timeZone);

  const instances = await calendar.events.instances({
    calendarId: event.google_calendar_id,
    eventId: event.google_event_id,
    timeMin: dayStart.toISOString(),
    timeMax: dayEnd.toISOString(),
    showDeleted: false,
    maxResults: 10,
  }, GOOGLE_REQUEST_OPTIONS);

  const instance = (instances.data.items || []).find((item) => {
    const instanceStart = item.start?.dateTime || item.start?.date || item.originalStartTime?.dateTime || item.originalStartTime?.date;
    return dateKey(instanceStart, timeZone) === occurrenceDate;
  });
  if (!instance?.id) return;

  const nextStatus = normalizeOptimusStatus(status);
  try {
    await calendar.events.patch({
      calendarId: event.google_calendar_id,
      eventId: instance.id,
      requestBody: {
        description: withOptimusStatusLine(instance.description, nextStatus),
        extendedProperties: {
          ...instance.extendedProperties,
          private: {
            ...(instance.extendedProperties?.private || {}),
            optimus_event_id: event.id,
            optimus_status: nextStatus,
            optimus_occurrence_date: occurrenceDate,
          },
        },
      },
    }, {...GOOGLE_REQUEST_OPTIONS, headers: {'If-Match': instance.etag}});
  } catch (error) {
    if (isReadOnlyCalendarError(error)) return { skipped: "read_only" };
    throw error;
  }

  return { pushed: true };
}

/**
 * Delete an event from Google Calendar.
 * Silently ignores 404/410 (already deleted).
 */
export async function deleteEventFromGoogle(userId, googleEventId, googleCalendarId) {
  if (!googleEventId || !googleCalendarId) return;

  const calendar = await getCalendarClient(userId);
  if (!calendar) throw new Error("Google Calendar is not connected.");

  try {
    await calendar.events.delete({
      calendarId: googleCalendarId,
      eventId: googleEventId,
    }, GOOGLE_REQUEST_OPTIONS);
  } catch (err) {
    if (Number(err.code) !== 404 && Number(err.code) !== 410) throw err;
  }
}

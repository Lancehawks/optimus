import { query } from "@/lib/db";
import { getCalendarClient } from "@/lib/google";
import { rruleToAppFormat, appFormatToRrule } from "@/lib/rruleConverter";
import { getOccurrenceDateKeyFromDate } from "@/lib/recurrence";

const OPTIMUS_STATUS_LABELS = {
  scheduled: "Scheduled",
  in_progress: "In progress",
  done: "Done",
  missed: "Missed",
  cancelled: "Cancelled",
};
const OPTIMUS_STATUS_VALUES = new Set(Object.keys(OPTIMUS_STATUS_LABELS));
const OPTIMUS_STATUS_LINE_RE = /(?:\r?\n){0,2}\[Optimus status: ([^\]]+)\]\s*$/i;

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
 * Upserts by google_calendar_id. Returns array of DB calendar IDs.
 */
export async function importGoogleCalendars(userId) {
  const calendar = await getCalendarClient(userId);
  if (!calendar) throw new Error("Google not connected");

  const res = await calendar.calendarList.list();
  const googleCalendars = res.data.items || [];
  const imported = [];

  for (const gcal of googleCalendars) {
    const existing = await query(
      "SELECT id FROM calendars WHERE user_id = $1 AND google_calendar_id = $2",
      [userId, gcal.id]
    );

    const isPrimary = gcal.primary === true;

    if (existing.rows.length > 0) {
      await query(
        "UPDATE calendars SET name = $1, color = $2, updated_at = NOW() WHERE id = $3",
        [gcal.summary || gcal.id, gcal.backgroundColor || "#4285f4", existing.rows[0].id]
      );
      imported.push(existing.rows[0].id);
    } else {
      const result = await query(
        `INSERT INTO calendars (user_id, name, color, google_calendar_id, is_google, is_default)
         VALUES ($1, $2, $3, $4, true, false) RETURNING id`,
        [userId, gcal.summary || gcal.id, gcal.backgroundColor || "#4285f4", gcal.id]
      );
      imported.push(result.rows[0].id);
    }

    // Make the primary Google calendar the default
    if (isPrimary) {
      await query("UPDATE calendars SET is_default = false WHERE user_id = $1", [userId]);
      const primaryId = existing.rows[0]?.id || imported[imported.length - 1];
      await query("UPDATE calendars SET is_default = true WHERE id = $1", [primaryId]);
    }
  }

  return imported;
}

/**
 * Sync events for a Google-linked calendar.
 * Uses syncToken for incremental sync when available.
 */
export async function syncGoogleEvents(userId, calendarDbId) {
  const calendar = await getCalendarClient(userId);
  if (!calendar) throw new Error("Google not connected");

  const calRow = await query(
    "SELECT * FROM calendars WHERE id = $1 AND user_id = $2",
    [calendarDbId, userId]
  );
  if (calRow.rows.length === 0) throw new Error("Calendar not found");
  const cal = calRow.rows[0];
  if (!cal.google_calendar_id) throw new Error("Not a Google calendar");

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

      if (syncToken && !pageToken) {
        params.syncToken = syncToken;
      } else {
        if (!pageToken) {
          const sixMonthsAgo = new Date();
          sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
          params.timeMin = sixMonthsAgo.toISOString();
        }
        if (pageToken) params.pageToken = pageToken;
      }

      const res = await calendar.events.list(params);
      allEvents = allEvents.concat(res.data.items || []);
      pageToken = res.data.nextPageToken;

      if (!pageToken) {
        syncToken = res.data.nextSyncToken;
      }
    } while (pageToken);
  } catch (err) {
    if (err.code === 410) {
      // syncToken expired — do full re-sync
      await query("UPDATE calendars SET sync_token = NULL WHERE id = $1", [calendarDbId]);
      return syncGoogleEvents(userId, calendarDbId);
    }
    throw err;
  }

  // Upsert events
  let synced = 0;
  for (const gEvent of allEvents) {
    if (gEvent.status === "cancelled") {
      await query(
        "DELETE FROM events WHERE google_event_id = $1 AND user_id = $2",
        [gEvent.id, userId]
      );
      synced++;
      continue;
    }

    const isAllDay = !gEvent.start?.dateTime;
    const startTime = gEvent.start?.dateTime || gEvent.start?.date;
    const endTime = gEvent.end?.dateTime || gEvent.end?.date;

    if (!startTime || !endTime) continue;

    const appRecurrence = rruleToAppFormat(gEvent.recurrence);
    const googleRrule = gEvent.recurrence ? JSON.stringify(gEvent.recurrence) : null;
    const googleOptimusStatus = getOptimusStatusFromGoogleEvent(gEvent);
    const cleanDescription = stripOptimusStatusLine(gEvent.description);

    const existing = await query(
      "SELECT id, status FROM events WHERE google_event_id = $1 AND user_id = $2",
      [gEvent.id, userId]
    );
    const resolvedStatus = googleOptimusStatus || existing.rows[0]?.status || "scheduled";

    if (existing.rows.length > 0) {
      await query(
        `UPDATE events SET title = $1, description = $2, location = $3,
         start_time = $4, end_time = $5, all_day = $6,
         recurrence_rule = $7, google_rrule = $8, status = $9, synced_at = NOW(), updated_at = NOW()
         WHERE id = $10`,
        [
          gEvent.summary || "(No title)",
          cleanDescription,
          gEvent.location || null,
          startTime,
          endTime,
          isAllDay,
          appRecurrence,
          googleRrule,
          resolvedStatus,
          existing.rows[0].id,
        ]
      );
    } else {
      await query(
        `INSERT INTO events (user_id, calendar_id, title, description, location,
         start_time, end_time, all_day, recurrence_rule, google_event_id, google_rrule, status, synced_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())`,
        [
          userId,
          calendarDbId,
          gEvent.summary || "(No title)",
          cleanDescription,
          gEvent.location || null,
          startTime,
          endTime,
          isAllDay,
          appRecurrence,
          gEvent.id,
          googleRrule,
          resolvedStatus,
        ]
      );
    }
    synced++;
  }

  // Save new syncToken
  await query(
    "UPDATE calendars SET sync_token = $1, last_synced_at = NOW() WHERE id = $2",
    [syncToken, calendarDbId]
  );

  return { synced };
}

/**
 * Push a local event to Google Calendar.
 * Only acts if the event belongs to a Google-linked calendar.
 */
export async function pushEventToGoogle(userId, eventId) {
  const calendar = await getCalendarClient(userId);
  if (!calendar) return;

  const eventRow = await query(
    `SELECT e.*, c.google_calendar_id FROM events e
     JOIN calendars c ON c.id = e.calendar_id
     WHERE e.id = $1 AND e.user_id = $2`,
    [eventId, userId]
  );
  if (eventRow.rows.length === 0) return;
  const event = eventRow.rows[0];
  if (!event.google_calendar_id) return;

  const startDate = new Date(event.start_time);
  const endDate = new Date(event.end_time);

  const toDateStr = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const googleEvent = {
    summary: event.title,
    description: withOptimusStatusLine(event.description, event.status),
    location: event.location || undefined,
    start: event.all_day
      ? { date: toDateStr(startDate) }
      : { dateTime: startDate.toISOString() },
    end: event.all_day
      ? { date: toDateStr(endDate) }
      : { dateTime: endDate.toISOString() },
    recurrence: event.google_rrule
      ? JSON.parse(event.google_rrule)
      : appFormatToRrule(event.recurrence_rule),
    extendedProperties: buildOptimusExtendedProperties(event),
  };

  if (event.google_event_id) {
    await calendar.events.update({
      calendarId: event.google_calendar_id,
      eventId: event.google_event_id,
      requestBody: googleEvent,
    });
    await query("UPDATE events SET synced_at = NOW() WHERE id = $1", [eventId]);
  } else {
    const res = await calendar.events.insert({
      calendarId: event.google_calendar_id,
      requestBody: googleEvent,
    });
    await query(
      "UPDATE events SET google_event_id = $1, synced_at = NOW() WHERE id = $2",
      [res.data.id, eventId]
    );
  }
}

export async function pushEventOccurrenceStatusToGoogle(userId, eventId, occurrenceDate, status) {
  if (!eventId || !occurrenceDate || !status) return;

  const calendar = await getCalendarClient(userId);
  if (!calendar) return;

  const eventRow = await query(
    `SELECT e.*, c.google_calendar_id FROM events e
     JOIN calendars c ON c.id = e.calendar_id
     WHERE e.id = $1 AND e.user_id = $2`,
    [eventId, userId]
  );
  if (eventRow.rows.length === 0) return;
  const event = eventRow.rows[0];
  if (!event.google_calendar_id || !event.google_event_id || !event.recurrence_rule) return;

  const dayStart = new Date(`${occurrenceDate}T00:00:00`);
  const dayEnd = new Date(`${occurrenceDate}T23:59:59.999`);

  const instances = await calendar.events.instances({
    calendarId: event.google_calendar_id,
    eventId: event.google_event_id,
    timeMin: dayStart.toISOString(),
    timeMax: dayEnd.toISOString(),
    showDeleted: false,
    maxResults: 10,
  });

  const instance = (instances.data.items || []).find((item) => {
    const instanceStart = item.start?.dateTime || item.start?.date || item.originalStartTime?.dateTime || item.originalStartTime?.date;
    return getOccurrenceDateKeyFromDate(instanceStart) === occurrenceDate;
  });
  if (!instance?.id) return;

  const nextStatus = normalizeOptimusStatus(status);
  await calendar.events.patch({
    calendarId: event.google_calendar_id,
    eventId: instance.id,
    requestBody: {
      description: withOptimusStatusLine(instance.description || event.description, nextStatus),
      extendedProperties: {
        private: {
          ...(instance.extendedProperties?.private || {}),
          optimus_event_id: event.id,
          optimus_status: nextStatus,
          optimus_occurrence_date: occurrenceDate,
        },
      },
    },
  });
}

/**
 * Delete an event from Google Calendar.
 * Silently ignores 404/410 (already deleted).
 */
export async function deleteEventFromGoogle(userId, googleEventId, googleCalendarId) {
  if (!googleEventId || !googleCalendarId) return;

  const calendar = await getCalendarClient(userId);
  if (!calendar) return;

  try {
    await calendar.events.delete({
      calendarId: googleCalendarId,
      eventId: googleEventId,
    });
  } catch (err) {
    if (err.code !== 404 && err.code !== 410) throw err;
  }
}

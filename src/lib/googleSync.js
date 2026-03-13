import { query } from "@/lib/db";
import { getCalendarClient } from "@/lib/google";
import { rruleToAppFormat, appFormatToRrule } from "@/lib/rruleConverter";

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

    const existing = await query(
      "SELECT id FROM events WHERE google_event_id = $1 AND user_id = $2",
      [gEvent.id, userId]
    );

    if (existing.rows.length > 0) {
      await query(
        `UPDATE events SET title = $1, description = $2, location = $3,
         start_time = $4, end_time = $5, all_day = $6,
         recurrence_rule = $7, google_rrule = $8, synced_at = NOW(), updated_at = NOW()
         WHERE id = $9`,
        [
          gEvent.summary || "(No title)",
          gEvent.description || null,
          gEvent.location || null,
          startTime,
          endTime,
          isAllDay,
          appRecurrence,
          googleRrule,
          existing.rows[0].id,
        ]
      );
    } else {
      await query(
        `INSERT INTO events (user_id, calendar_id, title, description, location,
         start_time, end_time, all_day, recurrence_rule, google_event_id, google_rrule, synced_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
        [
          userId,
          calendarDbId,
          gEvent.summary || "(No title)",
          gEvent.description || null,
          gEvent.location || null,
          startTime,
          endTime,
          isAllDay,
          appRecurrence,
          gEvent.id,
          googleRrule,
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
    description: event.description || undefined,
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

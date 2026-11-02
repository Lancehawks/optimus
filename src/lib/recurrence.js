import { dateKey, zonedParts, zonedInputToDate, addDateDays } from './calendarTime.js';
/**
 * Expand recurring events into virtual instances within a date range.
 * Expansion-on-read strategy: master events store the recurrence rule,
 * and this utility generates virtual occurrences for display.
 */

const DAY_MAP = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function getOccurrenceDateKeyFromDate(value, timeZone = 'UTC') {
  if (Number.isNaN(new Date(value).getTime())) return null;
  return dateKey(value, timeZone);
}

/**
 * @param {Array} masterEvents - Recurring event rows from the database
 * @param {Date} rangeStart - Start of the visible range
 * @param {Date} rangeEnd - End of the visible range
 * @returns {Array} Virtual event instances with composite IDs
 */
export function expandRecurrences(masterEvents, rangeStart, rangeEnd) {
  const instances = [];
  for (const master of masterEvents) {
    if (!master.recurrence_rule) continue;
    const zone = master.all_day ? 'UTC' : master.event_timezone || 'UTC';
    const masterDate = master.all_day ? master.start_date || dateKey(master.start_time, 'UTC') : dateKey(master.start_time, zone);
    const anchor = new Date(masterDate + 'T00:00:00Z');
    const p = zonedParts(master.start_time, zone);
    const clock = master.all_day ? '00:00:00' : `${p.hour}:${p.minute}:${p.second}`;
    const duration = new Date(master.end_time) - new Date(master.start_time);
    const allDayLength = master.all_day ? Math.max(1, Math.round((new Date(master.end_date || dateKey(master.end_time,'UTC')) - new Date(masterDate)) / 86400000)) : 0;
    const rule = master.recurrence_rule.split(':')[0];
    const weekdays = new Set((master.recurrence_rule.split(':')[1] || '').split(',').map(d=>DAY_MAP[d]));
    // Start near the visible range, while preserving the original recurrence anchor.
    const first = new Date(dateKey(new Date(rangeStart.getTime() - Math.max(duration,86400000)),zone) + 'T00:00:00Z');
    const cursor = new Date(Math.max(anchor.getTime(), first.getTime()));
    const last = new Date(dateKey(rangeEnd,zone) + 'T00:00:00Z');
    for (let count=0; cursor <= last && count < 200; count++, cursor.setUTCDate(cursor.getUTCDate()+1)) {
      const days = Math.round((cursor-anchor)/86400000);
      const matches = rule === 'daily' || (rule === 'weekly' && days % 7 === 0)
        || (rule === 'custom' && weekdays.has(cursor.getUTCDay()))
        || (rule === 'monthly' && cursor.getUTCDate() === anchor.getUTCDate())
        || (rule === 'yearly' && cursor.getUTCMonth() === anchor.getUTCMonth() && cursor.getUTCDate() === anchor.getUTCDate());
      if (!matches) continue;
      const key = cursor.toISOString().slice(0,10);
      let instanceStart;
      try { instanceStart = zonedInputToDate(key + 'T' + clock, zone); }
      catch { continue; } // RFC recurrence semantics skip nonexistent local times.
      const instanceEnd = master.all_day ? new Date(addDateDays(key,allDayLength) + 'T00:00:00Z') : new Date(instanceStart.getTime()+duration);
      if (instanceStart >= rangeEnd || instanceEnd <= rangeStart) continue;
      instances.push({...master, id: `${master.id}___${key}`,
        start_time: instanceStart.toISOString(), end_time: instanceEnd.toISOString(),
        ...(master.all_day ? {start_date:key,end_date:addDateDays(key,allDayLength)} : {}),
        _isRecurrenceInstance:true, _masterEventId:master.id, _occurrenceDate:key});
    }
  }
  return instances;
}

/**
 * Extract the master event ID from a potentially composite instance ID.
 * @param {string} id - Event ID, possibly "masterId___2026-02-25"
 * @returns {string} The master event UUID
 */
export function getMasterEventId(id) {
  if (typeof id === "string" && id.includes("___")) {
    return id.split("___")[0];
  }
  return id;
}

export function isRecurrenceInstanceId(id) {
  return typeof id === "string" && id.includes("___");
}

export function getOccurrenceDateKey(id, fallbackDate) {
  if (isRecurrenceInstanceId(id)) {
    const [, dateKey] = id.split("___");
    return /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey : null;
  }
  return fallbackDate ? getOccurrenceDateKeyFromDate(fallbackDate) : null;
}

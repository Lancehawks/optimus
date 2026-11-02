export function validTimeZone(value) {
  try { new Intl.DateTimeFormat('en', {timeZone: value}).format(); return Boolean(value); }
  catch { return false; }
}

// The workspace runs on India time. Members can still pick another zone in Settings.
export const DEFAULT_TIME_ZONE = 'Asia/Kolkata';

export function resolveTimeZone(value, fallback = DEFAULT_TIME_ZONE) {
  return validTimeZone(value) ? value : fallback;
}

export function zonedParts(value, timeZone = 'UTC') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: resolveTimeZone(timeZone, 'UTC'), year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(value));
  return Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
}

export function dateKey(value, timeZone = 'UTC') {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const p = zonedParts(value, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

export function datetimeInput(value, timeZone = 'UTC') {
  const p = zonedParts(value, timeZone);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

// UI calendar dates are wall-clock containers, never serialized as instants.
export function wallDate(value, timeZone = 'UTC') {
  const p = zonedParts(value, timeZone);
  return new Date(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
}

export function wallDateKey(value) {
  return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;
}

export function addDateDays(value, amount) {
  const d = new Date(`${value}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0,10);
}

// Resolve offsets around the target date, including both sides of DST changes.
// Ambiguous times select the earlier occurrence; nonexistent times are rejected.
export function zonedInputToDate(value, timeZone = 'UTC') {
  const normalized = value.length === 10 ? `${value}T00:00:00` : value.length === 16 ? `${value}:00` : value;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(normalized)) throw new Error('Invalid local date/time');
  const target = Date.parse(normalized + 'Z');
  if (!Number.isFinite(target) || new Date(target).toISOString().slice(0,19) !== normalized) throw new Error('Invalid local date/time');
  const offsets = new Set();
  for (const delta of [-86400000, 0, 86400000]) {
    const instant = target + delta;
    const p = zonedParts(instant, timeZone);
    offsets.add(Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`) - instant);
  }
  const matches = [...offsets].map(offset => target - offset).filter(instant => {
    const p = zonedParts(instant, timeZone);
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}` === normalized;
  }).sort((a,b) => a-b);
  if (!matches.length) throw new Error('This local time does not exist in the selected timezone (daylight saving time).');
  return new Date(matches[0]);
}

export function wallDateToInstant(value, timeZone = 'UTC') {
  return zonedInputToDate(`${wallDateKey(value)}T${String(value.getHours()).padStart(2,'0')}:${String(value.getMinutes()).padStart(2,'0')}:${String(value.getSeconds()).padStart(2,'0')}`, timeZone);
}

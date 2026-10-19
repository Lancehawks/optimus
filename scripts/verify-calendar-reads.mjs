// Exercise the actual event repository and presentation code without modifying
// application data or requiring a user's session cookie.
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { normalizeDatabaseUrl } from '../src/lib/databaseUrl.js';

const root = process.cwd();
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required; use node --env-file=.env.local scripts/verify-calendar-reads.mjs');
const client = new pg.Client({ connectionString: normalizeDatabaseUrl(process.env.DATABASE_URL), connectionTimeoutMillis: 15000 });
pg.types.setTypeParser(1082, value => value);
globalThis.__calendarReadVerification = (...args) => client.query(...args);
const modules = new Map();
function moduleSource(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file);
  let source = file === path.join(root, 'src/lib/db.js')
    ? 'export const query = (...args) => globalThis.__calendarReadVerification(...args);'
    : fs.readFileSync(file, 'utf8');
  source = source.replace(/\bfrom\s+['"]([^'"]+)['"]/g, (match, specifier) => {
    if (!specifier.startsWith('@/') && !specifier.startsWith('.')) return match;
    let target = specifier.startsWith('@/') ? path.join(root, 'src', specifier.slice(2)) : path.resolve(path.dirname(file), specifier);
    if (!path.extname(target)) target += '.js';
    return 'from ' + JSON.stringify(moduleSource(target));
  });
  const url = 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
  modules.set(file, url);
  return url;
}

await client.connect();
try {
  await client.query('BEGIN READ ONLY');
  const repository = await import(moduleSource('src/lib/events/eventRepository.js'));
  const { expandRecurrences } = await import(moduleSource('src/lib/recurrence.js'));
  const { applyOccurrenceStatuses, applyMissedEventDisplayStatuses } = await import(moduleSource('src/lib/eventOccurrenceStatus.js'));
  const { presentEventsForViewer } = await import(moduleSource('src/lib/events/eventPresenter.js'));
  const users = (await client.query('SELECT id FROM users')).rows;
  const rangeStart = new Date(); rangeStart.setUTCDate(1); rangeStart.setUTCHours(0, 0, 0, 0);
  const rangeEnd = new Date(rangeStart); rangeEnd.setUTCMonth(rangeEnd.getUTCMonth() + 1);
  let presented = 0;
  for (const user of users) {
    const args = { userId: user.id, rangeStart, rangeEnd };
    const normal = await repository.listNonRecurringEventsForRange(args);
    const masters = await repository.listRecurringEventMastersForRange(args);
    const events = [...normal, ...expandRecurrences(masters, rangeStart, rangeEnd)];
    const ids = [...new Set(events.map(event => event._masterEventId || event.id))];
    const tasks = await repository.listLinkedTasksForEvents(user.id, ids);
    for (const event of events) event.linked_tasks = tasks[event._masterEventId || event.id] || [];
    await applyOccurrenceStatuses(events);
    applyMissedEventDisplayStatuses(events);
    presented += JSON.parse(JSON.stringify(presentEventsForViewer(events, user.id))).length;
  }
  console.log(JSON.stringify({ status: 'ok', usersChecked: users.length, presentedEvents: presented, readOnly: true }));
} finally {
  await client.query('ROLLBACK').catch(() => {});
  await client.end();
  delete globalThis.__calendarReadVerification;
}

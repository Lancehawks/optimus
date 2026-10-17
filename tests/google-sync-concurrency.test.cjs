const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const moduleURL = name => pathToFileURL(path.join(root, 'src/lib', name)).href;
const { setTimeout: sleep } = require('node:timers/promises');

// googleSync.js is loaded once per process, so its db and Google dependencies
// delegate to whichever implementation the running test installs here.
const harness = {query: null, transaction: null};
let syncModule;
async function loadSync() {
  if (syncModule) return syncModule;
  globalThis.__googleSyncConcurrency = {
    query: (...args) => harness.query(...args),
    transaction: fn => harness.transaction(fn),
    getCalendarClient: async () => { throw new Error('Tests pass a calendar client'); },
  };
  let source = fs.readFileSync(path.join(root, 'src/lib/googleSync.js'), 'utf8');
  source = source.replace('import { query, transaction } from "@/lib/db";', 'const {query, transaction} = globalThis.__googleSyncConcurrency;');
  source = source.replace('import { getCalendarClient } from "@/lib/google";', 'const {getCalendarClient} = globalThis.__googleSyncConcurrency;');
  source = source.replace(/from (["'])@\/lib\/([^"']+)\1/g, (_, q, name) => `from ${JSON.stringify(moduleURL(name + '.js'))}`);
  syncModule = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  return syncModule;
}

const serializationFailure = () => Object.assign(
  new Error('could not serialize access due to read/write dependencies among transactions'), {code: '40001'});

function fakeDatabase({failures = () => null} = {}) {
  const state = {attempts: 0, active: 0, maxActive: 0, committed: []};
  harness.query = async () => ({rows: []});
  harness.transaction = async fn => {
    state.attempts++;
    state.active++;
    state.maxActive = Math.max(state.maxActive, state.active);
    let calendarId;
    const client = {query: async (text, params) => {
      if (/^SELECT \* FROM calendars/.test(text)) {
        calendarId = params[0];
        return {rows: [{id: calendarId, google_calendar_id: 'google-' + calendarId, sync_token: null, timezone: 'UTC'}]};
      }
      return {rows: []};
    }};
    try {
      const result = await fn(client);
      const failure = failures(calendarId, state);
      if (failure) throw failure;
      state.committed.push(calendarId);
      return result;
    } finally {
      state.active--;
    }
  };
  return state;
}

const emptyGoogle = {events: {list: async () => { await sleep(10); return {data: {items: [], nextSyncToken: 'token'}}; }}};

test('a calendar import that hits a serialization failure is rerun from the start', async () => {
  const sync = await loadSync();
  let failuresLeft = 2;
  const db = fakeDatabase({failures: () => (failuresLeft-- > 0 ? serializationFailure() : null)});
  assert.deepEqual(await sync.syncGoogleEvents('user', 'cal', emptyGoogle), {synced: 0});
  assert.equal(db.attempts, 3);
  assert.deepEqual(db.committed, ['cal']);
});

test('calendar imports give up after bounded retries and never retry other errors', async () => {
  const sync = await loadSync();
  let db = fakeDatabase({failures: () => serializationFailure()});
  await assert.rejects(sync.syncGoogleEvents('user', 'cal', emptyGoogle), {code: '40001'});
  assert.equal(db.attempts, 4);

  db = fakeDatabase({failures: () => Object.assign(new Error('duplicate key'), {code: '23505'})});
  await assert.rejects(sync.syncGoogleEvents('user', 'cal', emptyGoogle), {code: '23505'});
  assert.equal(db.attempts, 1);
});

test("a user's calendars import one at a time and one failure does not stop the rest", async () => {
  const sync = await loadSync();
  const db = fakeDatabase({failures: calendarId => (calendarId === 'broken' ? Object.assign(new Error('boom'), {code: 'XX000'}) : null)});
  const logged = [];
  const originalError = globalThis.console.error;
  globalThis.console.error = line => logged.push(JSON.parse(line));
  let results;
  try {
    results = await sync.syncGoogleCalendarSet('user', ['a', 'b', 'broken', 'c', 'd', 'e'], emptyGoogle);
  } finally {
    globalThis.console.error = originalError;
  }
  assert.equal(db.maxActive, 1);
  assert.deepEqual(db.committed, ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(results.map(result => result.failed || 0), [0, 0, 1, 0, 0, 0]);
  // Failed calendars used to be swallowed silently; they must reach the logs.
  assert.deepEqual(logged.map(entry => [entry.event, entry.calendarId, entry.error.code]),
    [['google_sync.calendar_failed', 'broken', 'XX000']]);
});

// Serialization failures need independent connections, which PGlite cannot
// provide. Set CALENDAR_TEST_PG_PORT to an isolated local test server (see
// tests/helpers/calendar-postgres.cjs) to run this against real PostgreSQL.
test('real PostgreSQL: every calendar of a multi-calendar account imports', {
  skip: !process.env.CALENDAR_TEST_PG_PORT && 'set CALENDAR_TEST_PG_PORT to run against PostgreSQL',
}, async () => {
  const sync = await loadSync();
  const db = await require('./helpers/calendar-postgres.cjs').connect(Number(process.env.CALENDAR_TEST_PG_PORT));
  try {
    await db.exec(`
      CREATE TABLE users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), timezone text);
      CREATE TABLE calendars(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES users ON DELETE CASCADE,
        google_calendar_id text, sync_token text, last_synced_at timestamptz);
      CREATE TABLE events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES users ON DELETE CASCADE,
        calendar_id uuid REFERENCES calendars ON DELETE CASCADE, title text, description text, location text,
        start_time timestamptz, end_time timestamptz, all_day boolean DEFAULT false,
        recurrence_rule text, google_event_id text, google_rrule text, status text DEFAULT 'scheduled',
        event_type text DEFAULT 'event', synced_at timestamptz, updated_at timestamptz DEFAULT now());
      CREATE FUNCTION update_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;
      CREATE TRIGGER events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    `);
    await db.exec(fs.readFileSync(path.join(root, 'migrations/20261015_calendar_sync_safety.sql'), 'utf8'));
    harness.query = (...args) => db.query(...args);
    harness.transaction = fn => db.transaction(fn);

    const user = (await db.query("INSERT INTO users(timezone) VALUES('UTC') RETURNING id")).rows[0].id;
    const googleIds = ['primary', 'work', 'holidays', 'birthdays'];
    const calendarIds = [];
    for (const googleId of googleIds) {
      calendarIds.push((await db.query('INSERT INTO calendars(user_id,google_calendar_id) VALUES($1,$2) RETURNING id', [user, googleId])).rows[0].id);
    }
    let round = 0;
    const google = {events: {list: async ({calendarId}) => {
      await sleep(50);
      return {data: {nextSyncToken: 'token', items: Array.from({length: 10}, (_, index) => ({
        id: `${calendarId}${index}`, summary: `${calendarId} ${index} r${round}`,
        start: {dateTime: '2026-10-15T10:00:00Z'}, end: {dateTime: '2026-10-15T11:00:00Z'},
      }))}};
    }}};

    // The production path: this failed for three of every four calendars when
    // the calendars of one account were imported in parallel.
    for (round = 1; round <= 3; round++) {
      const results = await sync.syncGoogleCalendarSet(user, calendarIds, google);
      assert.deepEqual(results.map(result => result.failed || 0), [0, 0, 0, 0]);
    }
    const counts = (await db.query(`SELECT c.google_calendar_id, count(e.id)::int AS events, c.sync_token
      FROM calendars c LEFT JOIN events e ON e.calendar_id = c.id GROUP BY c.id ORDER BY 1`)).rows;
    assert.deepEqual(counts.map(row => [row.google_calendar_id, row.events, row.sync_token]),
      [...googleIds].sort().map(id => [id, 10, 'token']));

    // Two overlapping imports still conflict in PostgreSQL; the loser reruns.
    round = 4;
    await Promise.all([sync.syncGoogleEvents(user, calendarIds[0], google), sync.syncGoogleEvents(user, calendarIds[1], google)]);
    const titles = (await db.query('SELECT DISTINCT title FROM events WHERE calendar_id = ANY($1::uuid[])', [calendarIds.slice(0, 2)])).rows;
    assert.ok(titles.every(row => row.title.endsWith(' r4')));
  } finally {
    await db.close();
  }
});

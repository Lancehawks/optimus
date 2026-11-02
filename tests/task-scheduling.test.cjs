const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { createSchemaDatabase } = require("./helpers/schema-database.cjs");

const root = path.resolve(__dirname, "..");
const load = (relativePath) => import(path.join(root, relativePath));
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("a task is scheduled by an upcoming block the viewer can see", async () => {
  const { hasUpcomingBlockSql, upcomingBlocksSql } = await load("src/lib/taskBlocks.js");
  const db = await createSchemaDatabase();
  try {
    const user = async (email) => (await db.query(
      "INSERT INTO users (email, password_hash, full_name) VALUES ($1, 'x', $1) RETURNING id", [email]
    )).rows[0].id;
    const owner = await user("owner@example.test");
    const teammate = await user("teammate@example.test");
    const stranger = await user("stranger@example.test");
    const calendar = async (userId) => (await db.query(
      "INSERT INTO calendars (user_id, name) VALUES ($1, 'Mine') RETURNING id", [userId]
    )).rows[0].id;
    const calendars = { [owner]: await calendar(owner), [teammate]: await calendar(teammate), [stranger]: await calendar(stranger) };
    const project = (await db.query("INSERT INTO projects (user_id, name) VALUES ($1, 'Shared') RETURNING id", [owner])).rows[0].id;
    await db.query("INSERT INTO project_members (project_id, user_id) VALUES ($1, $2), ($1, $3) ON CONFLICT DO NOTHING", [project, owner, teammate]);

    const task = async (title, { projectId = null, userId = owner } = {}) => (await db.query(
      "INSERT INTO tasks (user_id, title, project_id) VALUES ($1, $2, $3) RETURNING id", [userId, title, projectId]
    )).rows[0].id;
    const block = async (taskId, startsInHours, { userId = owner, status = "scheduled", repeat = null, projectId = null, title = "Block" } = {}) => {
      const { rows: [event] } = await db.query(
        `INSERT INTO events (user_id, calendar_id, title, start_time, end_time, status, recurrence_rule, project_id)
         VALUES ($1, $2, $3, NOW() + $4::numeric * INTERVAL '1 hour', NOW() + ($4::numeric + 1) * INTERVAL '1 hour', $5, $6, $7)
         RETURNING id`,
        [userId, calendars[userId], title, startsInHours, status, repeat, projectId]
      );
      await db.query("INSERT INTO event_tasks (event_id, task_id) VALUES ($1, $2)", [event.id, taskId]);
      return event.id;
    };

    const later = await task("Later");
    await block(later, 5, { title: "Second" });
    const soonest = await block(later, 2, { title: "First" });
    const pastOnly = await task("Past only");
    await block(pastOnly, -3);
    const finished = await task("Finished early");
    await block(finished, 2, { status: "done" });
    await block(finished, 3, { status: "cancelled" });
    const underway = await task("Underway");
    await block(underway, -0.5, { status: "in_progress" });
    const repeating = await task("Repeating");
    await block(repeating, -48, { repeat: "daily" });
    const both = await task("Both");
    await block(both, -48, { repeat: "daily" });
    const oneOff = await block(both, 30);
    // A teammate's personal block on a shared task is theirs alone.
    const teammatePrivate = await task("Teammate's private block", { projectId: project });
    await block(teammatePrivate, 2, { userId: teammate });
    const shared = await task("Shared", { projectId: project });
    await block(shared, 4, { userId: teammate, projectId: project });
    const bare = await task("Never scheduled");

    const scheduled = async (viewer, taskId) => (await db.query(
      `SELECT ${hasUpcomingBlockSql("$2")} AS scheduled`, [viewer, taskId]
    )).rows[0].scheduled;
    const blocks = async (viewer, taskId) => (await db.query(upcomingBlocksSql("$2", { limit: 5 }), [viewer, taskId])).rows;

    for (const taskId of [later, underway, repeating, both, shared]) assert.equal(await scheduled(owner, taskId), true);
    for (const taskId of [pastOnly, finished, teammatePrivate, bare]) assert.equal(await scheduled(owner, taskId), false);
    assert.equal(await scheduled(teammate, teammatePrivate), true);

    const laterBlocks = await blocks(owner, later);
    assert.deepEqual(laterBlocks.map((row) => row.title), ["First", "Second"]);
    assert.equal(laterBlocks[0].id, soonest);
    assert.equal(laterBlocks[0].is_mine, true);
    assert.equal(laterBlocks[0].repeats, false);

    // A dated block comes before a repeating one.
    const bothBlocks = await blocks(owner, both);
    assert.equal(bothBlocks[0].id, oneOff);
    assert.equal(bothBlocks[1].repeats, true);

    // A teammate's block on a shared task counts, but isn't the viewer's to remove.
    const [sharedBlock] = await blocks(owner, shared);
    assert.equal(sharedBlock.is_mine, false);
    assert.equal(await scheduled(stranger, shared), false);

    // The list query reads one next block per task through a lateral join.
    const { rows: listed } = await db.query(
      `SELECT t.title, blocks.next_block
       FROM tasks t
       LEFT JOIN LATERAL (
         SELECT row_to_json(upcoming) AS next_block FROM (${upcomingBlocksSql("t.id", { limit: 1 })}) upcoming
       ) blocks ON TRUE
       WHERE t.user_id = $1 AND NOT ${hasUpcomingBlockSql("t.id")}
       ORDER BY t.title`,
      [owner]
    );
    assert.deepEqual(listed.map((row) => row.title), ["Finished early", "Never scheduled", "Past only", "Teammate's private block"]);
    assert.ok(listed.every((row) => row.next_block === null));
    const { rows: [next] } = await db.query(
      `SELECT row_to_json(upcoming) AS next_block FROM (${upcomingBlocksSql("$2", { limit: 1 })}) upcoming`, [owner, later]
    );
    assert.equal(next.next_block.title, "First");
    assert.ok(!Number.isNaN(new Date(next.next_block.start_time).getTime()));

    const lookups = await db.query("SELECT indexname FROM pg_indexes WHERE tablename = 'event_tasks'");
    assert.ok(lookups.rows.some((row) => row.indexname === "idx_event_tasks_task_id"));
  } finally {
    await db.close();
  }
});

test("task routes return the next block and filter on it", () => {
  const list = read("src/app/api/tasks/route.js");
  const detail = read("src/app/api/tasks/[id]/route.js");

  assert.match(list, /SCHEDULED_FILTERS = \["yes", "no"\]/);
  assert.match(list, /hasUpcomingBlockSql\("t\.id"\)/);
  assert.match(list, /blocks\.next_block/);
  assert.match(detail, /blocks: blocksResult\.rows/);
});

test("free time skips busy and cancelled events and fits the block", async () => {
  const { zonedInputToDate } = await load("src/lib/calendarTime.js");
  const { getFreeSlots } = await load("src/lib/timeBlocking.js");
  const zone = "Asia/Kolkata";
  const at = (clock) => zonedInputToDate(`2030-01-15T${clock}`, zone).toISOString();
  const events = [
    { start_time: at("09:00"), end_time: at("10:00") },
    { start_time: at("12:00"), end_time: at("13:30") },
    { start_time: at("15:00"), end_time: at("16:00"), status: "cancelled" },
    { start_time: at("00:00"), end_time: at("23:59"), all_day: true },
  ];
  const day = new Date(2030, 0, 15);
  const clocks = (slots) => slots.map((slot) => `${slot.start.getHours()}:${String(slot.start.getMinutes()).padStart(2, "0")}-${slot.end.getHours()}:${String(slot.end.getMinutes()).padStart(2, "0")}`);

  assert.deepEqual(clocks(getFreeSlots(day, events, zone, { minMinutes: 60 })), ["7:00-9:00", "10:00-12:00", "13:30-0:00"]);
  assert.deepEqual(clocks(getFreeSlots(day, events, zone, { minMinutes: 90 })), ["7:00-9:00", "10:00-12:00", "13:30-0:00"]);
  assert.deepEqual(clocks(getFreeSlots(day, events, zone, { minMinutes: 30, limit: 1 })), ["7:00-9:00"]);
});

test("blocks take the task's estimate and read as a short time", async () => {
  const { defaultBlockMinutes, formatBlockWhen, taskBlockEvent } = await load("src/lib/timeBlocking.js");

  assert.equal(defaultBlockMinutes({}), 60);
  assert.equal(defaultBlockMinutes({ estimated_minutes: 20 }), 30);
  assert.equal(defaultBlockMinutes({ estimated_minutes: 90 }), 90);
  assert.equal(defaultBlockMinutes({ estimated_minutes: 100 }), 120);
  assert.equal(defaultBlockMinutes({ estimated_minutes: 900 }), 240);

  const start = new Date("2030-01-15T03:30:00Z");
  const end = new Date("2030-01-15T05:00:00Z");
  assert.deepEqual(taskBlockEvent({ id: "t1", title: "Write spec", project_id: "p1" }, start, end), {
    title: "Focus: Write spec",
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    projectId: "p1",
    task_ids: ["t1"],
    event_color: "#27836c",
    status: "scheduled",
    event_type: "focus",
  });

  const zone = "Asia/Kolkata";
  const now = new Date("2030-01-15T02:00:00Z"); // 7:30 AM Tuesday in India
  const when = (startTime, extra = {}) => formatBlockWhen({ start_time: startTime, ...extra }, zone, now);
  assert.equal(when("2030-01-15T03:30:00Z"), "Today 9:00 AM");
  assert.equal(when("2030-01-16T08:30:00Z"), "Tomorrow 2:00 PM");
  assert.equal(when("2030-01-18T03:30:00Z"), "Fri 9:00 AM");
  assert.equal(when("2030-02-01T03:30:00Z"), "Feb 1 9:00 AM");
  assert.equal(when("2031-02-01T03:30:00Z"), "Feb 1, 2031 9:00 AM");
  assert.equal(when("2030-01-15T01:30:00Z"), "Now");
  assert.equal(when("2030-01-14T03:30:00Z", { repeats: true }), "Repeats");
  assert.equal(when("2030-01-17T00:00:00Z", { all_day: true }), "Thu");
});

test("a Google event is linked to the one open task its title names", async () => {
  const { hasUpcomingBlockSql, linkImportedEventsToTasks } = await load("src/lib/taskBlocks.js");
  const db = await createSchemaDatabase();
  try {
    const user = async (email) => (await db.query(
      "INSERT INTO users (email, password_hash, full_name) VALUES ($1, 'x', $1) RETURNING id", [email]
    )).rows[0].id;
    const me = await user("ceo@example.test");
    const other = await user("other@example.test");
    const calendar = async (userId) => (await db.query(
      "INSERT INTO calendars (user_id, name) VALUES ($1, 'Google') RETURNING id", [userId]
    )).rows[0].id;
    const mine = await calendar(me);
    const theirs = await calendar(other);
    const task = async (title, { userId = me, status = "todo", archived = false } = {}) => (await db.query(
      "INSERT INTO tasks (user_id, title, status, is_archived) VALUES ($1, $2, $3, $4) RETURNING id", [userId, title, status, archived]
    )).rows[0].id;
    let googleId = 0;
    const event = async (title, { startsInHours = 2, calendarId = mine, userId = me, google = true } = {}) => (await db.query(
      `INSERT INTO events (user_id, calendar_id, title, start_time, end_time, google_event_id)
       VALUES ($1, $2, $3, NOW() + $4::numeric * INTERVAL '1 hour', NOW() + ($4::numeric + 1) * INTERVAL '1 hour', $5)
       RETURNING id`,
      [userId, calendarId, title, startsInHours, google ? `g${++googleId}` : null]
    )).rows[0].id;
    const linked = async (eventId) => (await db.query(
      "SELECT task_id FROM event_tasks WHERE event_id = $1 ORDER BY task_id", [eventId]
    )).rows.map((row) => row.task_id);

    const deck = await task("Write investor deck");
    const hiring = await task("Hiring plan");
    await task("Duplicate");
    await task("Duplicate");
    await task("Shipped", { status: "done" });
    await task("Shelved", { archived: true });
    await task("Their task", { userId: other });
    const handPicked = await task("Hand picked");

    const exact = await event("Write investor deck");
    const focus = await event("  focus:   HIRING PLAN ");
    const twoMatches = await event("Duplicate");
    const done = await event("Shipped");
    const archived = await event("Shelved");
    const notMine = await event("Their task");
    const past = await event("Write investor deck", { startsInHours: -5 });
    const local = await event("Hiring plan", { google: false });
    const alreadyLinked = await event("Write investor deck");
    await db.query("INSERT INTO event_tasks (event_id, task_id) VALUES ($1, $2)", [alreadyLinked, handPicked]);
    const otherCalendar = await event("Their task", { userId: other, calendarId: theirs });

    await linkImportedEventsToTasks(db, { userId: me, calendarId: mine });
    await linkImportedEventsToTasks(db, { userId: me, calendarId: mine });

    assert.deepEqual(await linked(exact), [deck]);
    assert.deepEqual(await linked(focus), [hiring]);
    for (const eventId of [twoMatches, done, archived, notMine, past, local, otherCalendar]) {
      assert.deepEqual(await linked(eventId), []);
    }
    assert.deepEqual(await linked(alreadyLinked), [handPicked]);

    const scheduled = async (taskId) => (await db.query(
      `SELECT ${hasUpcomingBlockSql("$2")} AS scheduled`, [me, taskId]
    )).rows[0].scheduled;
    assert.equal(await scheduled(deck), true);
    assert.equal(await scheduled(hiring), true);
  } finally {
    await db.close();
  }
});

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { createSchemaDatabase } = require("./helpers/schema-database.cjs");

const root = path.resolve(__dirname, "..");
const load = (relativePath) => import(path.join(root, relativePath));

// 01:30 on the 23rd in Kolkata, while UTC still says the 22nd.
const LATE_UTC = new Date("2026-10-22T20:00:00Z");

async function setup(timezone) {
  const db = await createSchemaDatabase();
  const user = (await db.query(
    "INSERT INTO users (email, password_hash, full_name, timezone) VALUES ('a@example.com', 'x', 'A', $1) RETURNING id, timezone",
    [timezone]
  )).rows[0];
  const section = (await db.query("INSERT INTO checklist_sections (user_id, name) VALUES ($1, 'Morning') RETURNING id", [user.id])).rows[0].id;
  const item = (await db.query("INSERT INTO checklist_items (section_id, name) VALUES ($1, 'Stretch') RETURNING id", [section])).rows[0].id;
  return { db, user, item };
}

async function loggedDays(db, item) {
  const result = await db.query(
    "SELECT to_char(log_date, 'YYYY-MM-DD') AS day, completed FROM checklist_logs WHERE item_id = $1 ORDER BY log_date",
    [item]
  );
  return result.rows;
}

test("a routine's day follows the member's timezone, whichever side of UTC they're on", async () => {
  const { routineToday } = await load("src/lib/routineLogs.js");
  assert.equal(routineToday({ timezone: "Asia/Kolkata" }, LATE_UTC), "2026-10-23");
  assert.equal(routineToday({ timezone: "UTC" }, LATE_UTC), "2026-10-22");
  assert.equal(routineToday({ timezone: "Pacific/Pago_Pago" }, new Date("2026-10-23T05:00:00Z")), "2026-10-22");
});

test("after local midnight, a tick lands on the member's new day and reads back as today", async () => {
  const { db, user, item } = await setup("Asia/Kolkata");
  try {
    const { loadTodayRoutineLogs, logRoutineItem } = await load("src/lib/routineLogs.js");
    assert.deepEqual(await loadTodayRoutineLogs(db, user, LATE_UTC), {});

    const log = await logRoutineItem(db, user, { itemId: item }, LATE_UTC);
    assert.equal(log.completed, true);
    assert.deepEqual(await loggedDays(db, item), [{ day: "2026-10-23", completed: true }]);
    assert.deepEqual(await loadTodayRoutineLogs(db, user, LATE_UTC), { [item]: true });

    // Unticking updates that same day rather than adding another.
    await logRoutineItem(db, user, { itemId: item, completed: false }, LATE_UTC);
    assert.deepEqual(await loggedDays(db, item), [{ day: "2026-10-23", completed: false }]);
    assert.deepEqual(await loadTodayRoutineLogs(db, user, LATE_UTC), { [item]: false });

    // The next local day starts clear.
    assert.deepEqual(await loadTodayRoutineLogs(db, user, new Date("2026-10-23T20:00:00Z")), {});
  } finally {
    await db.close();
  }
});

test("a date from the history grid is used as given, and doesn't count as today", async () => {
  const { db, user, item } = await setup("Asia/Kolkata");
  try {
    const { loadTodayRoutineLogs, logRoutineItem } = await load("src/lib/routineLogs.js");
    await logRoutineItem(db, user, { itemId: item, date: "2026-10-20" }, LATE_UTC);
    assert.deepEqual(await loggedDays(db, item), [{ day: "2026-10-20", completed: true }]);
    assert.deepEqual(await loadTodayRoutineLogs(db, user, LATE_UTC), {});
  } finally {
    await db.close();
  }
});

test("the page and the assistant agree on which day a routine was done", async () => {
  const { db, user, item } = await setup("Asia/Kolkata");
  try {
    const { dateKey } = await load("src/lib/calendarTime.js");
    const { loadTodayRoutineLogs, routineToday } = await load("src/lib/routineLogs.js");
    const { runTool } = await load("src/lib/assistant/tools.js");
    const { decideAction } = await load("src/lib/assistant/actions.js");
    const { getModel } = await load("src/lib/ai/models.js");
    const store = await load("src/lib/assistant/store.js");
    const model = getModel("anthropic:claude-haiku-5-5");
    const conversationId = (await store.createConversation(db, { userId: user.id, title: "t", model })).id;

    const today = dateKey(LATE_UTC, user.timezone);
    assert.equal(today, routineToday(user, LATE_UTC));
    const ctx = { db, userId: user.id, timeZone: user.timezone, now: LATE_UTC, today, conversationId };
    const proposal = await runTool(ctx, "complete_routine", { item_ids: [item], date: today });
    await decideAction(ctx, proposal.action.id, "confirm");

    assert.deepEqual(await loadTodayRoutineLogs(db, user, LATE_UTC), { [item]: true });
  } finally {
    await db.close();
  }
});

test("routine routes and the history view don't fall back to the server's or browser's date", () => {
  const fs = require("node:fs");
  const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
  for (const file of ["src/app/api/checklist/sections/route.js", "src/app/api/checklist/log/route.js"]) {
    assert.doesNotMatch(read(file), /CURRENT_DATE/, file);
  }
  const history = read("src/components/checklist/ChecklistHistory.js");
  assert.match(history, /dateKey\(new Date\(\), resolveTimeZone\(user\?\.timezone\)\)/);
});

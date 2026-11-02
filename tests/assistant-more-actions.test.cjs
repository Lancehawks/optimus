const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { createSchemaDatabase } = require("./helpers/schema-database.cjs");

const root = path.resolve(__dirname, "..");
const load = (relativePath) => import(path.join(root, relativePath));

const NOW = new Date("2026-10-22T09:30:00Z"); // 15:00 on Thu 22 Oct in Asia/Kolkata
const TIME_ZONE = "Asia/Kolkata";

async function insertUser(db, email, name) {
  const result = await db.query(
    "INSERT INTO users (email, password_hash, full_name, timezone) VALUES ($1, 'x', $2, $3) RETURNING id",
    [email, name, TIME_ZONE]
  );
  return result.rows[0].id;
}

const recordActivity = ({ projectId, actorUserId, action, entityType, entityId, entityTitle, db }) => db.query(
  `INSERT INTO project_activity (project_id, actor_user_id, action, entity_type, entity_id, entity_title, metadata)
   VALUES ($1, $2, $3, $4, $5, $6, '{}'::jsonb)`,
  [projectId, actorUserId, action, entityType, entityId, entityTitle]
);

// owner and member share a project; outsider shares nothing.
async function setup() {
  const db = await createSchemaDatabase();
  const owner = await insertUser(db, "owner@example.com", "Asha Owner");
  const member = await insertUser(db, "member@example.com", "Mo Member");
  const outsider = await insertUser(db, "outsider@example.com", "Oz Outsider");
  const project = (await db.query("INSERT INTO projects (user_id, name, status) VALUES ($1, 'Launch', 'active') RETURNING id", [owner])).rows[0].id;
  await db.query("INSERT INTO project_members (project_id, user_id) VALUES ($1, $2)", [project, member]);

  const { getModel } = await load("src/lib/ai/models.js");
  const store = await load("src/lib/assistant/store.js");
  const model = getModel("anthropic:claude-haiku-5-5");
  const conversations = {};
  for (const [name, userId] of Object.entries({ owner, member, outsider })) {
    conversations[name] = (await store.createConversation(db, { userId, title: "t", model })).id;
  }
  return { db, owner, member, outsider, project, conversations };
}

function context(seed, who, extra = {}) {
  return {
    db: seed.db,
    userId: seed[who],
    timeZone: TIME_ZONE,
    now: NOW,
    today: "2026-10-22",
    conversationId: seed.conversations[who],
    listEvents: async () => [],
    recordActivity,
    ...extra,
  };
}

async function propose(seed, who, tool, input, extra) {
  const { runTool } = await load("src/lib/assistant/tools.js");
  return runTool(context(seed, who, extra), tool, input);
}

async function confirm(seed, who, proposal, extra) {
  const { decideAction } = await load("src/lib/assistant/actions.js");
  return decideAction(context(seed, who, extra), proposal.action.id, "confirm");
}

async function insertTask(seed, userId, title, extra = {}) {
  const { project_id = null, due_date = null, status = "todo" } = extra;
  return (await seed.db.query(
    "INSERT INTO tasks (user_id, title, project_id, due_date, status) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    [userId, title, project_id, due_date, status]
  )).rows[0].id;
}

function fieldValue(card, label) {
  return card.fields.find((field) => field.label === label)?.value;
}

async function assertNothingProposed(seed) {
  assert.equal((await seed.db.query("SELECT COUNT(*)::int AS n FROM ai_actions")).rows[0].n, 0);
}

// ---------- tool input ----------

test("lists and nested objects in tool input are validated", async () => {
  const { validateToolInput, ToolInputError } = await load("src/lib/assistant/schema.js");
  const schema = {
    type: "object",
    properties: {
      names: { type: "array", minItems: 1, maxItems: 2, items: { type: "string", minLength: 1, maxLength: 5 } },
      blocks: {
        type: "array",
        items: {
          type: "object",
          properties: { at: { type: "string", pattern: "^\\d\\d:\\d\\d$", description: "as HH:MM" } },
          required: ["at"],
          additionalProperties: false,
        },
      },
    },
  };
  assert.deepEqual(
    validateToolInput(schema, { names: [" a "], blocks: [{ at: "09:00" }] }),
    { names: ["a"], blocks: [{ at: "09:00" }] }
  );
  for (const input of [
    { names: "a" },
    { names: [] },
    { names: ["a", "b", "c"] },
    { names: ["   "] },
    { names: ["toolong"] },
    { names: [1] },
    { blocks: [{}] },
    { blocks: [{ at: "9am" }] },
    { blocks: [{ at: "09:00", extra: true }] },
    { blocks: ["09:00"] },
  ]) {
    assert.throws(() => validateToolInput(schema, input), ToolInputError, JSON.stringify(input));
  }
});

// ---------- find_free_time ----------

test("free time is what's left in the hours asked for, read in the member's timezone", async () => {
  const seed = await setup();
  try {
    const events = [
      // 10:00 to 11:00 and an overlapping 10:30 to 12:00 on Fri 23 Oct.
      { title: "A", start_time: "2026-10-23T04:30:00Z", end_time: "2026-10-23T05:30:00Z", all_day: false, status: "scheduled" },
      { title: "B", start_time: "2026-10-23T05:00:00Z", end_time: "2026-10-23T06:30:00Z", all_day: false, status: "scheduled" },
      // A cancelled event leaves its time free.
      { title: "C", start_time: "2026-10-23T08:30:00Z", end_time: "2026-10-23T09:30:00Z", all_day: false, status: "cancelled" },
      { title: "Holiday", start_time: "2026-10-23T00:00:00Z", end_time: "2026-10-24T00:00:00Z", start_date: "2026-10-23", end_date: "2026-10-24", all_day: true, status: "scheduled" },
    ];
    const ranges = [];
    const listEvents = async (range) => {
      ranges.push(range);
      return events;
    };

    const friday = await propose(seed, "owner", "find_free_time", { start_date: "2026-10-23", minutes: 60 }, { listEvents });
    assert.equal(friday.isError, false);
    assert.deepEqual(ranges[0], { start: "2026-10-22T18:30:00.000Z", end: "2026-10-23T18:30:00.000Z" });
    assert.deepEqual(friday.output.free, [
      { day: "Fri 2026-10-23", from: "09:00", to: "10:00", minutes: 60 },
      { day: "Fri 2026-10-23", from: "12:00", to: "18:00", minutes: 360 },
    ]);
    assert.deepEqual(friday.output.all_day_events, [{ title: "Holiday", date: "Fri 2026-10-23" }], "a one-day event doesn't run into the next day");

    const longer = await propose(seed, "owner", "find_free_time", { start_date: "2026-10-23", minutes: 90, earliest: "08:00", latest: "11:00" }, { listEvents });
    assert.deepEqual(longer.output.free, [{ day: "Fri 2026-10-23", from: "08:00", to: "10:00", minutes: 120 }]);

    // Today starts from now, and a past day has nothing left.
    const today = await propose(seed, "owner", "find_free_time", { start_date: "2026-10-22", minutes: 30 }, { listEvents: async () => [] });
    assert.deepEqual(today.output.free, [{ day: "Thu 2026-10-22", from: "15:00", to: "18:00", minutes: 180 }]);
    const past = await propose(seed, "owner", "find_free_time", { start_date: "2026-10-21", minutes: 30 }, { listEvents: async () => [] });
    assert.deepEqual(past.output.free, []);

    for (const input of [
      { start_date: "2026-10-23" },
      { start_date: "2026-10-23", minutes: 1 },
      { start_date: "2026-10-23", minutes: 30, earliest: "9am" },
      { start_date: "2026-10-23", minutes: 30, earliest: "18:00", latest: "09:00" },
      { start_date: "2026-10-23", end_date: "2026-10-22", minutes: 30 },
      { start_date: "2026-10-01", end_date: "2026-10-30", minutes: 30 },
    ]) {
      assert.equal((await propose(seed, "owner", "find_free_time", input, { listEvents })).isError, true, JSON.stringify(input));
    }
  } finally {
    await seed.db.close();
  }
});

// ---------- move_tasks ----------

test("moving several tasks is one card, one change, and all or nothing", async () => {
  const seed = await setup();
  try {
    const overdue = await insertTask(seed, seed.owner, "Pay rent", { due_date: "2026-10-20T06:30:00Z" });
    const undated = await insertTask(seed, seed.owner, "Plan trip");
    const shared = await insertTask(seed, seed.member, "Member's launch task", { project_id: seed.project });
    const alreadyThere = await insertTask(seed, seed.owner, "Already due", { due_date: "2026-10-26T06:30:00Z" });

    const proposal = await propose(seed, "owner", "move_tasks", {
      task_ids: [overdue, undated, shared, alreadyThere, overdue], due_date: "2026-10-26",
    });
    assert.equal(proposal.isError, false);
    assert.equal(proposal.action.card.title, "Move 3 tasks");
    assert.equal(fieldValue(proposal.action.card, "New due"), "Mon 2026-10-26");
    assert.match(proposal.action.card.body.text, /Pay rent \(was Tue 2026-10-20\)/);
    assert.match(proposal.action.card.body.text, /Plan trip \(no due date\)/);
    assert.doesNotMatch(proposal.action.card.body.text, /Already due/);

    const before = (await seed.db.query("SELECT due_date FROM tasks WHERE id = $1", [overdue])).rows[0].due_date;
    assert.equal(new Date(before).toISOString(), "2026-10-20T06:30:00.000Z", "nothing moves until confirmed");

    const applied = await confirm(seed, "owner", proposal);
    assert.equal(applied.status, "applied");
    assert.equal(applied.result.href, "/tasks");
    const days = await seed.db.query(
      "SELECT DISTINCT to_char((due_date AT TIME ZONE $1)::date, 'YYYY-MM-DD') AS day FROM tasks",
      [TIME_ZONE]
    );
    assert.deepEqual(days.rows, [{ day: "2026-10-26" }]);
    const activity = await seed.db.query("SELECT entity_title FROM project_activity");
    assert.deepEqual(activity.rows, [{ entity_title: "Member's launch task" }]);

    assert.match((await propose(seed, "owner", "move_tasks", { task_ids: [overdue], due_date: "2026-10-26" })).output.error, /already due/);
  } finally {
    await seed.db.close();
  }
});

test("moving tasks refuses what the member can't edit, on proposal and on confirm", async () => {
  const seed = await setup();
  try {
    const mine = await insertTask(seed, seed.member, "Mine");
    const owners = await insertTask(seed, seed.owner, "Owner's", { project_id: seed.project });
    const privateTask = await insertTask(seed, seed.owner, "Private");
    const finished = await insertTask(seed, seed.member, "Finished", { status: "done" });
    const dueDate = "2026-10-26";

    assert.match((await propose(seed, "member", "move_tasks", { task_ids: [mine, owners], due_date: dueDate })).output.error, /Only the task creator.*Owner's/);
    assert.match((await propose(seed, "member", "move_tasks", { task_ids: [mine, privateTask], due_date: dueDate })).output.error, /visible/);
    assert.match((await propose(seed, "member", "move_tasks", { task_ids: [finished], due_date: dueDate })).output.error, /already done/);
    await assertNothingProposed(seed);

    // Access lost between the card and the click leaves every task as it was.
    const shared = await insertTask(seed, seed.member, "Shared", { project_id: seed.project });
    const proposal = await propose(seed, "member", "move_tasks", { task_ids: [mine, shared], due_date: dueDate });
    await seed.db.query("DELETE FROM project_members WHERE project_id = $1 AND user_id = $2", [seed.project, seed.member]);
    const decided = await confirm(seed, "member", proposal);
    assert.equal(decided.status, "failed");
    assert.match(decided.result.error, /none were moved/);
    assert.equal((await seed.db.query("SELECT due_date FROM tasks WHERE id = $1", [mine])).rows[0].due_date, null);
  } finally {
    await seed.db.close();
  }
});

// ---------- add_subtasks ----------

test("subtasks follow on from existing ones and stay in the parent's project", async () => {
  const seed = await setup();
  try {
    const parent = await insertTask(seed, seed.owner, "Launch page", { project_id: seed.project });
    await seed.db.query(
      "INSERT INTO tasks (user_id, parent_task_id, title, position, project_id) VALUES ($1, $2, 'Existing', 5, $3)",
      [seed.owner, parent, seed.project]
    );

    // A project member can add subtasks to a teammate's task, as in the subtasks route.
    const proposal = await propose(seed, "member", "add_subtasks", { task_id: parent, titles: ["Write copy", "Add images"] });
    assert.equal(proposal.action.card.title, "Add 2 subtasks");
    assert.equal(proposal.action.card.body.text, "- Write copy\n- Add images");
    assert.match(proposal.action.card.notice, /Everyone in Launch/);

    const applied = await confirm(seed, "member", proposal);
    assert.equal(applied.status, "applied");
    assert.equal(applied.result.href, `/tasks?task_id=${parent}`);
    const rows = await seed.db.query(
      "SELECT title, position, user_id, project_id, status FROM tasks WHERE parent_task_id = $1 ORDER BY position",
      [parent]
    );
    assert.deepEqual(rows.rows.map((row) => [row.title, row.position]), [["Existing", 5], ["Write copy", 6], ["Add images", 7]]);
    assert.equal(rows.rows[1].user_id, seed.member);
    assert.equal(rows.rows[1].project_id, seed.project);
    assert.equal(rows.rows[1].status, "todo");
    assert.equal((await seed.db.query("SELECT COUNT(*)::int AS n FROM project_activity")).rows[0].n, 1, "one record for the whole change");

    const subtask = (await seed.db.query("SELECT id FROM tasks WHERE title = 'Write copy'")).rows[0].id;
    assert.match((await propose(seed, "owner", "add_subtasks", { task_id: subtask, titles: ["Deeper"] })).output.error, /already a subtask/);
    assert.match((await propose(seed, "outsider", "add_subtasks", { task_id: parent, titles: ["x"] })).output.error, /No task/);
    assert.equal((await propose(seed, "owner", "add_subtasks", { task_id: parent, titles: [] })).isError, true);
    assert.equal((await propose(seed, "owner", "add_subtasks", { task_id: parent, titles: Array(21).fill("x") })).isError, true);
  } finally {
    await seed.db.close();
  }
});

// ---------- sprints ----------

test("get_sprint shows the active sprint and only ever the member's own", async () => {
  const seed = await setup();
  try {
    const { addTasksToSprint, createSprint, startSprint } = await load("src/lib/sprints.js");
    const noSprint = await propose(seed, "owner", "get_sprint", {});
    assert.equal(noSprint.output.no_active_sprint, true);

    const active = await createSprint(seed.db, seed.owner, { name: "Sprint 1", goal: "Ship", startDate: "2026-10-19", endDate: "2026-10-30" });
    const planned = await createSprint(seed.db, seed.owner, { name: "Sprint 2", goal: null, startDate: "2026-11-02", endDate: "2026-11-13" });
    await startSprint(seed.db, seed.owner, active.id);
    const open = await insertTask(seed, seed.owner, "Open work", { project_id: seed.project, due_date: "2026-10-23T06:30:00Z" });
    const done = await insertTask(seed, seed.owner, "Finished work");
    const archived = await insertTask(seed, seed.owner, "Archived work");
    await seed.db.transaction((client) => addTasksToSprint(client, seed.owner, active.id, [open, done, archived]));
    await seed.db.query("UPDATE tasks SET status = 'done' WHERE id = $1", [done]);
    await seed.db.query("UPDATE tasks SET is_archived = TRUE WHERE id = $1", [archived]);

    const { output, isError } = await propose(seed, "owner", "get_sprint", {});
    assert.equal(isError, false);
    assert.equal(output.sprint.id, active.id);
    assert.equal(output.sprint.goal, "Ship");
    assert.equal(output.sprint.ends, "Fri 2026-10-30");
    assert.equal(output.sprint.timing, "8 days left");
    assert.equal(output.sprint.total_tasks, 2);
    assert.equal(output.sprint.done_tasks, 1);
    assert.deepEqual(output.sprint.tasks.map((task) => [task.title, task.status]), [["Open work", "todo"], ["Finished work", "done"]]);
    assert.equal(output.sprint.tasks[0].due, "Fri 2026-10-23");
    assert.equal(output.sprint.tasks[0].project, "Launch");
    assert.deepEqual(output.other_open_sprints.map((sprint) => sprint.id), [planned.id]);

    assert.equal((await propose(seed, "owner", "get_sprint", { sprint_id: planned.id })).output.sprint.name, "Sprint 2");
    assert.match((await propose(seed, "member", "get_sprint", { sprint_id: active.id })).output.error, /No sprint/);
    assert.equal((await propose(seed, "member", "get_sprint", {})).output.no_active_sprint, true);
  } finally {
    await seed.db.close();
  }
});

test("adding to a sprint moves tasks from another open sprint and refuses what can't join", async () => {
  const seed = await setup();
  try {
    const { addTasksToSprint, createSprint, completeSprint, startSprint } = await load("src/lib/sprints.js");
    const first = await createSprint(seed.db, seed.owner, { name: "First", goal: null, startDate: "2026-10-19", endDate: "2026-10-30" });
    const second = await createSprint(seed.db, seed.owner, { name: "Second", goal: null, startDate: "2026-11-02", endDate: "2026-11-13" });
    const moving = await insertTask(seed, seed.owner, "Moving");
    const fresh = await insertTask(seed, seed.owner, "Fresh");
    await seed.db.transaction((client) => addTasksToSprint(client, seed.owner, first.id, [moving]));

    const proposal = await propose(seed, "owner", "add_to_sprint", { sprint_id: second.id, task_ids: [moving, fresh] });
    assert.equal(fieldValue(proposal.action.card, "Sprint"), "Second");
    assert.equal(fieldValue(proposal.action.card, "Dates"), "Mon 2026-11-02 to Fri 2026-11-13");
    assert.match(proposal.action.card.body.text, /Moving \(moves from First\)/);
    assert.match(proposal.action.card.body.text, /- Fresh$/m);
    assert.equal((await seed.db.query("SELECT COUNT(*)::int AS n FROM sprint_tasks")).rows[0].n, 1, "nothing changes until confirmed");

    const applied = await confirm(seed, "owner", proposal);
    assert.equal(applied.status, "applied");
    assert.equal(applied.result.href, "/sprints");
    const rows = await seed.db.query("SELECT sprint_id FROM sprint_tasks");
    assert.deepEqual(rows.rows, [{ sprint_id: second.id }, { sprint_id: second.id }]);

    assert.match((await propose(seed, "owner", "add_to_sprint", { sprint_id: second.id, task_ids: [fresh] })).output.error, /already in/);
    assert.match((await propose(seed, "member", "add_to_sprint", { sprint_id: second.id, task_ids: [fresh] })).output.error, /No sprint/);

    const others = await insertTask(seed, seed.member, "Someone else's");
    assert.match((await propose(seed, "owner", "add_to_sprint", { sprint_id: first.id, task_ids: [others] })).output.error, /Only open tasks/);
    const finished = await insertTask(seed, seed.owner, "Finished", { status: "done" });
    assert.match((await propose(seed, "owner", "add_to_sprint", { sprint_id: first.id, task_ids: [finished] })).output.error, /Only open tasks/);

    // A sprint closed between the card and the click refuses the change.
    const late = await propose(seed, "owner", "add_to_sprint", { sprint_id: first.id, task_ids: [await insertTask(seed, seed.owner, "Late")] });
    await startSprint(seed.db, seed.owner, first.id);
    await seed.db.transaction((client) => completeSprint(client, seed.owner, first.id));
    const decided = await confirm(seed, "owner", late);
    assert.equal(decided.status, "failed");
    assert.match(decided.result.error, /closed/);
    assert.match((await propose(seed, "owner", "add_to_sprint", { sprint_id: first.id, task_ids: [fresh] })).output.error, /closed/);
  } finally {
    await seed.db.close();
  }
});

// ---------- complete_routine ----------

test("routine items are checked off for the day on the card, and only the member's own", async () => {
  const seed = await setup();
  try {
    const section = (await seed.db.query("INSERT INTO checklist_sections (user_id, name) VALUES ($1, 'Morning') RETURNING id", [seed.owner])).rows[0].id;
    const insertItem = async (name) => (await seed.db.query(
      "INSERT INTO checklist_items (section_id, name) VALUES ($1, $2) RETURNING id", [section, name]
    )).rows[0].id;
    const stretch = await insertItem("Stretch");
    const read = await insertItem("Read");
    await seed.db.query("INSERT INTO checklist_logs (item_id, log_date, completed) VALUES ($1, '2026-10-22', TRUE)", [read]);

    // get_agenda gives the ids this needs.
    const agenda = await propose(seed, "owner", "get_agenda", { start_date: "2026-10-22" });
    assert.deepEqual(agenda.output.routines.map((item) => item.id).sort(), [stretch, read].sort());

    const proposal = await propose(seed, "owner", "complete_routine", { item_ids: [stretch, read], date: "2026-10-22" });
    assert.equal(proposal.action.card.title, "Check off routine");
    assert.equal(fieldValue(proposal.action.card, "Day"), "Thu 2026-10-22");
    assert.equal(proposal.action.card.body.text, "- Stretch", "only what would change");
    assert.equal((await seed.db.query("SELECT COUNT(*)::int AS n FROM checklist_logs")).rows[0].n, 1);

    const applied = await confirm(seed, "owner", proposal);
    assert.equal(applied.status, "applied");
    assert.equal(applied.result.href, "/routines");
    const logged = await seed.db.query(
      "SELECT to_char(log_date, 'YYYY-MM-DD') AS day, completed FROM checklist_logs WHERE item_id = $1",
      [stretch]
    );
    assert.deepEqual(logged.rows, [{ day: "2026-10-22", completed: true }]);

    assert.match((await propose(seed, "owner", "complete_routine", { item_ids: [stretch], date: "2026-10-22" })).output.error, /already checked off/);

    const undo = await propose(seed, "owner", "complete_routine", { item_ids: [stretch], date: "2026-10-22", done: false });
    assert.equal(undo.action.card.title, "Uncheck routine");
    await confirm(seed, "owner", undo);
    assert.equal((await seed.db.query("SELECT completed FROM checklist_logs WHERE item_id = $1", [stretch])).rows[0].completed, false);

    assert.match((await propose(seed, "owner", "complete_routine", { item_ids: [stretch], date: "2026-10-23" })).output.error, /hasn't happened/);
    assert.match((await propose(seed, "member", "complete_routine", { item_ids: [stretch], date: "2026-10-22" })).output.error, /are yours/);
    assert.equal((await propose(seed, "owner", "complete_routine", { item_ids: [stretch] })).isError, true, "the day is always explicit");

    // A later click still logs the day the card showed.
    const earlier = await propose(seed, "owner", "complete_routine", { item_ids: [stretch], date: "2026-10-21" });
    await confirm(seed, "owner", earlier, { today: "2026-10-30" });
    assert.equal((await seed.db.query("SELECT COUNT(*)::int AS n FROM checklist_logs WHERE log_date = '2026-10-21'")).rows[0].n, 1);
  } finally {
    await seed.db.close();
  }
});

// ---------- save_memory ----------

test("a memory is saved only on confirm and never past the limit", async () => {
  const seed = await setup();
  try {
    const { MEMORY_ITEMS_MAX, listMemories, memorySnapshot } = await load("src/lib/assistant/memory.js");
    const proposal = await propose(seed, "owner", "save_memory", { text: "No meetings on Fridays" });
    assert.equal(proposal.action.card.body.text, "No meetings on Fridays");
    assert.match(proposal.action.card.notice, /every new conversation/);
    assert.deepEqual(await listMemories(seed.db, seed.owner), [], "a planted instruction goes nowhere without the click");

    const applied = await confirm(seed, "owner", proposal);
    assert.equal(applied.status, "applied");
    assert.equal(applied.result.href, "/settings");
    const memories = await listMemories(seed.db, seed.owner);
    assert.equal(memorySnapshot(memories), "- No meetings on Fridays");
    assert.deepEqual(await listMemories(seed.db, seed.member), []);

    assert.match((await propose(seed, "owner", "save_memory", { text: "no meetings on fridays" })).output.error, /already saved/);
    assert.equal((await propose(seed, "owner", "save_memory", { text: "x".repeat(501) })).isError, true);

    // A proposal made before the limit was reached fails on confirm with the reason.
    const late = await propose(seed, "owner", "save_memory", { text: "One more" });
    for (let index = 1; index < MEMORY_ITEMS_MAX; index += 1) {
      await seed.db.query("INSERT INTO assistant_memories (user_id, content) VALUES ($1, $2)", [seed.owner, `m${index}`]);
    }
    assert.match((await propose(seed, "owner", "save_memory", { text: "Too many" })).output.error, /the most allowed/);
    const decided = await confirm(seed, "owner", late);
    assert.equal(decided.status, "failed");
    assert.match(decided.result.error, /Remove one/);
  } finally {
    await seed.db.close();
  }
});

// ---------- plan_my_day ----------

async function insertCalendar(seed, userId, googleCalendarId = null) {
  return (await seed.db.query(
    "INSERT INTO calendars (user_id, name, is_default, google_calendar_id) VALUES ($1, 'Mine', TRUE, $2) RETURNING id",
    [userId, googleCalendarId]
  )).rows[0].id;
}

test("a day plan goes on the calendar in the member's timezone and replaces the last one", async () => {
  const seed = await setup();
  try {
    await insertCalendar(seed, seed.owner);
    const synced = [];
    const syncDayPlan = async ({ userId, eventIds }) => {
      synced.push({ userId, count: eventIds.length });
      return { googleError: "Some Google changes are still pending. Sync again to retry." };
    };
    const planEvents = () => seed.db.query(
      "SELECT title, start_time, end_time, event_type, source_key FROM events WHERE user_id = $1 ORDER BY start_time",
      [seed.owner]
    );

    const proposal = await propose(seed, "owner", "plan_my_day", {
      date: "2026-10-23",
      blocks: [
        { title: "Email", start: "11:00", end: "11:30" },
        { title: "Deep work", start: "09:00", end: "11:00" },
      ],
    });
    assert.equal(proposal.isError, false);
    assert.equal(proposal.action.card.title, "Plan your day");
    assert.equal(proposal.action.card.body.text, "09:00–11:00 Deep work\n11:00–11:30 Email");
    assert.equal(proposal.action.card.notice, undefined);
    assert.equal((await planEvents()).rows.length, 0);

    const applied = await confirm(seed, "owner", proposal, { syncDayPlan });
    assert.equal(applied.status, "applied");
    assert.equal(applied.result.warning, "Some Google changes are still pending. Sync again to retry.", "the plan is saved, and the member hears Google missed it");
    assert.deepEqual(synced, [{ userId: seed.owner, count: 2 }]);
    const events = (await planEvents()).rows;
    assert.deepEqual(events.map((event) => event.title), ["Deep work", "Email"]);
    assert.equal(new Date(events[0].start_time).toISOString(), "2026-10-23T03:30:00.000Z");
    assert.equal(events[0].event_type, "time_block");
    const log = await seed.db.query("SELECT to_char(log_date, 'YYYY-MM-DD') AS day, status FROM day_plan_logs");
    assert.deepEqual(log.rows, [{ day: "2026-10-23", status: "edited" }]);

    // An ordinary event on that day survives; the plan's own blocks are replaced, and the card says so.
    const calendar = (await seed.db.query("SELECT id FROM calendars WHERE user_id = $1", [seed.owner])).rows[0].id;
    await seed.db.query(
      "INSERT INTO events (user_id, calendar_id, title, start_time, end_time) VALUES ($1, $2, 'Dentist', '2026-10-23T09:30:00Z', '2026-10-23T10:30:00Z')",
      [seed.owner, calendar]
    );
    const listEvents = async () => [
      { title: "Dentist", start_time: "2026-10-23T09:30:00Z", end_time: "2026-10-23T10:30:00Z", status: "scheduled", event_type: "event" },
      { title: "Called off", start_time: "2026-10-23T09:30:00Z", end_time: "2026-10-23T10:30:00Z", status: "cancelled", event_type: "event" },
      { title: "Deep work", start_time: "2026-10-23T09:30:00Z", end_time: "2026-10-23T10:30:00Z", status: "scheduled", event_type: "time_block" },
    ];
    const again = await propose(seed, "owner", "plan_my_day", {
      date: "2026-10-23", blocks: [{ title: "Writing", start: "15:00", end: "16:00" }],
    }, { listEvents });
    assert.match(again.action.card.notice, /replaces the 2 planned blocks/);
    assert.match(again.action.card.notice, /overlaps with Dentist \(15:00\)\./);
    await confirm(seed, "owner", again, { syncDayPlan });
    assert.deepEqual((await planEvents()).rows.map((event) => event.title).sort(), ["Dentist", "Writing"]);

    const agenda = await propose(seed, "owner", "get_agenda", { start_date: "2026-10-23" });
    assert.match(agenda.output.day_plan.status, /Applied/);
  } finally {
    await seed.db.close();
  }
});

test("a day plan must make sense before it reaches a card", async () => {
  const seed = await setup();
  try {
    for (const input of [
      { date: "2026-10-23", blocks: [] },
      { date: "2026-10-21", blocks: [{ title: "Past", start: "09:00", end: "10:00" }] },
      { date: "2026-10-23", blocks: [{ title: "Backwards", start: "10:00", end: "09:00" }] },
      { date: "2026-10-23", blocks: [{ title: "Bad", start: "25:00", end: "26:00" }] },
      { date: "2026-10-23", blocks: [{ title: "A", start: "09:00", end: "10:00" }, { title: "B", start: "09:30", end: "10:30" }] },
      { date: "2026-10-23", blocks: Array.from({ length: 21 }, (_, index) => ({ title: `b${index}`, start: "09:00", end: "10:00" })) },
    ]) {
      assert.equal((await propose(seed, "owner", "plan_my_day", input)).isError, true, JSON.stringify(input));
    }
    await assertNothingProposed(seed);

    await insertCalendar(seed, seed.owner, "primary");
    const linked = await propose(seed, "owner", "plan_my_day", { date: "2026-10-23", blocks: [{ title: "A", start: "09:00", end: "10:00" }] });
    assert.match(linked.action.card.notice, /Google Calendar/);
  } finally {
    await seed.db.close();
  }
});

// ---------- update_event ----------

async function insertEvent(seed, userId, extra = {}) {
  const calendar = (await seed.db.query("SELECT id FROM calendars WHERE user_id = $1 LIMIT 1", [userId])).rows[0]?.id
    || await insertCalendar(seed, userId);
  const {
    title = "Standup",
    start = "2026-10-23T09:30:00Z",
    end = "2026-10-23T10:30:00Z",
    allDay = false,
    rule = null,
    projectId = null,
  } = extra;
  return (await seed.db.query(
    `INSERT INTO events (user_id, calendar_id, title, start_time, end_time, all_day, recurrence_rule, project_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [userId, calendar, title, start, end, allDay, rule, projectId]
  )).rows[0].id;
}

function eventServices() {
  const updates = [];
  const creates = [];
  return {
    updates,
    creates,
    updateEvent: async (call) => {
      updates.push(call);
      return { event: { id: call.id }, googleError: null };
    },
    createEvent: async (call) => {
      creates.push(call);
      return { event: { id: "new-event" }, googleError: null };
    },
  };
}

test("moving a one-off event keeps its length when only a start is given", async () => {
  const seed = await setup();
  try {
    const event = await insertEvent(seed, seed.owner); // 15:00 to 16:00 local on Fri 23 Oct.
    const proposal = await propose(seed, "owner", "update_event", { event_id: event, start: "2026-10-23T16:00" });
    assert.equal(proposal.isError, false);
    assert.equal(fieldValue(proposal.action.card, "Event"), "Standup");
    assert.equal(fieldValue(proposal.action.card, "When"), "Fri 2026-10-23, 15:00 to 16:00 → Fri 2026-10-23, 16:00 to 17:00");

    const services = eventServices();
    const applied = await confirm(seed, "owner", proposal, services);
    assert.equal(applied.status, "applied");
    assert.equal(applied.result.href, "/calendar");
    assert.deepEqual(services.updates, [{
      userId: seed.owner,
      id: event,
      body: { all_day: false, start_time: "2026-10-23T10:30:00.000Z", end_time: "2026-10-23T11:30:00.000Z" },
    }]);

    const renamed = await propose(seed, "owner", "update_event", { event_id: event, title: "Sync", location: "Room 2" });
    assert.equal(fieldValue(renamed.action.card, "Title"), "Standup → Sync");
    assert.equal(fieldValue(renamed.action.card, "When"), "Fri 2026-10-23, 15:00 to 16:00", "the card still says which event");
    const renameServices = eventServices();
    await confirm(seed, "owner", renamed, renameServices);
    assert.deepEqual(renameServices.updates[0].body, { title: "Sync", location: "Room 2" });

    const longer = await propose(seed, "owner", "update_event", { event_id: event, end: "2026-10-23T17:30" });
    assert.equal(fieldValue(longer.action.card, "When"), "Fri 2026-10-23, 15:00 to 16:00 → Fri 2026-10-23, 15:00 to 17:30");

    const allDay = await propose(seed, "owner", "update_event", { event_id: event, date: "2026-10-26" });
    assert.equal(fieldValue(allDay.action.card, "When"), "Fri 2026-10-23, 15:00 to 16:00 → Mon 2026-10-26, all day");

    for (const input of [
      { event_id: event },
      { event_id: event, title: "Standup" },
      { event_id: event, start: "2026-10-23T15:00" },
      { event_id: event, end: "2026-10-23T14:00" },
      { event_id: event, start: "2026-10-23T15:00", date: "2026-10-23" },
      { event_id: event, end_date: "2026-10-24" },
      { event_id: "not-an-id", title: "x" },
      { event_id: event, start: "at four" },
    ]) {
      assert.equal((await propose(seed, "owner", "update_event", input)).isError, true, JSON.stringify(input));
    }
  } finally {
    await seed.db.close();
  }
});

test("an all-day event keeps its number of days when moved", async () => {
  const seed = await setup();
  try {
    const event = await insertEvent(seed, seed.owner, {
      title: "Offsite", start: "2026-10-26T00:00:00Z", end: "2026-10-28T00:00:00Z", allDay: true,
    });
    const proposal = await propose(seed, "owner", "update_event", { event_id: event, date: "2026-11-02" });
    assert.equal(fieldValue(proposal.action.card, "When"), "Mon 2026-10-26 to Tue 2026-10-27, all day → Mon 2026-11-02 to Tue 2026-11-03, all day");
    const services = eventServices();
    await confirm(seed, "owner", proposal, services);
    assert.deepEqual(services.updates[0].body, {
      all_day: true, start_time: "2026-11-02T00:00:00.000Z", end_time: "2026-11-04T00:00:00.000Z",
    });

    const timed = await propose(seed, "owner", "update_event", { event_id: event, start: "2026-11-02T09:00" });
    assert.match(timed.output.error, /needs both start and end/);
    const toTimed = await propose(seed, "owner", "update_event", { event_id: event, start: "2026-11-02T09:00", end: "2026-11-02T10:00" });
    assert.equal(toTimed.isError, false);
  } finally {
    await seed.db.close();
  }
});

test("a repeating event needs a scope, and moving all of them keeps the series' first date", async () => {
  const seed = await setup();
  try {
    // Weekly on Mondays from 5 Oct, 15:00 to 16:00 local.
    const event = await insertEvent(seed, seed.owner, { start: "2026-10-05T09:30:00Z", end: "2026-10-05T10:30:00Z", rule: "weekly" });
    const occurrence = `${event}___2026-10-26`;

    const noScope = await propose(seed, "owner", "update_event", { event_id: occurrence, start: "2026-10-26T16:00" });
    assert.match(noScope.output.error, /repeats.*scope/);

    const proposal = await propose(seed, "owner", "update_event", { event_id: occurrence, scope: "all", start: "2026-10-26T16:00" });
    assert.equal(proposal.action.card.title, "Change event");
    assert.equal(fieldValue(proposal.action.card, "When"), "Mon 2026-10-26, 15:00 to 16:00 → Mon 2026-10-26, 16:00 to 17:00");
    assert.equal(fieldValue(proposal.action.card, "Repeats"), "Every week");
    assert.match(proposal.action.card.notice, /every occurrence/);

    const services = eventServices();
    await confirm(seed, "owner", proposal, services);
    assert.deepEqual(services.updates, [{
      userId: seed.owner,
      id: event,
      body: { all_day: false, start_time: "2026-10-05T10:30:00.000Z", end_time: "2026-10-05T11:30:00.000Z" },
    }]);
    assert.equal(services.creates.length, 0);

    // An occurrence that doesn't exist isn't invented.
    const notThere = await propose(seed, "owner", "update_event", { event_id: `${event}___2026-10-27`, scope: "all", start: "2026-10-27T16:00" });
    assert.match(notThere.output.error, /isn't on the calendar/);
    const needsDate = await propose(seed, "owner", "update_event", { event_id: event, scope: "this", start: "2026-10-26T16:00" });
    assert.match(needsDate.output.error, /its id from get_agenda/);

    const custom = await insertEvent(seed, seed.owner, { start: "2026-10-05T09:30:00Z", end: "2026-10-05T10:30:00Z", rule: "custom:Mon,Wed" });
    const otherDay = await propose(seed, "owner", "update_event", { event_id: `${custom}___2026-10-26`, scope: "all", start: "2026-10-27T15:00" });
    assert.match(otherDay.output.error, /selected weekdays/);
    const sameDay = await propose(seed, "owner", "update_event", { event_id: `${custom}___2026-10-26`, scope: "all", start: "2026-10-26T16:00" });
    assert.equal(sameDay.isError, false);
    const toAllDay = await propose(seed, "owner", "update_event", { event_id: `${custom}___2026-10-26`, scope: "all", date: "2026-10-26" });
    assert.match(toAllDay.output.error, /can't switch/);
  } finally {
    await seed.db.close();
  }
});

test("changing one occurrence adds a separate event, then cancels the original", async () => {
  const seed = await setup();
  try {
    const event = await insertEvent(seed, seed.owner, {
      title: "Review", start: "2026-10-05T09:30:00Z", end: "2026-10-05T10:30:00Z", rule: "weekly", projectId: seed.project,
    });
    const task = await insertTask(seed, seed.owner, "Linked", { project_id: seed.project });
    await seed.db.query("INSERT INTO event_tasks (event_id, task_id) VALUES ($1, $2)", [event, task]);
    const occurrence = `${event}___2026-10-26`;

    const proposal = await propose(seed, "owner", "update_event", { event_id: occurrence, scope: "this", start: "2026-10-27T11:00" });
    assert.equal(proposal.action.card.title, "Change one occurrence");
    assert.equal(fieldValue(proposal.action.card, "When"), "Mon 2026-10-26, 15:00 to 16:00 → Tue 2026-10-27, 11:00 to 12:00");
    assert.match(proposal.action.card.notice, /Only this occurrence changes/);
    assert.match(proposal.action.card.notice, /Everyone in Launch/);

    const services = eventServices();
    const applied = await confirm(seed, "owner", proposal, services);
    assert.equal(applied.status, "applied");
    assert.equal(applied.result.id, "new-event");
    const calendar = (await seed.db.query("SELECT id FROM calendars WHERE user_id = $1", [seed.owner])).rows[0].id;
    assert.deepEqual(services.creates, [{
      userId: seed.owner,
      body: {
        title: "Review",
        description: null,
        location: null,
        all_day: false,
        start_time: "2026-10-27T05:30:00.000Z",
        end_time: "2026-10-27T06:30:00.000Z",
        recurrence_rule: null,
        project_id: seed.project,
        event_type: "event",
        event_color: null,
        calendar_id: calendar,
        task_ids: [task],
      },
    }]);
    assert.deepEqual(services.updates, [{ userId: seed.owner, id: occurrence, body: { status: "cancelled" } }]);

    // If cancelling the original fails, the new event stands and the member is told.
    const second = await propose(seed, "owner", "update_event", { event_id: `${event}___2026-11-02`, scope: "this", title: "Special review" });
    const logged = [];
    const partly = await confirm(seed, "owner", second, {
      ...eventServices(),
      updateEvent: async () => { throw new Error("database down"); },
      onError: (error) => logged.push(error.message),
    });
    assert.equal(partly.status, "applied");
    assert.match(partly.result.warning, /still on your calendar/);
    assert.deepEqual(logged, ["database down"]);

    // If the new event can't be made, the original is left alone.
    const third = await propose(seed, "owner", "update_event", { event_id: `${event}___2026-11-09`, scope: "this", title: "x" });
    const untouched = eventServices();
    const failed = await confirm(seed, "owner", third, {
      ...untouched,
      createEvent: async () => { throw Object.assign(new Error("Project not found"), { status: 404 }); },
    });
    assert.equal(failed.status, "failed");
    assert.equal(failed.result.error, "Project not found");
    assert.equal(untouched.updates.length, 0);
  } finally {
    await seed.db.close();
  }
});

test("event changes follow the calendar's permissions", async () => {
  const seed = await setup();
  try {
    const ownerEvent = await insertEvent(seed, seed.owner, { projectId: seed.project });
    const privateEvent = await insertEvent(seed, seed.owner, { title: "Private" });
    const memberEvent = await insertEvent(seed, seed.member, { projectId: seed.project });

    assert.match((await propose(seed, "member", "update_event", { event_id: ownerEvent, title: "x" })).output.error, /Only the event creator/);
    assert.match((await propose(seed, "member", "update_event", { event_id: privateEvent, title: "x" })).output.error, /No event/);
    assert.match((await propose(seed, "outsider", "update_event", { event_id: ownerEvent, title: "x" })).output.error, /No event/);
    await assertNothingProposed(seed);

    // The project owner can edit a member's event.
    const proposal = await propose(seed, "owner", "update_event", { event_id: memberEvent, title: "Renamed" });
    assert.equal(proposal.isError, false);

    // And a member removed before confirming can't.
    const mine = await propose(seed, "member", "update_event", { event_id: memberEvent, title: "Mine" });
    await seed.db.query("DELETE FROM project_members WHERE project_id = $1 AND user_id = $2", [seed.project, seed.member]);
    const services = eventServices();
    const decided = await confirm(seed, "member", mine, services);
    assert.equal(decided.status, "failed");
    assert.match(decided.result.error, /No event/);
    assert.equal(services.updates.length, 0);
  } finally {
    await seed.db.close();
  }
});

test("the agenda gives event ids that update_event accepts, and one-day all-day events end that day", async () => {
  const seed = await setup();
  try {
    const event = await insertEvent(seed, seed.owner, { start: "2026-10-05T09:30:00Z", end: "2026-10-05T10:30:00Z", rule: "weekly" });
    const listEvents = async () => [
      {
        id: `${event}___2026-10-26`, title: "Standup", start_time: "2026-10-26T09:30:00Z", end_time: "2026-10-26T10:30:00Z",
        all_day: false, recurrence_rule: "weekly", status: "scheduled",
      },
      {
        id: "11111111-1111-4111-8111-111111111111", title: "Holiday", start_time: "2026-10-26T00:00:00Z", end_time: "2026-10-27T00:00:00Z",
        start_date: "2026-10-26", end_date: "2026-10-27", all_day: true, status: "scheduled",
      },
      {
        id: "22222222-2222-4222-8222-222222222222", title: "Offsite", start_time: "2026-10-26T00:00:00Z", end_time: "2026-10-28T00:00:00Z",
        start_date: "2026-10-26", end_date: "2026-10-28", all_day: true, status: "scheduled",
      },
    ];
    const agenda = await propose(seed, "owner", "get_agenda", { start_date: "2026-10-26" }, { listEvents });
    const [standup, holiday, offsite] = agenda.output.events;
    assert.equal(standup.id, `${event}___2026-10-26`);
    assert.equal(standup.repeats, "weekly");
    assert.equal(holiday.date, "Mon 2026-10-26");
    assert.equal(holiday.until, undefined);
    assert.equal(offsite.until, "Tue 2026-10-27");

    const proposal = await propose(seed, "owner", "update_event", { event_id: standup.id, scope: "all", title: "Daily" });
    assert.equal(proposal.isError, false);
  } finally {
    await seed.db.close();
  }
});

// ---------- across the set ----------

test("every new change is proposed, not made, and is reported without its text", async () => {
  const seed = await setup();
  try {
    const { actionUpdatesNote } = await load("src/lib/assistant/actions.js");
    const { toolDefinitions } = await load("src/lib/assistant/tools.js");
    const names = toolDefinitions().map((tool) => tool.name);
    for (const name of ["find_free_time", "get_sprint", "update_event", "move_tasks", "add_subtasks", "add_to_sprint", "complete_routine", "plan_my_day", "save_memory"]) {
      assert.ok(names.includes(name), name);
    }
    assert.equal(new Set(names).size, names.length);

    const proposal = await propose(seed, "owner", "save_memory", { text: "Secret preference" });
    assert.equal(proposal.output.status, "awaiting_confirmation");
    await confirm(seed, "owner", proposal);
    const task = await insertTask(seed, seed.owner, "Moved quietly");
    const moved = await propose(seed, "owner", "move_tasks", { task_ids: [task], due_date: "2026-10-26" });
    await confirm(seed, "owner", moved);

    const note = await actionUpdatesNote(seed.db, seed.conversations.owner, null);
    assert.match(note, /save_memory: the member confirmed it and it's done\. id .+, href \/settings/);
    assert.match(note, /move_tasks: the member confirmed it and it's done\. href \/tasks/);
    assert.doesNotMatch(note, /undefined/);
    assert.doesNotMatch(note, /Secret preference|Moved quietly/);
  } finally {
    await seed.db.close();
  }
});

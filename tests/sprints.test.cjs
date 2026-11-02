const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { setTimeout: delay } = require("node:timers/promises");
const { createSchemaDatabase } = require("./helpers/schema-database.cjs");

const root = path.resolve(__dirname, "..");
const load = (relativePath) => import(path.join(root, relativePath));
const MIGRATION = "20261031_personal_sprints.sql";
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const dates = { name: "Sprint", goal: null, startDate: "2026-11-02", endDate: "2026-11-15" };

async function insertUser(db, email) {
  const result = await db.query(
    "INSERT INTO users (email, password_hash, full_name) VALUES ($1, 'x', $1) RETURNING id",
    [email]
  );
  return result.rows[0].id;
}

async function insertTask(db, userId, title, fields = {}) {
  const result = await db.query(
    `INSERT INTO tasks (user_id, project_id, parent_task_id, title, status, is_archived)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [userId, fields.projectId || null, fields.parentTaskId || null, title, fields.status || "todo", fields.isArchived || false]
  );
  return result.rows[0].id;
}

// owner and member share a project; outsider shares nothing.
async function seed() {
  const db = await createSchemaDatabase();
  const owner = await insertUser(db, "owner@example.com");
  const member = await insertUser(db, "member@example.com");
  const outsider = await insertUser(db, "outsider@example.com");
  const project = (await db.query(
    "INSERT INTO projects (user_id, name) VALUES ($1, 'Launch') RETURNING id",
    [owner]
  )).rows[0].id;
  await db.query("INSERT INTO project_members (project_id, user_id) VALUES ($1, $2)", [project, member]);
  return { db, owner, member, outsider, project };
}

async function openRows(db, userId) {
  const result = await db.query(
    "SELECT sprint_id, task_id FROM sprint_tasks WHERE user_id = $1 AND outcome IS NULL",
    [userId]
  );
  return result.rows;
}

test("the migration records completion dates without disturbing updated_at", async () => {
  const db = await createSchemaDatabase({ before: MIGRATION });
  const userId = await insertUser(db, "backfill@example.com");
  await db.query(
    `INSERT INTO tasks (user_id, title, status, updated_at) VALUES
       ($1, 'Done long ago', 'done', '2026-01-05T10:00:00Z'),
       ($1, 'Still open', 'todo', '2026-01-05T10:00:00Z')`,
    [userId]
  );
  // The updated_at trigger only runs on UPDATE, so these timestamps are as set.
  await db.exec(read(`migrations/${MIGRATION}`).replace(/^\s*(BEGIN|COMMIT);\s*$/gim, ""));

  const rows = (await db.query("SELECT title, completed_at, updated_at FROM tasks ORDER BY title")).rows;
  const done = rows.find((row) => row.title === "Done long ago");
  const open = rows.find((row) => row.title === "Still open");
  assert.equal(done.completed_at.toISOString(), "2026-01-05T10:00:00.000Z");
  assert.equal(done.updated_at.toISOString(), "2026-01-05T10:00:00.000Z");
  assert.equal(open.completed_at, null);
  assert.equal(open.updated_at.toISOString(), "2026-01-05T10:00:00.000Z");
});

test("completed_at follows the status and ignores later edits", async () => {
  const { db, owner } = await seed();
  const id = await insertTask(db, owner, "Write report");
  const readTask = async () => (await db.query("SELECT completed_at FROM tasks WHERE id = $1", [id])).rows[0];

  assert.equal((await readTask()).completed_at, null);
  await db.query("UPDATE tasks SET status = 'done' WHERE id = $1", [id]);
  const finished = (await readTask()).completed_at;
  assert.ok(finished);

  await db.query("UPDATE tasks SET title = 'Edited later' WHERE id = $1", [id]);
  assert.equal((await readTask()).completed_at.getTime(), finished.getTime());

  await db.query("UPDATE tasks SET status = 'todo' WHERE id = $1", [id]);
  assert.equal((await readTask()).completed_at, null);

  const doneOnCreate = await insertTask(db, owner, "Already finished", { status: "done" });
  const created = await db.query("SELECT completed_at FROM tasks WHERE id = $1", [doneOnCreate]);
  assert.ok(created.rows[0].completed_at);
});

test("a sprint can hold personal and project work, and only tasks the member can edit", async () => {
  const sprints = await load("src/lib/sprints.js");
  const { db, owner, member, outsider, project } = await seed();
  const sprint = await sprints.createSprint(db, member, dates);

  const personal = await insertTask(db, member, "Personal errand");
  const ownShared = await insertTask(db, member, "My shared task", { projectId: project });
  const added = await sprints.addTasksToSprint(db, member, sprint.id, [personal, ownShared]);
  assert.equal(added.sprint.task_count, 2);

  const rejected = {
    "a collaborator's task": await insertTask(db, owner, "Owner task", { projectId: project }),
    "someone's private task": await insertTask(db, outsider, "Private"),
    "a finished task": await insertTask(db, member, "Finished", { status: "done" }),
    "an archived task": await insertTask(db, member, "Archived", { isArchived: true }),
    "a subtask": await insertTask(db, member, "Subtask", { parentTaskId: personal }),
  };
  for (const [label, taskId] of Object.entries(rejected)) {
    const result = await sprints.addTasksToSprint(db, member, sprint.id, [taskId]);
    assert.equal(result.status, 400, label);
  }
  assert.equal((await openRows(db, member)).length, 2);

  // The project creator can edit a member's task, so can plan it too.
  const ownerSprint = await sprints.createSprint(db, owner, dates);
  const shared = await sprints.addTasksToSprint(db, owner, ownerSprint.id, [ownShared]);
  assert.equal(shared.sprint.task_count, 1);
  assert.equal((await openRows(db, member)).length, 2, "one member's plans don't move another's");
});

test("another member's sprint behaves as if it doesn't exist", async () => {
  const sprints = await load("src/lib/sprints.js");
  const { db, owner, member } = await seed();
  const sprint = await sprints.createSprint(db, owner, dates);
  const task = await insertTask(db, member, "Member task");

  assert.deepEqual(await sprints.listSprints(db, member), []);
  assert.equal(await sprints.getSprint(db, member, sprint.id), null);
  assert.equal(await sprints.getSprintDetail(db, member, sprint.id), null);
  assert.equal((await sprints.updateSprint(db, member, sprint.id, { name: "Mine" })).status, 404);
  assert.equal((await sprints.startSprint(db, member, sprint.id)).status, 404);
  assert.equal((await sprints.completeSprint(db, member, sprint.id)).status, 404);
  assert.equal((await sprints.addTasksToSprint(db, member, sprint.id, [task])).status, 404);
  assert.equal((await sprints.removeTasksFromSprint(db, member, sprint.id, [task])).status, 404);
  assert.equal(await sprints.deleteSprint(db, member, sprint.id), false);

  const own = await sprints.createSprint(db, member, dates);
  const carry = await sprints.startSprint(db, member, own.id);
  assert.equal(carry.sprint.status, "active");
  assert.equal((await sprints.completeSprint(db, member, own.id, { carryOverSprintId: sprint.id })).status, 400);
  assert.equal((await sprints.getSprint(db, owner, sprint.id)).status, "planned");
});

test("the tasks API only labels and filters by the viewer's own sprints", () => {
  const list = read("src/app/api/tasks/route.js");
  const detail = read("src/app/api/tasks/[id]/route.js");
  for (const source of [list, detail]) {
    assert.match(source, /st\.task_id = t\.id AND st\.user_id = \$1 AND st\.outcome IS NULL\) AS sprint_id/);
  }
  assert.match(list, /in_sprint\.user_id = \$1 AND in_sprint\.sprint_id/);
  assert.match(list, /open_sprint\.user_id = \$1 AND open_sprint\.outcome IS NULL/);
});

test("sprint routes are protected and take the member from the session", () => {
  assert.match(read("src/proxy.js"), /"\/sprints"/);
  for (const file of ["route.js", "[id]/route.js", "[id]/start/route.js", "[id]/complete/route.js", "[id]/tasks/route.js"]) {
    const route = read(`src/app/api/sprints/${file}`);
    assert.match(route, /export const (GET|POST) = withAuth/, file);
    assert.match(route, /request\.user\.id/, file);
    assert.doesNotMatch(route, /body\.userId|body\.user_id/, file);
  }
});

test("one active sprint at a time, and a task sits in one open sprint", async () => {
  const sprints = await load("src/lib/sprints.js");
  const { db, owner } = await seed();
  const first = await sprints.createSprint(db, owner, dates);
  const second = await sprints.createSprint(db, owner, dates);

  assert.equal((await sprints.startSprint(db, owner, first.id)).sprint.status, "active");
  assert.equal((await sprints.startSprint(db, owner, first.id)).status, 409);
  const blocked = await sprints.startSprint(db, owner, second.id);
  assert.equal(blocked.status, 409);
  assert.match(blocked.error, /Close your active sprint/);

  const task = await insertTask(db, owner, "Moves between sprints");
  await sprints.addTasksToSprint(db, owner, first.id, [task]);
  await sprints.addTasksToSprint(db, owner, first.id, [task]);
  assert.equal((await openRows(db, owner)).length, 1, "adding twice is harmless");

  await sprints.addTasksToSprint(db, owner, second.id, [task]);
  assert.deepEqual(await openRows(db, owner), [{ sprint_id: second.id, task_id: task }]);
});

test("closing a sprint records outcomes and carries unfinished work forward", async () => {
  const sprints = await load("src/lib/sprints.js");
  const { db, owner } = await seed();
  const current = await sprints.createSprint(db, owner, dates);
  const next = await sprints.createSprint(db, owner, dates);
  const shipped = await insertTask(db, owner, "Shipped");
  const unfinished = await insertTask(db, owner, "Unfinished");
  const archivedDone = await insertTask(db, owner, "Done then archived");
  const shelved = await insertTask(db, owner, "Shelved");

  await sprints.addTasksToSprint(db, owner, current.id, [shipped, unfinished, archivedDone, shelved]);
  await sprints.startSprint(db, owner, current.id);
  await db.query("UPDATE tasks SET status = 'done' WHERE id = ANY($1::uuid[])", [[shipped, archivedDone]]);
  await db.query("UPDATE tasks SET is_archived = TRUE WHERE id = ANY($1::uuid[])", [[archivedDone, shelved]]);

  const open = await sprints.getSprint(db, owner, current.id);
  assert.equal(open.task_count, 3, "the unfinished archived task has left the board");
  assert.equal(open.done_count, 2);

  const closed = await sprints.completeSprint(db, owner, current.id, { carryOverSprintId: next.id });
  assert.equal(closed.sprint.status, "completed");
  assert.ok(closed.sprint.completed_at);
  assert.equal(closed.sprint.task_count, 3);
  assert.equal(closed.sprint.done_count, 2);

  const detail = await sprints.getSprintDetail(db, owner, current.id);
  assert.deepEqual(
    Object.fromEntries(detail.tasks.map((task) => [task.title, task.outcome])),
    { Shipped: "completed", "Done then archived": "completed", Unfinished: "unfinished" }
  );
  assert.deepEqual(await openRows(db, owner), [{ sprint_id: next.id, task_id: unfinished }]);

  // The record stays put when the task is reopened or finished later.
  await db.query("UPDATE tasks SET status = 'todo' WHERE id = $1", [shipped]);
  await db.query("UPDATE tasks SET status = 'done' WHERE id = $1", [unfinished]);
  const later = await sprints.getSprint(db, owner, current.id);
  assert.equal(later.done_count, 2);

  assert.equal((await sprints.completeSprint(db, owner, current.id)).status, 409, "closing twice is refused");
  assert.equal((await sprints.addTasksToSprint(db, owner, current.id, [shelved])).status, 409);
  assert.equal((await sprints.removeTasksFromSprint(db, owner, current.id, [shipped])).status, 409);
});

test("closing without a target returns unfinished work to the backlog", async () => {
  const sprints = await load("src/lib/sprints.js");
  const { db, owner } = await seed();
  const sprint = await sprints.createSprint(db, owner, dates);
  const task = await insertTask(db, owner, "Back to backlog");
  await sprints.addTasksToSprint(db, owner, sprint.id, [task]);
  await sprints.startSprint(db, owner, sprint.id);

  await sprints.completeSprint(db, owner, sprint.id);
  assert.deepEqual(await openRows(db, owner), []);

  const another = await sprints.createSprint(db, owner, dates);
  assert.equal((await sprints.addTasksToSprint(db, owner, another.id, [task])).sprint.task_count, 1);
});

test("losing access hides tasks from a sprint without rewriting past counts", async () => {
  const sprints = await load("src/lib/sprints.js");
  const { db, member, project } = await seed();
  const past = await sprints.createSprint(db, member, dates);
  const finished = await insertTask(db, member, "Finished in project", { projectId: project });
  await sprints.addTasksToSprint(db, member, past.id, [finished]);
  await sprints.startSprint(db, member, past.id);
  await db.query("UPDATE tasks SET status = 'done' WHERE id = $1", [finished]);
  await sprints.completeSprint(db, member, past.id);

  const current = await sprints.createSprint(db, member, dates);
  const open = await insertTask(db, member, "Open in project", { projectId: project });
  const personal = await insertTask(db, member, "Personal");
  await sprints.addTasksToSprint(db, member, current.id, [open, personal]);
  await sprints.startSprint(db, member, current.id);
  assert.equal((await sprints.getSprint(db, member, current.id)).task_count, 2);

  await db.query("DELETE FROM project_members WHERE project_id = $1 AND user_id = $2", [project, member]);

  assert.equal((await sprints.getSprint(db, member, current.id)).task_count, 1);
  const history = await sprints.getSprintDetail(db, member, past.id);
  assert.equal(history.task_count, 1);
  assert.equal(history.done_count, 1);
  assert.deepEqual(history.tasks, [], "titles from the old project are no longer readable");

  const closed = await sprints.completeSprint(db, member, current.id);
  assert.equal(closed.sprint.task_count, 1);
});

test("deleting removes the record, never the tasks", async () => {
  const sprints = await load("src/lib/sprints.js");
  const { db, owner } = await seed();
  const sprint = await sprints.createSprint(db, owner, dates);
  const task = await insertTask(db, owner, "Survives");
  await sprints.addTasksToSprint(db, owner, sprint.id, [task]);

  assert.equal(await sprints.deleteSprint(db, owner, sprint.id), true);
  assert.deepEqual(await openRows(db, owner), []);
  assert.equal((await db.query("SELECT id FROM tasks WHERE id = $1", [task])).rows.length, 1);
});

test("tasks added after the start count as mid-sprint additions", async () => {
  const sprints = await load("src/lib/sprints.js");
  const { db, owner } = await seed();
  const sprint = await sprints.createSprint(db, owner, dates);
  await sprints.addTasksToSprint(db, owner, sprint.id, [await insertTask(db, owner, "Planned")]);
  await sprints.startSprint(db, owner, sprint.id);
  await delay(5);
  const result = await sprints.addTasksToSprint(db, owner, sprint.id, [await insertTask(db, owner, "Added later")]);
  assert.equal(result.sprint.task_count, 2);
  assert.equal(result.sprint.added_count, 1);
});

test("list order is active, then planned by date, then newest closed", async () => {
  const sprints = await load("src/lib/sprints.js");
  const { db, owner } = await seed();
  const make = (name, startDate) => sprints.createSprint(db, owner, { ...dates, name, startDate, endDate: "2027-01-31" });
  const old = await make("Old", "2026-01-01");
  await sprints.startSprint(db, owner, old.id);
  await sprints.completeSprint(db, owner, old.id);
  const recent = await make("Recent", "2026-02-01");
  await sprints.startSprint(db, owner, recent.id);
  await sprints.completeSprint(db, owner, recent.id);
  await make("Later", "2026-12-01");
  await make("Sooner", "2026-11-01");
  const active = await make("Active", "2026-10-01");
  await sprints.startSprint(db, owner, active.id);

  const names = (await sprints.listSprints(db, owner)).map((sprint) => sprint.name);
  assert.deepEqual(names, ["Active", "Sooner", "Later", "Recent", "Old"]);
});

test("sprint input is validated", async () => {
  const { validateSprintCreate, validateSprintUpdate, updateSprint, createSprint } = await load("src/lib/sprints.js");
  assert.match(validateSprintCreate({ ...dates, name: " " }).error, /Name/);
  assert.match(validateSprintCreate({ name: "A", endDate: "2026-11-15" }).error, /Start date/);
  assert.match(validateSprintCreate({ ...dates, startDate: "2026-02-30" }).error, /valid date/);
  assert.match(validateSprintCreate({ ...dates, startDate: "2026-11-16" }).error, /before the start/);
  assert.deepEqual(validateSprintCreate({ ...dates, name: "  A  ", goal: " " }).value, { ...dates, name: "A", goal: null });
  assert.deepEqual(validateSprintUpdate({ goal: null }).value, { goal: null });
  assert.deepEqual(validateSprintUpdate({}).value, {});

  const { db, owner } = await seed();
  const sprint = await createSprint(db, owner, { ...dates, goal: "Keep me" });
  const renamed = await updateSprint(db, owner, sprint.id, { name: "Renamed" });
  assert.equal(renamed.sprint.name, "Renamed");
  assert.equal(renamed.sprint.goal, "Keep me");
  assert.equal((await updateSprint(db, owner, sprint.id, { goal: null })).sprint.goal, null);
  assert.equal((await updateSprint(db, owner, sprint.id, { endDate: "2026-11-01" })).status, 400);
  assert.equal((await updateSprint(db, owner, sprint.id, { startDate: "2026-11-20", endDate: "2026-11-30" })).sprint.end_date, "2026-11-30");
});

test("sprint dates don't shift and defaults follow the last open sprint", async () => {
  const {
    addDays, averageVelocity, daysBetween, formatSprintRange, nextSprintDefaults, sprintTimeStatus,
  } = await load("src/lib/sprintDates.js");

  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(daysBetween("2026-10-31", "2026-11-13"), 13);
  assert.equal(formatSprintRange("2026-10-31", "2026-11-13"), "Oct 31 – Nov 13");

  const active = { status: "active", start_date: "2026-10-20", end_date: "2026-11-02" };
  assert.deepEqual(sprintTimeStatus(active, "2026-11-01"), { label: "1 day left", overdue: false });
  assert.deepEqual(sprintTimeStatus(active, "2026-11-02"), { label: "Ends today", overdue: false });
  assert.deepEqual(sprintTimeStatus(active, "2026-11-04"), { label: "Ended 2 days ago", overdue: true });
  const planned = { status: "planned", start_date: "2026-11-05", end_date: "2026-11-18" };
  assert.equal(sprintTimeStatus(planned, "2026-11-01").label, "Starts in 4 days");
  assert.equal(sprintTimeStatus(planned, "2026-11-05").label, "Ready to start");

  assert.deepEqual(nextSprintDefaults([], "2026-10-31"), {
    name: "Sprint 1", goal: "", startDate: "2026-10-31", endDate: "2026-11-13",
  });
  const withOpen = nextSprintDefaults([active, planned, { status: "completed", end_date: "2027-06-01" }], "2026-10-31");
  assert.equal(withOpen.name, "Sprint 4");
  assert.equal(withOpen.startDate, "2026-11-19");
  assert.equal(nextSprintDefaults([active], "2026-11-20").startDate, "2026-11-20");

  assert.equal(averageVelocity([]), null);
  assert.equal(averageVelocity([{ done_count: 5 }, { done_count: 4 }, { done_count: 4 }, { done_count: 100 }]), 4.3);
});

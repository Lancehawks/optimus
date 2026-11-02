const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { createSchemaDatabase } = require("./helpers/schema-database.cjs");

const root = path.resolve(__dirname, "..");
const load = (relativePath) => import(path.join(root, relativePath));
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("hours and minutes convert to one stored number and back", async () => {
  const { cleanEstimateInput, estimateToMinutes, formatEstimate, minutesToEstimate } = await load("src/lib/taskEstimate.js");

  assert.equal(estimateToMinutes("1", "30"), 90);
  assert.equal(estimateToMinutes("", "45"), 45);
  assert.equal(estimateToMinutes("2", ""), 120);
  assert.equal(estimateToMinutes("", "90"), 90);
  assert.equal(estimateToMinutes("", ""), null);
  assert.equal(estimateToMinutes("0", "0"), null);

  assert.deepEqual(minutesToEstimate(90), { hours: "1", minutes: "30" });
  assert.deepEqual(minutesToEstimate(120), { hours: "2", minutes: "" });
  assert.deepEqual(minutesToEstimate(45), { hours: "", minutes: "45" });
  assert.deepEqual(minutesToEstimate(null), { hours: "", minutes: "" });

  assert.equal(formatEstimate(90), "1h 30m");
  assert.equal(formatEstimate(120), "2h");
  assert.equal(formatEstimate(45), "45m");
  assert.equal(formatEstimate(null), "");

  assert.equal(cleanEstimateInput("1a-2.5"), "125");
  assert.equal(cleanEstimateInput("12345"), "123");
});

test("the estimate validator allows clearing but rejects bad values", async () => {
  const { optionalInteger } = await load("src/lib/apiValidation.js");
  const check = (value) => optionalInteger(value, "Time estimate", { min: 1, max: 60000, allowNull: true });

  assert.deepEqual(check(undefined), { provided: false });
  assert.deepEqual(check(null), { provided: true, value: null });
  assert.deepEqual(check(90), { provided: true, value: 90 });
  for (const bad of [0, -5, 60001, 1.5, "90", true]) assert.ok(check(bad).error, String(bad));
  // Other integer fields still refuse null.
  assert.ok(optionalInteger(null, "Position", { min: 0 }).error);
});

test("task routes read and write the estimate", () => {
  const create = read("src/app/api/tasks/route.js");
  const update = read("src/app/api/tasks/[id]/route.js");

  assert.match(create, /recurrence_rule, estimated_minutes\)/);
  assert.match(create, /\$9, \$10\)/);
  assert.match(update, /estimated_minutes = \$\$\{paramIndex\+\+\}/);
});

test("the column is optional and bounded, and repeats keep the estimate", async () => {
  const { createNextRecurringTask } = await load("src/lib/taskRecurrence.js");
  const db = await createSchemaDatabase();
  try {
    const { rows: [user] } = await db.query(
      "INSERT INTO users (email, password_hash, full_name) VALUES ('estimate@example.test', 'x', 'Estimate') RETURNING id"
    );
    const insert = (minutes, rule = null) => db.query(
      "INSERT INTO tasks (user_id, title, estimated_minutes, recurrence_rule, due_date) VALUES ($1, 'Task', $2, $3, NOW()) RETURNING *",
      [user.id, minutes, rule]
    );

    assert.equal((await insert(null)).rows[0].estimated_minutes, null);
    assert.equal((await insert(60000)).rows[0].estimated_minutes, 60000);
    await assert.rejects(insert(0));
    await assert.rejects(insert(60001));

    const source = (await insert(90, "daily")).rows[0];
    const next = await createNextRecurringTask(db, source);
    assert.equal(next.estimated_minutes, 90);

    const plain = (await insert(null, "daily")).rows[0];
    assert.equal((await createNextRecurringTask(db, plain)).estimated_minutes, null);
  } finally {
    await db.close();
  }
});

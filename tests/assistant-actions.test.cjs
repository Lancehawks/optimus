const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { createSchemaDatabase } = require("./helpers/schema-database.cjs");

const root = path.resolve(__dirname, "..");
const load = (relativePath) => import(path.join(root, relativePath));

const NOW = new Date("2026-10-22T09:30:00Z"); // 15:00 in Asia/Kolkata
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
  return { db, owner, member, outsider, project, conversations, model, store };
}

function context(seed, who, extra = {}) {
  return {
    db: seed.db,
    userId: seed[who],
    timeZone: TIME_ZONE,
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

async function count(db, table) {
  return (await db.query(`SELECT COUNT(*)::int AS n FROM ${table}`)).rows[0].n;
}

function fieldValue(card, label) {
  return card.fields.find((field) => field.label === label)?.value;
}

test("a proposed task changes nothing until confirmed, and confirming twice creates one", async () => {
  const seed = await setup();
  try {
    const { decideAction } = await load("src/lib/assistant/actions.js");
    const proposal = await propose(seed, "owner", "create_task", {
      title: "Call the bank", due_date: "2026-10-23", priority: "high",
    });

    assert.equal(proposal.isError, false);
    assert.equal(proposal.output.status, "awaiting_confirmation");
    assert.equal(proposal.output.action, undefined, "the card is for the member, not the model");
    assert.equal(await count(seed.db, "tasks"), 0);
    assert.equal(proposal.action.status, "pending");
    assert.equal(fieldValue(proposal.action.card, "Due"), "Fri 2026-10-23");
    assert.equal(fieldValue(proposal.action.card, "Priority"), "High");

    const ctx = context(seed, "owner");
    const applied = await decideAction(ctx, proposal.action.id, "confirm");
    assert.equal(applied.status, "applied");
    assert.match(applied.result.href, /^\/tasks\?task_id=/);

    const again = await decideAction(ctx, proposal.action.id, "confirm");
    assert.equal(again.status, "applied");
    assert.equal(await count(seed.db, "tasks"), 1, "a second click must not create a second task");

    // The due day reads the same to the assistant and in the task list.
    const { runTool } = await load("src/lib/assistant/tools.js");
    const found = await runTool(ctx, "search_tasks", { text: "bank" });
    assert.equal(found.output.tasks[0].due, "Fri 2026-10-23");
    const stored = (await seed.db.query("SELECT due_date FROM tasks")).rows[0].due_date;
    assert.equal(new Date(stored).toISOString().split("T")[0], "2026-10-23");
  } finally {
    await seed.db.close();
  }
});

test("two simultaneous confirmations apply a change once", async () => {
  const seed = await setup();
  try {
    const { decideAction } = await load("src/lib/assistant/actions.js");
    const proposal = await propose(seed, "owner", "create_task", { title: "Once only" });
    const ctx = context(seed, "owner");
    await Promise.all([1, 2, 3].map(() => decideAction(ctx, proposal.action.id, "confirm")));
    assert.equal(await count(seed.db, "tasks"), 1);
  } finally {
    await seed.db.close();
  }
});

test("cancelling leaves the workspace alone, and a cancelled proposal can't be confirmed", async () => {
  const seed = await setup();
  try {
    const { decideAction } = await load("src/lib/assistant/actions.js");
    const proposal = await propose(seed, "owner", "create_task", { title: "Never mind" });
    const ctx = context(seed, "owner");
    assert.equal((await decideAction(ctx, proposal.action.id, "cancel")).status, "cancelled");
    assert.equal((await decideAction(ctx, proposal.action.id, "confirm")).status, "cancelled");
    assert.equal(await count(seed.db, "tasks"), 0);
  } finally {
    await seed.db.close();
  }
});

test("only the member a proposal belongs to can decide it", async () => {
  const seed = await setup();
  try {
    const { decideAction } = await load("src/lib/assistant/actions.js");
    const proposal = await propose(seed, "owner", "create_task", { title: "Mine" });
    assert.equal(await decideAction(context(seed, "member"), proposal.action.id, "confirm"), null);
    assert.equal(await decideAction(context(seed, "outsider"), proposal.action.id, "cancel"), null);
    assert.equal(await count(seed.db, "tasks"), 0);
    const row = (await seed.db.query("SELECT status FROM ai_actions WHERE id = $1", [proposal.action.id])).rows[0];
    assert.equal(row.status, "pending");
  } finally {
    await seed.db.close();
  }
});

test("proposals follow the same permissions as the rest of Optimus", async () => {
  const seed = await setup();
  try {
    const ownerTask = (await seed.db.query(
      "INSERT INTO tasks (user_id, project_id, title) VALUES ($1, $2, 'Owner project task') RETURNING id", [seed.owner, seed.project]
    )).rows[0].id;
    const privateTask = (await seed.db.query("INSERT INTO tasks (user_id, title) VALUES ($1, 'Private') RETURNING id", [seed.owner])).rows[0].id;
    const ownerNote = (await seed.db.query(
      "INSERT INTO notes (user_id, project_id, title, content) VALUES ($1, $2, 'Plan', '<p>x</p>') RETURNING id", [seed.owner, seed.project]
    )).rows[0].id;

    for (const [who, tool, input, message] of [
      ["outsider", "create_task", { title: "x", project_id: seed.project }, /No project/],
      ["outsider", "create_note", { title: "x", text: "y", project_id: seed.project }, /No project/],
      ["outsider", "create_event", { title: "x", start: "2026-10-23T10:00", end: "2026-10-23T11:00", project_id: seed.project }, /No project/],
      ["outsider", "update_task", { task_id: privateTask, status: "done" }, /No task/],
      ["outsider", "append_to_note", { note_id: ownerNote, text: "y" }, /No note/],
      // A project member can see a teammate's items but can't edit them.
      ["member", "update_task", { task_id: ownerTask, status: "done" }, /Only the task creator/],
      ["member", "append_to_note", { note_id: ownerNote, text: "y" }, /Only the note creator/],
      ["member", "update_task", { task_id: privateTask, status: "done" }, /No task/],
    ]) {
      const result = await propose(seed, who, tool, input);
      assert.equal(result.isError, true, `${who} ${tool} should be refused`);
      assert.match(result.output.error, message);
    }
    assert.equal(await count(seed.db, "ai_actions"), 0);

    // The project owner can edit a member's task, as in the task route.
    const memberTask = (await seed.db.query(
      "INSERT INTO tasks (user_id, project_id, title) VALUES ($1, $2, 'Member task') RETURNING id", [seed.member, seed.project]
    )).rows[0].id;
    assert.equal((await propose(seed, "owner", "update_task", { task_id: memberTask, priority: "urgent" })).isError, false);
  } finally {
    await seed.db.close();
  }
});

test("permissions are checked again when the member confirms", async () => {
  const seed = await setup();
  try {
    const { decideAction } = await load("src/lib/assistant/actions.js");
    const proposal = await propose(seed, "member", "create_task", { title: "Shared work", project_id: seed.project });
    assert.match(proposal.action.card.notice, /Everyone in Launch/);
    await seed.db.query("DELETE FROM project_members WHERE project_id = $1 AND user_id = $2", [seed.project, seed.member]);

    const decided = await decideAction(context(seed, "member"), proposal.action.id, "confirm");
    assert.equal(decided.status, "failed");
    assert.match(decided.result.error, /No project/);
    assert.equal(await count(seed.db, "tasks"), 0);
  } finally {
    await seed.db.close();
  }
});

test("project changes leave an activity record, and unexpected failures don't leak details", async () => {
  const seed = await setup();
  try {
    const { decideAction } = await load("src/lib/assistant/actions.js");
    const proposal = await propose(seed, "owner", "create_task", { title: "Announce it", project_id: seed.project });
    await decideAction(context(seed, "owner"), proposal.action.id, "confirm");
    const activity = await seed.db.query("SELECT action, entity_type, entity_title, actor_user_id FROM project_activity");
    assert.deepEqual(activity.rows, [{ action: "created", entity_type: "task", entity_title: "Announce it", actor_user_id: seed.owner }]);

    // The task and its activity record go together.
    const logged = [];
    const second = await propose(seed, "owner", "create_task", { title: "Rolled back", project_id: seed.project });
    const failing = context(seed, "owner", {
      recordActivity: async () => { throw new Error("connection string with secrets"); },
      onError: (error) => logged.push(error.message),
    });
    const decided = await decideAction(failing, second.action.id, "confirm");
    assert.equal(decided.status, "failed");
    assert.doesNotMatch(decided.result.error, /secrets/);
    assert.deepEqual(logged, ["connection string with secrets"]);
    const titles = (await seed.db.query("SELECT title FROM tasks")).rows.map((row) => row.title);
    assert.deepEqual(titles, ["Announce it"]);
  } finally {
    await seed.db.close();
  }
});

test("completing a repeating task through a proposal creates the next one", async () => {
  const seed = await setup();
  try {
    const { decideAction } = await load("src/lib/assistant/actions.js");
    const task = (await seed.db.query(
      "INSERT INTO tasks (user_id, title, recurrence_rule, due_date) VALUES ($1, 'Water plants', 'weekly', '2026-10-22T06:30:00Z') RETURNING id",
      [seed.owner]
    )).rows[0].id;

    const proposal = await propose(seed, "owner", "update_task", { task_id: task, status: "done" });
    assert.equal(fieldValue(proposal.action.card, "Status"), "To do → Done");
    assert.match(proposal.action.card.notice, /repeats/);

    assert.equal((await decideAction(context(seed, "owner"), proposal.action.id, "confirm")).status, "applied");
    const rows = (await seed.db.query("SELECT status, due_date FROM tasks ORDER BY created_at, status")).rows;
    assert.deepEqual(rows.map((row) => row.status).sort(), ["done", "todo"]);

    // No change at all isn't worth a card.
    const again = await propose(seed, "owner", "update_task", { task_id: task, status: "done" });
    assert.equal(again.isError, true);
    assert.match(again.output.error, /wouldn't change/);
  } finally {
    await seed.db.close();
  }
});

test("rescheduling and clearing a due date", async () => {
  const seed = await setup();
  try {
    const { decideAction } = await load("src/lib/assistant/actions.js");
    const task = (await seed.db.query(
      "INSERT INTO tasks (user_id, title, due_date) VALUES ($1, 'Pay rent', '2026-10-22T06:30:00Z') RETURNING id", [seed.owner]
    )).rows[0].id;
    const ctx = context(seed, "owner");

    const moved = await propose(seed, "owner", "update_task", { task_id: task, due_date: "2026-10-25" });
    assert.equal(fieldValue(moved.action.card, "Due"), "Thu 2026-10-22 → Sun 2026-10-25");
    await decideAction(ctx, moved.action.id, "confirm");
    const local = await seed.db.query("SELECT to_char((due_date AT TIME ZONE $1)::date, 'YYYY-MM-DD') AS day FROM tasks", [TIME_ZONE]);
    assert.equal(local.rows[0].day, "2026-10-25");

    const cleared = await propose(seed, "owner", "update_task", { task_id: task, clear_due_date: true });
    await decideAction(ctx, cleared.action.id, "confirm");
    assert.equal((await seed.db.query("SELECT due_date FROM tasks")).rows[0].due_date, null);

    const both = await propose(seed, "owner", "update_task", { task_id: task, due_date: "2026-10-25", clear_due_date: true });
    assert.equal(both.isError, true);
  } finally {
    await seed.db.close();
  }
});

test("note text is stored as escaped HTML and matching editor blocks", async () => {
  const { textToNote, withoutTrailingBlanks } = await load("src/lib/assistant/noteText.js");
  let next = 0;
  const { html, blocks } = textToNote(
    "# Plan\nFirst **bold** <script>alert(1)</script>\n\n- one\n- two\n- [x] done\n- [ ] open\n1. first\nend & done",
    () => `b${next++}`
  );
  assert.equal(
    html,
    "<h1>Plan</h1>"
    + "<p>First <strong>bold</strong> &lt;script&gt;alert(1)&lt;/script&gt;</p>"
    + "<ul><li>one</li><li>two</li><li><input type=\"checkbox\" checked>done</li><li><input type=\"checkbox\">open</li></ul>"
    + "<ol><li>first</li></ol>"
    + "<p>end &amp; done</p>"
  );
  assert.deepEqual(blocks.map((block) => block.type), [
    "heading", "paragraph", "bulletListItem", "bulletListItem", "checkListItem", "checkListItem", "numberedListItem", "paragraph",
  ]);
  assert.deepEqual(blocks[0], { id: "b0", type: "heading", props: { level: 1 }, content: [{ type: "text", text: "Plan", styles: {} }], children: [] });
  assert.deepEqual(blocks[1].content, [
    { type: "text", text: "First ", styles: {} },
    { type: "text", text: "bold", styles: { bold: true } },
    { type: "text", text: " <script>alert(1)</script>", styles: {} },
  ]);
  assert.equal(blocks[4].props.checked, true);
  assert.equal(blocks[5].props.checked, false);

  const keep = { type: "paragraph", content: [{ type: "text", text: "x", styles: {} }], children: [] };
  assert.deepEqual(
    withoutTrailingBlanks([keep, { type: "paragraph", content: [], children: [] }, { type: "paragraph", content: [], children: [] }]),
    [keep]
  );
});

test("creating a note and writing a journal entry", async () => {
  const seed = await setup();
  try {
    const { decideAction } = await load("src/lib/assistant/actions.js");
    const { runTool } = await load("src/lib/assistant/tools.js");
    const ctx = context(seed, "owner");

    const proposal = await propose(seed, "owner", "create_note", { title: "Ideas", text: "- one\n- two" });
    assert.equal(proposal.action.card.body.text, "- one\n- two", "the card shows the whole text");
    const applied = await decideAction(ctx, proposal.action.id, "confirm");
    assert.match(applied.result.href, /^\/notes\?note_id=/);
    const note = (await seed.db.query("SELECT * FROM notes WHERE title = 'Ideas'")).rows[0];
    assert.equal(note.content, "<ul><li>one</li><li>two</li></ul>");
    assert.equal(note.content_blocks.length, 2);
    assert.equal(note.updated_by, seed.owner);
    assert.equal(note.is_journal, false);
    const read = await runTool(ctx, "read_note", { note_id: note.id });
    assert.equal(read.output.text, "- one\n- two");

    assert.equal((await propose(seed, "owner", "create_note", { text: "no title" })).isError, true);

    const entry = await propose(seed, "owner", "create_note", { journal_date: "2026-10-22", text: "A good day" });
    assert.equal(fieldValue(entry.action.card, "Title"), "Journal — Thursday, October 22, 2026");
    await decideAction(ctx, entry.action.id, "confirm");
    const journal = await runTool(ctx, "search_notes", { journal_date: "2026-10-22" });
    assert.equal(journal.output.notes.length, 1);

    const duplicate = await propose(seed, "owner", "create_note", { journal_date: "2026-10-22", text: "Again" });
    assert.equal(duplicate.isError, true);
    assert.match(duplicate.output.error, /append_to_note/);
    const inProject = await propose(seed, "owner", "create_note", { journal_date: "2026-10-23", text: "x", project_id: seed.project });
    assert.equal(inProject.isError, true);
  } finally {
    await seed.db.close();
  }
});

test("adding to a note keeps what's there, its blocks and a version to restore", async () => {
  const seed = await setup();
  try {
    const { decideAction } = await load("src/lib/assistant/actions.js");
    const ctx = context(seed, "owner");
    const existingBlocks = [
      { id: "a", type: "paragraph", props: {}, content: [{ type: "text", text: "Keep me", styles: {} }], children: [] },
      { id: "w", type: "whiteboard", props: { id: "custom" }, content: undefined, children: [] },
      { id: "z", type: "paragraph", props: {}, content: [], children: [] },
    ];
    const note = (await seed.db.query(
      `INSERT INTO notes (user_id, title, content, content_blocks, revision, updated_by)
       VALUES ($1, 'Log', '<p>Keep me</p>', $2::jsonb, 3, $1) RETURNING id`,
      [seed.owner, JSON.stringify(existingBlocks)]
    )).rows[0].id;

    const proposal = await propose(seed, "owner", "append_to_note", { note_id: note, text: "New <line>" });
    assert.equal(fieldValue(proposal.action.card, "Note"), "Log");
    assert.equal((await seed.db.query("SELECT revision FROM notes WHERE id = $1", [note])).rows[0].revision, 3);

    assert.equal((await decideAction(ctx, proposal.action.id, "confirm")).status, "applied");
    const after = (await seed.db.query("SELECT * FROM notes WHERE id = $1", [note])).rows[0];
    assert.equal(after.content, "<p>Keep me</p><p>New &lt;line&gt;</p>");
    assert.equal(after.revision, 4, "an open editor sees the change as a conflict rather than overwriting it");
    assert.deepEqual(after.content_blocks.map((block) => block.id).slice(0, 2), ["a", "w"]);
    assert.equal(after.content_blocks.length, 3, "the empty last block is replaced, not left as a gap");
    assert.equal(after.content_blocks[2].content[0].text, "New <line>");

    const versions = (await seed.db.query("SELECT revision, content FROM note_versions WHERE note_id = $1", [note])).rows;
    assert.deepEqual(versions, [{ revision: 3, content: "<p>Keep me</p>" }]);

    // A note that only has HTML stays that way: the editor builds blocks from it.
    const legacy = (await seed.db.query("INSERT INTO notes (user_id, title, content) VALUES ($1, 'Old', '<p>Old</p>') RETURNING id", [seed.owner])).rows[0].id;
    const second = await propose(seed, "owner", "append_to_note", { note_id: legacy, text: "More" });
    await decideAction(ctx, second.action.id, "confirm");
    const legacyAfter = (await seed.db.query("SELECT content, content_blocks FROM notes WHERE id = $1", [legacy])).rows[0];
    assert.equal(legacyAfter.content, "<p>Old</p><p>More</p>");
    assert.equal(legacyAfter.content_blocks, null);
  } finally {
    await seed.db.close();
  }
});

test("events go through the events service with instants in the member's timezone", async () => {
  const seed = await setup();
  try {
    const { decideAction } = await load("src/lib/assistant/actions.js");
    const calls = [];
    const createEvent = async ({ userId, body }) => {
      calls.push({ userId, body });
      return { event: { id: "e1" }, googleError: "Google Calendar sync failed" };
    };
    const ctx = context(seed, "owner", { createEvent });

    const timed = await propose(seed, "owner", "create_event", {
      title: "Dentist", start: "2026-10-23T15:00", end: "2026-10-23T16:00", location: "Main St",
    });
    assert.equal(fieldValue(timed.action.card, "When"), "Fri 2026-10-23, 15:00 to 16:00");
    assert.equal(calls.length, 0);
    const applied = await decideAction(ctx, timed.action.id, "confirm");
    assert.equal(applied.status, "applied");
    assert.equal(applied.result.warning, "Google Calendar sync failed", "the event is saved, and the member hears Google missed it");
    assert.deepEqual(calls[0], {
      userId: seed.owner,
      body: {
        title: "Dentist",
        description: null,
        location: "Main St",
        all_day: false,
        start_time: "2026-10-23T09:30:00.000Z",
        end_time: "2026-10-23T10:30:00.000Z",
        recurrence_rule: null,
        project_id: null,
      },
    });

    const allDay = await propose(seed, "owner", "create_event", { title: "Holiday", date: "2026-10-26", end_date: "2026-10-27", repeats: "weekly" });
    assert.equal(fieldValue(allDay.action.card, "When"), "Mon 2026-10-26 to Tue 2026-10-27, all day");
    await decideAction(ctx, allDay.action.id, "confirm");
    assert.equal(calls[1].body.all_day, true);
    assert.equal(calls[1].body.start_time, "2026-10-26T00:00:00.000Z");
    assert.equal(calls[1].body.end_time, "2026-10-28T00:00:00.000Z");
    assert.equal(calls[1].body.recurrence_rule, "weekly");

    for (const input of [
      { title: "x" },
      { title: "x", start: "2026-10-23T15:00" },
      { title: "x", start: "2026-10-23T16:00", end: "2026-10-23T15:00" },
      { title: "x", start: "2026-10-23T25:00", end: "2026-10-23T26:00" },
      { title: "x", start: "tomorrow at 3", end: "2026-10-23T26:00" },
      { title: "x", date: "2026-10-23", start: "2026-10-23T15:00", end: "2026-10-23T16:00" },
      { title: "x", date: "2026-10-23", end_date: "2026-10-22" },
      { title: "x", start: "2026-10-23T15:00", end: "2026-10-23T16:00", end_date: "2026-10-24" },
    ]) {
      assert.equal((await propose(seed, "owner", "create_event", input)).isError, true, JSON.stringify(input));
    }

    // Expected refusals from the events service reach the member as written.
    const refused = await propose(seed, "owner", "create_event", { title: "x", date: "2026-10-30" });
    const failing = context(seed, "owner", {
      createEvent: async () => { throw Object.assign(new Error("Project not found"), { status: 404 }); },
    });
    assert.deepEqual((await decideAction(failing, refused.action.id, "confirm")).result, { error: "Project not found" });
  } finally {
    await seed.db.close();
  }
});

test("an event linked to a task must use one the member can see, in the same project", async () => {
  const seed = await setup();
  try {
    const hidden = (await seed.db.query("INSERT INTO tasks (user_id, title) VALUES ($1, 'Hidden') RETURNING id", [seed.member])).rows[0].id;
    const mine = (await seed.db.query("INSERT INTO tasks (user_id, title) VALUES ($1, 'Write report') RETURNING id", [seed.owner])).rows[0].id;
    const when = { start: "2026-10-23T15:00", end: "2026-10-23T16:00" };

    assert.equal((await propose(seed, "owner", "create_event", { title: "x", ...when, task_id: hidden })).isError, true);
    const mixed = await propose(seed, "owner", "create_event", { title: "x", ...when, task_id: mine, project_id: seed.project });
    assert.equal(mixed.isError, true);
    assert.match(mixed.output.error, /same project|that project/);
    const linked = await propose(seed, "owner", "create_event", { title: "Focus", ...when, task_id: mine });
    assert.equal(fieldValue(linked.action.card, "For task"), "Write report");
  } finally {
    await seed.db.close();
  }
});

test("too many waiting proposals are refused", async () => {
  const seed = await setup();
  try {
    for (let index = 0; index < 20; index += 1) {
      assert.equal((await propose(seed, "owner", "create_task", { title: `t${index}` })).isError, false);
    }
    const refused = await propose(seed, "owner", "create_task", { title: "one too many" });
    assert.equal(refused.isError, true);
    assert.match(refused.output.error, /Too many/);
  } finally {
    await seed.db.close();
  }
});

function scriptedProvider(turns) {
  const histories = [];
  return {
    histories,
    async *streamTurn({ history }) {
      histories.push(JSON.parse(JSON.stringify(history)));
      const turn = turns.shift();
      if (turn.text) yield { type: "text", text: turn.text };
      yield { type: "turn", turn };
    },
  };
}

const usage = { inputTokens: 10, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 };

function proposeTurn(input) {
  return {
    text: "",
    toolCalls: [{ id: "toolu_1", name: "create_task", input }],
    payload: { content: [{ type: "tool_use", id: "toolu_1", name: "create_task", input }] },
    stopReason: "tool_calls",
    usage,
  };
}

function endTurn(text) {
  return { text, toolCalls: [], payload: { content: [{ type: "text", text }] }, stopReason: "end", usage };
}

async function collect(generator) {
  const events = [];
  for await (const event of generator) events.push(event);
  return events;
}

test("the loop shows proposals, keeps them out of the model's input and reports the outcome next message", async () => {
  const seed = await setup();
  try {
    const { answerMessage } = await load("src/lib/assistant/agent.js");
    const { decideAction, listActions } = await load("src/lib/assistant/actions.js");
    const conversationId = seed.conversations.owner;
    const turnParams = {
      db: seed.db,
      model: seed.model,
      conversationId,
      userId: seed.owner,
      timeZone: TIME_ZONE,
      now: NOW,
      listEvents: async () => [],
    };

    const first = scriptedProvider([proposeTurn({ title: "Call the bank" }), endTurn("Drafted it, confirm below.")]);
    const events = await collect(answerMessage({ ...turnParams, provider: first, history: [], text: "Add a task to call the bank" }));

    const shown = events.find((event) => event.type === "action");
    assert.equal(shown.action.status, "pending");
    assert.equal(fieldValue(shown.action.card, "Title"), "Call the bank");
    assert.deepEqual(events.find((event) => event.type === "status"), { type: "status", label: "Drafting a task" });
    assert.equal(await count(seed.db, "tasks"), 0);

    const toolOutput = first.histories[1].at(-1).payload.results[0].output;
    assert.equal(toolOutput.status, "awaiting_confirmation");
    assert.equal(toolOutput.action, undefined);
    assert.equal(first.histories[0][0].payload.context.includes("proposals"), false, "nothing to report yet");

    // The panel gets the card back when the conversation is reopened.
    let history = await seed.store.loadHistory(seed.db, conversationId);
    let display = seed.store.displayMessages(history, await listActions(seed.db, conversationId));
    assert.deepEqual(display.map((message) => message.role), ["user", "assistant"]);
    assert.equal(display[1].text, "Drafted it, confirm below.");
    assert.equal(display[1].actions[0].id, shown.action.id);

    // Still undecided: the model hears it's waiting, so it doesn't propose it again.
    const second = scriptedProvider([endTurn("It's waiting for you.")]);
    await collect(answerMessage({ ...turnParams, provider: second, history, text: "Did you add it?" }));
    assert.match(second.histories[0].at(-1).payload.context, /create_task: still waiting/);

    // Confirmed: the next message reports it exactly once, with its id and link.
    const applied = await decideAction(context(seed, "owner"), shown.action.id, "confirm");
    history = await seed.store.loadHistory(seed.db, conversationId);
    const third = scriptedProvider([endTurn("Done, it's added.")]);
    await collect(answerMessage({ ...turnParams, provider: third, history, text: "Did you add it now?" }));
    const note = third.histories[0].at(-1).payload.context;
    assert.match(note, /create_task: the member confirmed it and it's done/);
    assert.ok(note.includes(applied.result.href));
    assert.equal(note.includes("Call the bank"), false, "a proposal's text never reaches the system-level note");

    history = await seed.store.loadHistory(seed.db, conversationId);
    const fourth = scriptedProvider([endTurn("Anything else?")]);
    await collect(answerMessage({ ...turnParams, provider: fourth, history, text: "Thanks" }));
    assert.equal(fourth.histories[0].at(-1).payload.context.includes("create_task"), false);

    // Earlier context notes are stored, so the replayed conversation never changes.
    const stored = await seed.store.loadHistory(seed.db, conversationId);
    assert.match(stored.filter((row) => row.kind === "input")[2].payload.context, /confirmed it and it's done/);

    display = seed.store.displayMessages(stored, await listActions(seed.db, conversationId));
    assert.equal(display[1].actions[0].status, "applied");
  } finally {
    await seed.db.close();
  }
});

test("a reply that only proposes something still appears, and deleting the conversation removes its proposals", async () => {
  const seed = await setup();
  try {
    const { answerMessage, PROPOSED_NOTICE } = await load("src/lib/assistant/agent.js");
    const { listActions } = await load("src/lib/assistant/actions.js");
    const conversationId = seed.conversations.owner;
    const provider = scriptedProvider([proposeTurn({ title: "Quiet" }), endTurn("")]);
    await collect(answerMessage({
      db: seed.db, model: seed.model, provider, conversationId, history: [], userId: seed.owner,
      timeZone: TIME_ZONE, now: NOW, text: "Add it", listEvents: async () => [],
    }));
    const history = await seed.store.loadHistory(seed.db, conversationId);
    const [, reply] = seed.store.displayMessages(history, await listActions(seed.db, conversationId));
    assert.equal(reply.actions.length, 1);
    assert.equal(reply.text, PROPOSED_NOTICE);
    assert.equal(reply.model, "Claude Haiku 5.5");

    assert.equal(await seed.store.deleteConversation(seed.db, seed.owner, conversationId), true);
    assert.equal(await count(seed.db, "ai_actions"), 0);
  } finally {
    await seed.db.close();
  }
});

test("the write tools are offered to models and refuse input that doesn't validate", async () => {
  const { toolDefinitions, runTool } = await load("src/lib/assistant/tools.js");
  const names = toolDefinitions().map((tool) => tool.name);
  for (const name of ["create_task", "update_task", "create_note", "append_to_note", "create_event"]) {
    assert.ok(names.includes(name), name);
  }
  const untouched = { db: { query: () => { throw new Error("must not query"); } }, userId: "u", timeZone: "UTC" };
  for (const [name, input] of [
    ["create_task", {}],
    ["create_task", { title: "   " }],
    ["create_task", { title: "x", priority: "whenever" }],
    ["create_task", { title: "x", due_date: "2026-02-30" }],
    ["create_task", { title: "x", user_id: "someone-else" }],
    ["update_task", { task_id: "not-an-id", status: "done" }],
    ["append_to_note", { note_id: "not-an-id", text: "x" }],
    ["create_note", { title: "x" }],
    ["create_event", { title: "x", start: "next tuesday", end: "2026-10-23T16:00" }],
  ]) {
    const result = await runTool(untouched, name, input);
    assert.equal(result.isError, true, `${name} ${JSON.stringify(input)} should be rejected`);
  }
});

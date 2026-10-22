const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { createSchemaDatabase } = require("./helpers/schema-database.cjs");

const root = path.resolve(__dirname, "..");
const load = (relativePath) => import(path.join(root, relativePath));

const TODAY = "2026-10-22";
const NOW = new Date("2026-10-22T09:30:00Z"); // 15:00 in Asia/Kolkata
const TIME_ZONE = "Asia/Kolkata";

async function insertUser(db, email, name) {
  const result = await db.query(
    "INSERT INTO users (email, password_hash, full_name, timezone) VALUES ($1, 'x', $2, $3) RETURNING id",
    [email, name, TIME_ZONE]
  );
  return result.rows[0].id;
}

async function insertTask(db, fields) {
  const result = await db.query(
    `INSERT INTO tasks (user_id, project_id, title, description, status, priority, due_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [
      fields.userId,
      fields.projectId || null,
      fields.title,
      fields.description || null,
      fields.status || "todo",
      fields.priority || "medium",
      fields.due || null,
    ]
  );
  return result.rows[0].id;
}

// owner and member share a project; outsider shares nothing.
async function seedWorkspace(db) {
  const owner = await insertUser(db, "owner@example.com", "Asha Owner");
  const member = await insertUser(db, "member@example.com", "Mo Member");
  const outsider = await insertUser(db, "outsider@example.com", "Oz Outsider");
  const project = (await db.query(
    "INSERT INTO projects (user_id, name, status) VALUES ($1, 'Launch', 'active') RETURNING id",
    [owner]
  )).rows[0].id;
  await db.query("INSERT INTO project_members (project_id, user_id) VALUES ($1, $2)", [project, member]);

  const tasks = {
    // 02:30 on the 22nd in Kolkata, still the 21st in UTC.
    personalDueToday: await insertTask(db, { userId: owner, title: "Renew passport", due: "2026-10-21T21:00:00Z", priority: "high" }),
    // 01:30 on the 23rd in Kolkata, still the 22nd in UTC: due tomorrow, not today.
    personalDueTomorrow: await insertTask(db, { userId: owner, title: "Call the bank", due: "2026-10-22T20:00:00Z" }),
    overdue: await insertTask(db, { userId: owner, title: "File expenses", due: "2026-10-19T06:00:00Z" }),
    inProgress: await insertTask(db, { userId: owner, title: "Write chapter two", status: "in_progress" }),
    sharedDueToday: await insertTask(db, { userId: member, projectId: project, title: "Ship landing page", due: "2026-10-22T06:00:00Z" }),
    outsiderTask: await insertTask(db, { userId: outsider, title: "Outsider secret task", due: "2026-10-22T06:00:00Z" }),
    memberPrivate: await insertTask(db, { userId: member, title: "Member private errand", due: "2026-10-22T06:00:00Z" }),
  };

  const notes = {
    ownerPrivate: (await db.query(
      "INSERT INTO notes (user_id, title, content) VALUES ($1, 'Passport plan', '<p>Bring <strong>two</strong> photos &amp; the old passport.</p>') RETURNING id",
      [owner]
    )).rows[0].id,
    shared: (await db.query(
      "INSERT INTO notes (user_id, project_id, title, content) VALUES ($1, $2, 'Launch checklist', '<ul><li>Press kit</li><li>Pricing page</li></ul>') RETURNING id",
      [member, project]
    )).rows[0].id,
    outsider: (await db.query(
      "INSERT INTO notes (user_id, title, content) VALUES ($1, 'Outsider diary', '<p>passport musings</p>') RETURNING id",
      [outsider]
    )).rows[0].id,
  };

  const section = (await db.query(
    "INSERT INTO checklist_sections (user_id, name) VALUES ($1, 'Morning') RETURNING id",
    [owner]
  )).rows[0].id;
  const stretch = (await db.query(
    "INSERT INTO checklist_items (section_id, name, position) VALUES ($1, 'Stretch', 0) RETURNING id",
    [section]
  )).rows[0].id;
  await db.query("INSERT INTO checklist_items (section_id, name, position) VALUES ($1, 'Read', 1)", [section]);
  await db.query("INSERT INTO checklist_logs (item_id, log_date, completed) VALUES ($1, $2, TRUE)", [stretch, TODAY]);
  await db.query(
    "INSERT INTO day_plan_blocks (user_id, title, start_time, end_time, position) VALUES ($1, 'Deep work', '09:00', '11:00', 0)",
    [owner]
  );

  return { owner, member, outsider, project, tasks, notes };
}

function toolContext(db, userId, events = []) {
  return {
    db,
    userId,
    timeZone: TIME_ZONE,
    today: TODAY,
    listEvents: async () => events,
  };
}

function idsIn(value) {
  return JSON.stringify(value);
}

test("assistant tools only return items the member can open in Optimus", async () => {
  const db = await createSchemaDatabase();
  try {
    const { runTool } = await load("src/lib/assistant/tools.js");
    const seed = await seedWorkspace(db);

    const asOutsider = toolContext(db, seed.outsider);
    const outsiderSearch = await runTool(asOutsider, "search_tasks", { status: "any" });
    assert.deepEqual(outsiderSearch.output.tasks.map((task) => task.title), ["Outsider secret task"]);
    for (const [tool, input] of [
      ["get_task", { task_id: seed.tasks.sharedDueToday }],
      ["get_project", { project_id: seed.project }],
      ["read_note", { note_id: seed.notes.ownerPrivate }],
      ["read_note", { note_id: seed.notes.shared }],
    ]) {
      const result = await runTool(asOutsider, tool, input);
      assert.equal(result.isError, true, `${tool} must not reveal another member's item`);
    }
    const outsiderProjects = await runTool(asOutsider, "list_projects", { status: "all" });
    assert.deepEqual(outsiderProjects.output.projects, []);
    const outsiderNotes = await runTool(asOutsider, "search_notes", { text: "passport" });
    assert.deepEqual(outsiderNotes.output.notes.map((note) => note.title), ["Outsider diary"]);
    const outsiderEverything = await runTool(asOutsider, "search_workspace", { text: "launch" });
    assert.deepEqual(outsiderEverything.output.results, []);

    // A project member sees shared project work but not the owner's personal items.
    const asMember = toolContext(db, seed.member);
    const memberTasks = await runTool(asMember, "search_tasks", { status: "any" });
    const memberTitles = memberTasks.output.tasks.map((task) => task.title).sort();
    assert.deepEqual(memberTitles, ["Member private errand", "Ship landing page"]);
    assert.equal((await runTool(asMember, "get_task", { task_id: seed.tasks.personalDueToday })).isError, true);
    const sharedNote = await runTool(asMember, "read_note", { note_id: seed.notes.shared });
    assert.equal(sharedNote.isError, false);
    assert.match(sharedNote.output.text, /- Press kit\n- Pricing page/);
    const project = await runTool(asMember, "get_project", { project_id: seed.project });
    assert.equal(project.output.shared_with_you, true);
    assert.deepEqual(project.output.members, ["Asha Owner", "Mo Member"]);
    assert.ok(!idsIn(project.output).includes("Renew passport"));

    const asOwner = toolContext(db, seed.owner);
    const ownerNote = await runTool(asOwner, "read_note", { note_id: seed.notes.ownerPrivate });
    assert.equal(ownerNote.output.text, "Bring two photos & the old passport.");
    const ownerEverything = await runTool(asOwner, "search_workspace", { text: "launch" });
    assert.ok(ownerEverything.output.results.some((result) => result.type === "Project" && result.title === "Launch"));
    assert.ok(ownerEverything.output.results.every((result) => result.href.startsWith("/")));
  } finally {
    await db.close();
  }
});

test("get_agenda reads the day in the member's timezone", async () => {
  const db = await createSchemaDatabase();
  try {
    const { runTool } = await load("src/lib/assistant/tools.js");
    const seed = await seedWorkspace(db);
    let requestedRange = null;
    const context = {
      ...toolContext(db, seed.owner),
      listEvents: async (range) => {
        requestedRange = range;
        return [{
          title: "Design review",
          start_time: "2026-10-22T05:30:00Z",
          end_time: "2026-10-22T06:30:00Z",
          all_day: false,
          calendar_name: "Work",
          status: "confirmed",
          linked_tasks: [{ title: "Ship landing page", status: "todo" }],
        }];
      },
    };

    const { output, isError } = await runTool(context, "get_agenda", { start_date: TODAY });
    assert.equal(isError, false);
    // Kolkata is UTC+05:30, so its day starts at 18:30 UTC the evening before.
    assert.deepEqual(requestedRange, { start: "2026-10-21T18:30:00.000Z", end: "2026-10-22T18:30:00.000Z" });
    assert.equal(output.range, "Thu 2026-10-22");
    assert.deepEqual(output.events, [{
      title: "Design review",
      starts: "Thu 2026-10-22 11:00",
      ends: "12:00",
      calendar: "Work",
      status: "confirmed",
      linked_tasks: ["Ship landing page (todo)"],
      href: "/calendar",
    }]);
    assert.deepEqual(output.tasks_due.map((task) => task.title), ["Renew passport", "Ship landing page"]);
    assert.equal(output.tasks_due[0].due, "Thu 2026-10-22");
    assert.ok(output.tasks_due.every((task) => task.href.startsWith("/tasks?task_id=")));
    assert.equal(output.overdue.total, 1);
    assert.equal(output.overdue.tasks[0].title, "File expenses");
    assert.deepEqual(output.in_progress_without_due_date_in_range.map((task) => task.title), ["Write chapter two"]);
    assert.deepEqual(output.routines, [
      { section: "Morning", item: "Stretch", done: true },
      { section: "Morning", item: "Read", done: false },
    ]);
    assert.deepEqual(output.day_plan.blocks, ["09:00–11:00 Deep work"]);

    const tomorrow = await runTool(context, "get_agenda", { start_date: "2026-10-23" });
    assert.deepEqual(tomorrow.output.tasks_due.map((task) => task.title), ["Call the bank"]);

    const week = await runTool(context, "get_agenda", { start_date: "2026-10-19", end_date: "2026-10-25" });
    assert.equal(week.output.routines.length, 7);
    assert.deepEqual(week.output.routines[3], { date: "Thu 2026-10-22", done: 1, total: 2 });
    assert.equal(week.output.day_plan, undefined);

    assert.equal((await runTool(context, "get_agenda", { start_date: "2026-10-01", end_date: "2026-10-30" })).isError, true);
  } finally {
    await db.close();
  }
});

test("tool input is validated before any query runs", async () => {
  const { runTool } = await load("src/lib/assistant/tools.js");
  const context = { db: { query: () => { throw new Error("must not query"); } }, userId: "u", timeZone: "UTC", today: TODAY };
  const cases = [
    ["get_agenda", {}],
    ["get_agenda", { start_date: "2026-02-30" }],
    ["get_agenda", { start_date: TODAY, extra: true }],
    ["get_task", { task_id: "1; DROP TABLE tasks" }],
    ["search_tasks", { limit: 500 }],
    ["search_tasks", { status: "finished" }],
    ["search_notes", {}],
    ["no_such_tool", {}],
  ];
  for (const [name, input] of cases) {
    const result = await runTool(context, name, input);
    assert.equal(result.isError, true, `${name} ${JSON.stringify(input)} should be rejected`);
    assert.equal(typeof result.output.error, "string");
  }
});

test("the Anthropic adapter builds a cacheable, append-only request", async () => {
  const { buildAnthropicRequest, turnFromAnthropicMessage, createAnthropicProvider } = await load("src/lib/ai/providers/anthropic.js");
  const { getModel } = await load("src/lib/ai/models.js");
  const model = getModel("anthropic:claude-haiku-5-5");
  const tools = [{ name: "get_agenda", description: "d", parameters: { type: "object", properties: {} } }];
  const history = [
    { kind: "input", content: "first, never answered", payload: { context: "Context: one" } },
    { kind: "input", content: "what is on today?", payload: { context: "Context: two" } },
    { kind: "model", content: "", payload: { content: [{ type: "thinking", thinking: "", signature: "sig" }, { type: "tool_use", id: "toolu_1", name: "get_agenda", input: { start_date: TODAY } }] } },
    { kind: "tool_results", content: "", payload: { results: [{ id: "toolu_1", name: "get_agenda", output: { events: [] }, isError: false }] } },
    { kind: "model", content: "Nothing today.", payload: { content: [{ type: "text", text: "Nothing today." }] } },
    { kind: "input", content: "and tomorrow?", payload: { context: "Context: three" } },
  ];

  const request = buildAnthropicRequest({ model, system: "SYSTEM", tools, history });
  assert.equal(request.model, "claude-haiku-5-5");
  assert.deepEqual(request.system, [{ type: "text", text: "SYSTEM", cache_control: { type: "ephemeral" } }]);
  assert.deepEqual(request.cache_control, { type: "ephemeral" });
  assert.deepEqual(request.thinking, { type: "adaptive" });
  assert.deepEqual(request.output_config, { effort: "medium" });
  assert.equal(request.tool_choice, undefined);
  for (const forbidden of ["temperature", "top_p", "top_k"]) assert.equal(forbidden in request, false);
  assert.deepEqual(request.tools, [{ name: "get_agenda", description: "d", input_schema: { type: "object", properties: {} } }]);
  assert.deepEqual(request.messages.map((message) => message.role), ["user", "user", "system", "assistant", "user", "assistant", "user", "system"]);
  assert.equal(request.messages[2].content, "Context: two");
  assert.equal(request.messages.some((message) => message.content === "Context: one"), false, "an unanswered input drops its note");
  assert.deepEqual(request.messages[4].content, [{ type: "tool_result", tool_use_id: "toolu_1", content: "{\"events\":[]}" }]);
  assert.equal(request.messages.at(-1).content, "Context: three");
  assert.equal(request.messages.at(-2).content[0].text, "and tomorrow?");
  assert.deepEqual(buildAnthropicRequest({ model, system: "S", tools, history, finalStep: true }).tool_choice, { type: "none" });

  // Refusals and truncated tool calls never run tools and store text only.
  const refused = turnFromAnthropicMessage({
    stop_reason: "refusal",
    stop_details: { category: "general_harms" },
    content: [{ type: "text", text: "Partial" }, { type: "tool_use", id: "t", name: "get_agenda", input: {} }],
    usage: { input_tokens: 10, output_tokens: 2 },
  });
  assert.deepEqual(refused.toolCalls, []);
  assert.equal(refused.stopReason, "refusal");
  assert.deepEqual(refused.payload, { content: [{ type: "text", text: "Partial" }] });
  const thinkingOnly = turnFromAnthropicMessage({ stop_reason: "end_turn", content: [{ type: "thinking", thinking: "", signature: "s" }], usage: {} });
  assert.equal(thinkingOnly.payload.content.at(-1).type, "text");

  // The stream goes through messages.stream with the abort signal; Haiku has no server-side fallback.
  const calls = [];
  const fakeClient = {
    messages: {
      stream(body, options) {
        calls.push({ body, options });
        const events = [{ type: "content_block_delta", delta: { type: "text_delta", text: "Hi" } }];
        return {
          async *[Symbol.asyncIterator]() { yield* events; },
          finalMessage: async () => ({
            stop_reason: "end_turn",
            content: [{ type: "text", text: "Hi" }],
            usage: { input_tokens: 5, output_tokens: 1, cache_read_input_tokens: 3, cache_creation_input_tokens: 0 },
          }),
        };
      },
    },
    beta: { messages: { stream() { throw new Error("Haiku must not use the fallback beta"); } } },
  };
  const provider = createAnthropicProvider({ client: fakeClient });
  const signal = new globalThis.AbortController().signal;
  const seen = [];
  for await (const event of provider.streamTurn({ model, system: "S", tools, history, signal })) seen.push(event);
  assert.deepEqual(seen[0], { type: "text", text: "Hi" });
  assert.equal(seen[1].turn.stopReason, "end");
  assert.deepEqual(seen[1].turn.usage, { inputTokens: 5, outputTokens: 1, cacheReadTokens: 3, cacheWriteTokens: 0 });
  assert.equal(calls[0].options.signal, signal);
});

function scriptedProvider(turns) {
  const histories = [];
  return {
    histories,
    async *streamTurn({ history, finalStep }) {
      histories.push({ rows: JSON.parse(JSON.stringify(history)), finalStep });
      const turn = turns.shift();
      if (turn.text) yield { type: "text", text: turn.text };
      yield { type: "turn", turn };
    },
  };
}

const usage = (inputTokens, outputTokens) => ({ inputTokens, outputTokens, cacheReadTokens: 0, cacheWriteTokens: 0 });

test("the assistant loop answers with tools, stores an append-only history and records cost", async () => {
  const db = await createSchemaDatabase();
  try {
    const { answerMessage } = await load("src/lib/assistant/agent.js");
    const store = await load("src/lib/assistant/store.js");
    const { getModel } = await load("src/lib/ai/models.js");
    const model = getModel("anthropic:claude-haiku-5-5");
    const seed = await seedWorkspace(db);
    const conversation = await store.createConversation(db, { userId: seed.owner, title: "What's on my plate today?", model });

    const provider = scriptedProvider([
      {
        text: "Let me check.",
        toolCalls: [{ id: "toolu_1", name: "get_agenda", input: { start_date: TODAY } }],
        payload: { content: [{ type: "text", text: "Let me check." }, { type: "tool_use", id: "toolu_1", name: "get_agenda", input: { start_date: TODAY } }] },
        stopReason: "tool_calls",
        usage: usage(3000, 120),
      },
      {
        text: "You have **2** tasks due today.",
        toolCalls: [],
        payload: { content: [{ type: "text", text: "You have **2** tasks due today." }] },
        stopReason: "end",
        usage: usage(5200, 300),
      },
    ]);

    const events = [];
    for await (const event of answerMessage({
      db,
      provider,
      model,
      conversationId: conversation.id,
      history: [],
      userId: seed.owner,
      timeZone: TIME_ZONE,
      now: NOW,
      text: "What's on my plate today?",
      listEvents: async () => [],
    })) {
      events.push(event);
    }

    assert.deepEqual(events, [
      { type: "text", text: "Let me check." },
      { type: "status", label: "Checking your schedule" },
      { type: "text", text: "\n\n" },
      { type: "text", text: "You have **2** tasks due today." },
      { type: "done", reply: "Let me check.\n\nYou have **2** tasks due today." },
    ]);

    // The second call saw the tool results, computed as the member.
    const secondCall = provider.histories[1].rows;
    const results = secondCall.at(-1).payload.results[0];
    assert.equal(results.isError, false);
    assert.deepEqual(results.output.tasks_due.map((task) => task.title), ["Renew passport", "Ship landing page"]);
    assert.match(secondCall[0].payload.context, /Thursday 2026-10-22, 15:00 .*Asia\/Kolkata/);

    const stored = await store.loadHistory(db, conversation.id);
    assert.deepEqual(stored.map((row) => row.kind), ["input", "model", "tool_results", "model"]);
    assert.deepEqual(stored.map((row) => row.seq), [...stored.map((row) => row.seq)].sort((a, b) => a - b));
    // Provider payloads come back byte-for-byte, key order included.
    assert.equal(
      JSON.stringify(stored[1].payload),
      JSON.stringify({ content: [{ type: "text", text: "Let me check." }, { type: "tool_use", id: "toolu_1", name: "get_agenda", input: { start_date: TODAY } }] })
    );
    assert.deepEqual(store.displayMessages(stored).map((message) => [message.role, message.text]), [
      ["user", "What's on my plate today?"],
      ["assistant", "Let me check.\n\nYou have **2** tasks due today."],
    ]);

    const spend = await store.monthlySpendUsd(db, NOW);
    // Haiku 5.5: (3000 + 5200) input at $0.10/M and (120 + 300) output at $0.50/M.
    assert.ok(Math.abs(spend - (8200 * 0.1 + 420 * 0.5) / 1e6) < 1e-6, `unexpected spend ${spend}`);
    const usageRows = await db.query("SELECT provider, model, input_tokens FROM ai_usage ORDER BY input_tokens");
    assert.deepEqual(usageRows.rows, [
      { provider: "anthropic", model: "claude-haiku-5-5", input_tokens: 3000 },
      { provider: "anthropic", model: "claude-haiku-5-5", input_tokens: 5200 },
    ]);
  } finally {
    await db.close();
  }
});

test("the loop stops calling tools at its limit and shows notices the model didn't write", async () => {
  const db = await createSchemaDatabase();
  try {
    const { answerMessage, MAX_MODEL_CALLS_PER_MESSAGE, REFUSAL_NOTICE } = await load("src/lib/assistant/agent.js");
    const store = await load("src/lib/assistant/store.js");
    const { getModel } = await load("src/lib/ai/models.js");
    const model = getModel("anthropic:claude-haiku-5-5");
    const seed = await seedWorkspace(db);

    const toolTurn = (index) => ({
      text: "",
      toolCalls: [{ id: `toolu_${index}`, name: "list_projects", input: {} }],
      payload: { content: [{ type: "tool_use", id: `toolu_${index}`, name: "list_projects", input: {} }] },
      stopReason: "tool_calls",
      usage: usage(100, 10),
    });
    const turns = Array.from({ length: MAX_MODEL_CALLS_PER_MESSAGE - 1 }, (_, index) => toolTurn(index));
    turns.push({ text: "", toolCalls: [], payload: { content: [{ type: "text", text: "(No reply.)" }] }, stopReason: "refusal", usage: usage(100, 1) });
    const provider = scriptedProvider(turns);
    const conversation = await store.createConversation(db, { userId: seed.owner, title: "loop", model });

    const events = [];
    for await (const event of answerMessage({
      db, provider, model, conversationId: conversation.id, history: [], userId: seed.owner,
      timeZone: TIME_ZONE, now: NOW, text: "Keep looking", listEvents: async () => [],
    })) {
      events.push(event);
    }

    assert.equal(provider.histories.length, MAX_MODEL_CALLS_PER_MESSAGE);
    assert.deepEqual(provider.histories.map((call) => call.finalStep), [false, false, false, false, false, true]);
    assert.deepEqual(events.at(-1), { type: "done", reply: REFUSAL_NOTICE });
    assert.deepEqual(events.at(-2), { type: "text", text: REFUSAL_NOTICE });
    const stored = await store.loadHistory(db, conversation.id);
    assert.equal(stored.at(-1).content, REFUSAL_NOTICE);
  } finally {
    await db.close();
  }
});

test("opt-in, history deletion and usage retention", async () => {
  const db = await createSchemaDatabase();
  try {
    const store = await load("src/lib/assistant/store.js");
    const { getModel } = await load("src/lib/ai/models.js");
    const model = getModel("anthropic:claude-haiku-5-5");
    const seed = await seedWorkspace(db);

    const firstEnabledAt = await store.setAssistantEnabled(db, seed.owner, true);
    assert.ok(firstEnabledAt);
    assert.equal(String(await store.setAssistantEnabled(db, seed.owner, true)), String(firstEnabledAt), "re-enabling keeps the original consent time");
    assert.equal(await store.setAssistantEnabled(db, seed.owner, false), null);

    const conversation = await store.createConversation(db, { userId: seed.owner, title: "  a   very\nlong title ".repeat(10), model });
    assert.ok(conversation.title.length <= 60);
    await store.appendMessages(db, conversation.id, [{ kind: "input", content: "hello", payload: { context: "c" } }]);
    await store.recordUsage(db, { userId: seed.owner, chatId: conversation.id, model, usage: usage(10, 1), costUsd: 0.0000015 });
    assert.equal(await store.getConversation(db, seed.member, conversation.id), null, "conversations are private to their owner");
    assert.equal(await store.deleteConversation(db, seed.member, conversation.id), false);

    await store.deleteAllConversations(db, seed.owner);
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM ai_messages")).rows[0].n, 0);
    const kept = await db.query("SELECT user_id, chat_id FROM ai_usage");
    assert.deepEqual(kept.rows, [{ user_id: seed.owner, chat_id: null }]);

    await db.query("DELETE FROM users WHERE id = $1", [seed.owner]);
    assert.deepEqual((await db.query("SELECT user_id FROM ai_usage")).rows, [{ user_id: null }]);
  } finally {
    await db.close();
  }
});

test("cost estimates, the monthly budget setting and the model setting", async () => {
  const { estimateCostUsd, getModel, resolveConfiguredModel } = await load("src/lib/ai/models.js");
  const store = await load("src/lib/assistant/store.js");
  const haiku = getModel("anthropic:claude-haiku-5-5");

  // $0.10 per million input and $0.50 per million output tokens.
  assert.ok(Math.abs(estimateCostUsd(haiku, usage(100_000, 1_000_000)) - 0.51) < 1e-9);
  // Cache reads cost a tenth of input; writes cost 1.25x.
  assert.ok(Math.abs(estimateCostUsd(haiku, { inputTokens: 0, outputTokens: 0, cacheReadTokens: 50_000, cacheWriteTokens: 40_000 }) - 0.0055) < 1e-9);
  // Prompts over 100K tokens, cached or not, use the $0.50 / $2.50 card.
  assert.ok(Math.abs(estimateCostUsd(haiku, usage(200_000, 0)) - 0.1) < 1e-9);
  assert.ok(Math.abs(estimateCostUsd(haiku, { inputTokens: 10_000, outputTokens: 1_000_000, cacheReadTokens: 100_000, cacheWriteTokens: 0 }) - (0.005 + 0.005 + 2.5)) < 1e-9);

  assert.equal(resolveConfiguredModel({}).id, "claude-haiku-5-5");
  assert.equal(resolveConfiguredModel({ AI_MODEL: "anthropic:claude-sonnet-5-5" }).serverFallback, true);
  assert.throws(() => resolveConfiguredModel({ AI_MODEL: "someone:gpt" }), /not a known model/);

  assert.equal(store.readMonthlyBudgetUsd({}), 10);
  assert.equal(store.readMonthlyBudgetUsd({ AI_MONTHLY_BUDGET_USD: "25" }), 25);
  assert.equal(store.readMonthlyBudgetUsd({ AI_MONTHLY_BUDGET_USD: "lots" }), 10);
  assert.equal(store.nextMonthStartUtc(new Date("2026-12-31T23:00:00Z")).toISOString(), "2027-01-01T00:00:00.000Z");
});

test("the assistant migration refuses to reshape legacy tables that hold rows", async () => {
  const db = await createSchemaDatabase({ before: "20261022_ai_assistant.sql" });
  try {
    const user = await insertUser(db, "legacy@example.com", "Legacy");
    await db.query("INSERT INTO ai_chats (user_id, title) VALUES ($1, 'old')", [user]);
    const migration = fs.readFileSync(path.join(root, "migrations", "20261022_ai_assistant.sql"), "utf8");
    await assert.rejects(db.exec(migration), /already contain rows/);
  } finally {
    await db.close();
  }
});

test("assistant routes enforce the opt-in and keep the API key on the server", () => {
  const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
  for (const route of [
    "src/app/api/assistant/messages/route.js",
    "src/app/api/assistant/conversations/route.js",
    "src/app/api/assistant/conversations/[id]/route.js",
  ]) {
    const source = read(route);
    assert.match(source, /export const GET|export const POST/);
    const handlers = source.match(/export const (GET|POST) = withAuth\(async \(request(?:, \{ params \})?\) => \{\n\s*const disabled = assistantDisabledResponse\(request\.user\);/g) || [];
    const readHandlers = source.match(/export const (GET|POST) = withAuth/g) || [];
    assert.equal(handlers.length, readHandlers.length, `${route} must check the opt-in first`);
  }
  for (const client of ["src/components/assistant/AssistantPanel.js", "src/services/api.js"]) {
    assert.doesNotMatch(read(client), /ANTHROPIC|@anthropic-ai/);
  }
});

test("replies stream as server-sent events that the browser client parses", async () => {
  const { eventStreamResponse } = await load("src/lib/assistant/sse.js");
  const { assistantService } = await load("src/services/api.js");
  const originalFetch = globalThis.fetch;
  async function* reply() {
    yield { type: "conversation", id: "c1", title: "hi" };
    yield { type: "text", text: "Two lines:\n\nhere" };
    yield { type: "done", reply: "Two lines:\n\nhere" };
  }
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(url, "/api/assistant/messages");
      assert.deepEqual(JSON.parse(init.body), { conversationId: null, text: "hi" });
      return eventStreamResponse(reply());
    };
    const received = [];
    await assistantService.sendMessage({ text: "hi", onEvent: (event) => received.push(event) });
    assert.deepEqual(received, [
      { type: "conversation", id: "c1", title: "hi" },
      { type: "text", text: "Two lines:\n\nhere" },
      { type: "done", reply: "Two lines:\n\nhere" },
    ]);

    globalThis.fetch = async () => new globalThis.Response(JSON.stringify({ error: "Slow down" }), { status: 429 });
    await assert.rejects(
      assistantService.sendMessage({ text: "hi", onEvent() {} }),
      (error) => error.status === 429 && error.message === "Slow down"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  // A client that goes away stops the reply and aborts the model call.
  let aborted = false;
  let finished = false;
  async function* endless() {
    try {
      for (let index = 0; ; index += 1) yield { type: "text", text: String(index) };
    } finally {
      finished = true;
    }
  }
  const reader = eventStreamResponse(endless(), { onCancel: () => { aborted = true; } }).body.getReader();
  await reader.read();
  await reader.cancel();
  assert.equal(aborted, true);
  assert.equal(finished, true);
});

test("task and project lookups return details, counts and filters", async () => {
  const db = await createSchemaDatabase();
  try {
    const { runTool } = await load("src/lib/assistant/tools.js");
    const seed = await seedWorkspace(db);
    const asOwner = toolContext(db, seed.owner);
    const asMember = toolContext(db, seed.member);

    const subtask = await db.query(
      "INSERT INTO tasks (user_id, parent_task_id, title, status) VALUES ($1, $2, 'Book photo booth', 'done') RETURNING id",
      [seed.owner, seed.tasks.personalDueToday]
    );
    assert.ok(subtask.rows[0].id);
    await db.query("INSERT INTO task_dependencies (task_id, depends_on_task_id) VALUES ($1, $2)", [seed.tasks.personalDueToday, seed.tasks.overdue]);
    const tag = await db.query("INSERT INTO tags (user_id, name) VALUES ($1, 'errands') RETURNING id", [seed.owner]);
    await db.query("INSERT INTO task_tags (task_id, tag_id) VALUES ($1, $2)", [seed.tasks.personalDueToday, tag.rows[0].id]);
    await db.query("UPDATE tasks SET description = '<p>Check the <em>form</em> first</p>' WHERE id = $1", [seed.tasks.personalDueToday]);
    await db.query(
      "INSERT INTO milestones (project_id, title, due_date, position) VALUES ($1, 'Beta', '2026-11-01', 0), ($1, 'Alpha', '2026-10-01', 1)",
      [seed.project]
    );
    await db.query("UPDATE milestones SET is_completed = TRUE WHERE title = 'Alpha'");

    const task = await runTool(asOwner, "get_task", { task_id: seed.tasks.personalDueToday });
    assert.equal(task.isError, false);
    assert.equal(task.output.title, "Renew passport");
    assert.equal(task.output.description, "Check the form first");
    assert.deepEqual(task.output.subtasks, ["Book photo booth (done)"]);
    assert.deepEqual(task.output.depends_on.map((dependency) => dependency.title), ["File expenses"]);
    assert.equal(task.output.blocked_by_open_tasks, 1);
    assert.deepEqual(task.output.tags, ["errands"]);

    const sharedTask = await runTool(asOwner, "get_task", { task_id: seed.tasks.sharedDueToday });
    assert.equal(sharedTask.output.created_by, "Mo Member");

    const overdue = await runTool(asOwner, "search_tasks", { overdue: true });
    assert.deepEqual(overdue.output.tasks.map((row) => row.title), ["File expenses"]);
    const high = await runTool(asOwner, "search_tasks", { priority: "high", text: "passport" });
    assert.deepEqual(high.output.tasks.map((row) => row.title), ["Renew passport"]);
    const byProject = await runTool(asMember, "search_tasks", { project: "laun" });
    assert.deepEqual(byProject.output.tasks.map((row) => row.title), ["Ship landing page"]);
    const dueWindow = await runTool(asOwner, "search_tasks", { due_from: "2026-10-23", due_to: "2026-10-23" });
    assert.deepEqual(dueWindow.output.tasks.map((row) => row.title), ["Call the bank"]);
    const literalPercent = await runTool(asOwner, "search_tasks", { text: "%%" });
    assert.equal(literalPercent.output.total, 0, "LIKE wildcards in the text are matched literally");

    for (const context of [asOwner, asMember]) {
      const projects = await runTool(context, "list_projects", {});
      assert.equal(projects.isError, false);
      assert.equal(projects.output.projects.length, 1);
      const [launch] = projects.output.projects;
      assert.equal(launch.name, "Launch");
      assert.equal(launch.open_tasks, 1);
      assert.equal(launch.overdue_tasks, 0);
      assert.equal(launch.next_task_due, "Thu 2026-10-22");
      assert.equal(launch.next_milestone, "Beta (due 2026-11-01)");
      assert.equal(launch.shared_with_you, context === asMember ? true : undefined);
    }
    assert.deepEqual((await runTool(asOwner, "list_projects", { status: "completed" })).output.projects, []);

    const project = await runTool(asOwner, "get_project", { project_id: seed.project });
    assert.deepEqual(project.output.milestones, [
      { title: "Beta", due: "Sun 2026-11-01", done: false },
      { title: "Alpha", due: "Thu 2026-10-01", done: true },
    ]);
    assert.equal(project.output.open_tasks, 1);
    assert.deepEqual(project.output.open_tasks_list.map((row) => row.title), ["Ship landing page"]);

    const journal = await db.query(
      "INSERT INTO notes (user_id, title, content, is_journal, journal_date) VALUES ($1, 'Thursday', '<p>Good day</p>', TRUE, $2) RETURNING id",
      [seed.owner, TODAY]
    );
    const journalSearch = await runTool(asOwner, "search_notes", { journal_date: TODAY });
    assert.deepEqual(journalSearch.output.notes.map((note) => note.id), [journal.rows[0].id]);
    assert.equal(journalSearch.output.notes[0].journal_entry_for, "Thu 2026-10-22");
  } finally {
    await db.close();
  }
});

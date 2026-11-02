const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { createSchemaDatabase } = require("./helpers/schema-database.cjs");

const root = path.resolve(__dirname, "..");
const load = (relativePath) => import(path.join(root, relativePath));
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const NOW = new Date("2026-10-22T09:30:00Z");

process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");

const usage = (inputTokens, outputTokens, costUsd) => ({ inputTokens, outputTokens, cacheReadTokens: 0, cacheWriteTokens: 0, ...(costUsd === undefined ? {} : { costUsd }) });

async function rejectsWith(promise, status, pattern) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.status, status, error.message);
    if (pattern) assert.match(error.message, pattern);
    return true;
  });
}

function jsonResponse(status, body) {
  return new globalThis.Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// An OpenRouter-style event stream, delivered in awkward pieces to exercise
// line reassembly.
function sseResponse(chunks, { pieceSize = 7 } = {}) {
  const text = [": OPENROUTER PROCESSING", "", ...chunks.flatMap((chunk) => [`data: ${typeof chunk === "string" ? chunk : JSON.stringify(chunk)}`, ""]), "data: [DONE]", ""].join("\n");
  const bytes = new globalThis.TextEncoder().encode(text);
  const stream = new globalThis.ReadableStream({
    start(controller) {
      for (let offset = 0; offset < bytes.length; offset += pieceSize) controller.enqueue(bytes.slice(offset, offset + pieceSize));
      controller.close();
    },
  });
  return new globalThis.Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

test("the OpenRouter adapter sends OpenAI-format tools, routes only to endpoints that support them, and parses replies", async () => {
  const { buildOpenRouterRequest, turnFromOpenRouterResponse, createOpenRouterProvider, describeOpenRouterError, OpenRouterError } =
    await load("src/lib/ai/providers/openrouter.js");
  const { getModel } = await load("src/lib/ai/models.js");
  const glm = getModel("openrouter:z-ai/glm-5.3-flash");
  const inkling = getModel("openrouter:thinkingmachines/inkling:free");
  const tools = [{ name: "get_agenda", description: "d", parameters: { type: "object", properties: {} } }];
  const history = [{ kind: "input", content: "what's on today?", payload: { context: "Context: Thursday." } }];

  const request = buildOpenRouterRequest({ model: glm, system: "RULES", memory: "MEMORY", tools, history });
  assert.equal(request.model, "z-ai/glm-5.3-flash");
  assert.equal(request.stream, true);
  assert.deepEqual(request.messages, [
    { role: "system", content: "RULES\n\nMEMORY" },
    { role: "user", content: "what's on today?\n\nContext: Thursday." },
  ]);
  assert.deepEqual(request.tools, [{ type: "function", function: { name: "get_agenda", description: "d", parameters: { type: "object", properties: {} } } }]);
  assert.equal(request.tool_choice, "auto");
  assert.deepEqual(request.provider, { require_parameters: true });
  assert.deepEqual(request.reasoning, { effort: "low" });
  assert.equal(buildOpenRouterRequest({ model: glm, system: "R", tools, history, finalStep: true }).tool_choice, "none");

  // Models without tool_choice support never receive it; the last turn asks them in words instead.
  const free = buildOpenRouterRequest({ model: inkling, system: "R", tools, history, finalStep: true });
  assert.equal("tool_choice" in free, false);
  assert.match(free.messages[0].content, /Answer now with what you have/);

  const withCall = turnFromOpenRouterResponse({
    choices: [{
      finish_reason: "tool_calls",
      message: {
        role: "assistant",
        content: null,
        tool_calls: [{ id: "call_a", type: "function", function: { name: "get_agenda", arguments: "{\"start_date\":\"2026-10-22\"}" } }, { type: "function", function: { name: "get_agenda", arguments: "{oops" } }],
        reasoning_details: [{ type: "reasoning.encrypted", data: "abc", format: "openai-responses-v1" }],
      },
    }],
    usage: { prompt_tokens: 1200, completion_tokens: 80, cost: 0.00042, prompt_tokens_details: { cached_tokens: 200 } },
  });
  assert.equal(withCall.stopReason, "tool_calls");
  assert.deepEqual(withCall.toolCalls, [
    { id: "call_a", name: "get_agenda", input: { start_date: "2026-10-22" } },
    { id: "call_1", name: "get_agenda", input: null },
  ]);
  assert.deepEqual(withCall.payload.message.reasoning_details, [{ type: "reasoning.encrypted", data: "abc", format: "openai-responses-v1" }]);
  assert.equal(withCall.payload.message.tool_calls[1].id, "call_1", "a missing call id is filled in where it's stored too");
  assert.deepEqual(withCall.usage, { inputTokens: 1000, outputTokens: 80, cacheReadTokens: 200, cacheWriteTokens: 0, costUsd: 0.00042 });

  const filtered = turnFromOpenRouterResponse({ choices: [{ finish_reason: "content_filter", message: { content: "" } }], usage: {} });
  assert.equal(filtered.stopReason, "refusal");
  assert.deepEqual(filtered.toolCalls, []);
  const cutOff = turnFromOpenRouterResponse({ choices: [{ finish_reason: "length", message: { content: "Part", tool_calls: [{ id: "x", function: { name: "get_agenda", arguments: "{" } }] } }], usage: {} });
  assert.equal(cutOff.stopReason, "max_tokens");
  assert.deepEqual(cutOff.payload.message, { role: "assistant", content: "Part" });
  assert.throws(() => turnFromOpenRouterResponse({ choices: [{ finish_reason: "error", error: { message: "upstream" } }] }), /upstream/);

  // A request carries the member's key, never anything else, and reports errors a member can act on.
  const sent = [];
  const provider = createOpenRouterProvider({
    fetchImpl: async (url, init) => {
      sent.push({ url, init });
      if (url.endsWith("/key")) return init.headers.Authorization === "Bearer sk-or-good-key-123456789" ? jsonResponse(200, { data: {} }) : jsonResponse(401, { error: { message: "No auth" } });
      return sseResponse([
        { choices: [{ index: 0, delta: { role: "assistant", content: "Hel" } }] },
        { choices: [{ index: 0, delta: { content: "lo" }, finish_reason: "stop" }] },
        { choices: [{ index: 0, delta: { content: "" }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 2, cost: 0.0001 } },
      ]);
    },
  });
  assert.deepEqual(await provider.validateKey("sk-or-good-key-123456789"), { ok: true });
  assert.equal((await provider.validateKey("sk-or-bad-key-1234567890")).ok, false);
  const events = [];
  for await (const event of provider.streamTurn({ model: glm, system: "R", tools, history, apiKey: "sk-or-good-key-123456789" })) events.push(event);
  assert.deepEqual(events.filter((event) => event.type === "text").map((event) => event.text), ["Hel", "lo"]);
  assert.equal(events.at(-1).turn.text, "Hello");
  assert.equal(events.at(-1).turn.usage.costUsd, 0.0001);
  assert.equal(JSON.parse(sent.at(-1).init.body).stream, true);
  assert.equal(sent.at(-1).url, "https://openrouter.ai/api/v1/chat/completions");
  assert.equal(sent.at(-1).init.headers.Authorization, "Bearer sk-or-good-key-123456789");
  await assert.rejects(async () => {
    for await (const event of provider.streamTurn({ model: glm, system: "R", tools, history })) assert.ok(event);
  }, /OpenRouter key is required/);

  assert.match(describeOpenRouterError(new OpenRouterError("x", { status: 429 })), /too quickly/);
  assert.match(describeOpenRouterError(new OpenRouterError("x", { status: 429, code: "free_daily_limit" })), /today's free OpenRouter requests/);
  assert.match(describeOpenRouterError(new OpenRouterError("x", { status: 402 })), /out of credits/);
  assert.match(describeOpenRouterError(new OpenRouterError("x", { status: 401 })), /didn't accept your API key/);
  assert.equal(describeOpenRouterError(new Error("other")), null);
});

test("a conversation can switch models: each adapter replays its own responses and sees others as text", async () => {
  const { buildAnthropicMessages } = await load("src/lib/ai/providers/anthropic.js");
  const { buildOpenRouterMessages } = await load("src/lib/ai/providers/openrouter.js");
  const { getModel } = await load("src/lib/ai/models.js");
  const glm = getModel("openrouter:z-ai/glm-5.3-flash");
  const sol = getModel("openrouter:openai/gpt-5.6-sol");

  const history = [
    { kind: "input", content: "first", payload: { context: "C1" } },
    { kind: "model", provider: "anthropic", model: "claude-haiku-5-5", content: "", payload: { content: [{ type: "thinking", thinking: "", signature: "s" }, { type: "tool_use", id: "toolu_1", name: "get_agenda", input: {} }] } },
    { kind: "tool_results", provider: "anthropic", model: "claude-haiku-5-5", content: "", payload: { results: [{ id: "toolu_1", name: "get_agenda", output: { events: [] }, isError: false }] } },
    { kind: "model", provider: "anthropic", model: "claude-haiku-5-5", content: "Nothing today.", payload: { content: [{ type: "text", text: "Nothing today." }] } },
    { kind: "input", content: "second", payload: { context: "C2" } },
    { kind: "model", provider: "openrouter", model: "z-ai/glm-5.3-flash", content: "Let me look.", payload: { message: { role: "assistant", content: "Let me look.", tool_calls: [{ id: "call_1", type: "function", function: { name: "search_tasks", arguments: "{}" } }] } } },
    { kind: "tool_results", provider: "openrouter", model: "z-ai/glm-5.3-flash", content: "", payload: { results: [{ id: "call_1", name: "search_tasks", output: { tasks: [] }, isError: false }] } },
    { kind: "model", provider: "openrouter", model: "z-ai/glm-5.3-flash", content: "No open tasks.", payload: { message: { role: "assistant", content: "No open tasks." } } },
    { kind: "input", content: "third", payload: { context: "C3" } },
    // A tool step that never got its answer (the request failed).
    { kind: "model", provider: "openrouter", model: "z-ai/glm-5.3-flash", content: "", payload: { message: { role: "assistant", content: null, tool_calls: [{ id: "call_2", type: "function", function: { name: "list_projects", arguments: "{}" } }] } } },
    { kind: "tool_results", provider: "openrouter", model: "z-ai/glm-5.3-flash", content: "", payload: { results: [{ id: "call_2", name: "list_projects", output: { projects: [] }, isError: false }] } },
    { kind: "input", content: "fourth", payload: { context: "C4" } },
  ];

  // Claude replays its own blocks; GLM's turn is merged plain text; the input whose
  // only follow-up is another model's empty tool step loses its system note.
  const claude = buildAnthropicMessages(history);
  assert.deepEqual(claude.map((message) => message.role), ["user", "system", "assistant", "user", "assistant", "user", "system", "assistant", "user", "user", "system"]);
  assert.deepEqual(claude[2].content[1], { type: "tool_use", id: "toolu_1", name: "get_agenda", input: {} });
  assert.deepEqual(claude[7].content, [{ type: "text", text: "Let me look.\n\nNo open tasks." }]);
  assert.equal(claude.some((message) => message.content === "C3"), false);
  assert.equal(claude.at(-1).content, "C4");

  // GLM replays its own tool calls and results; Claude's turn is text.
  const glmMessages = buildOpenRouterMessages({ model: glm, system: "R", history });
  assert.deepEqual(glmMessages.map((message) => message.role), ["system", "user", "assistant", "user", "assistant", "tool", "assistant", "user", "assistant", "tool", "user"]);
  assert.equal(glmMessages[2].content, "Nothing today.");
  assert.equal(glmMessages[5].tool_call_id, "call_1");

  // A different OpenRouter model doesn't replay GLM's reasoning or tool calls.
  const solMessages = buildOpenRouterMessages({ model: sol, system: "R", history });
  assert.equal(solMessages.some((message) => message.role === "tool"), false);
  assert.deepEqual(solMessages.filter((message) => message.role === "assistant").map((message) => message.content), ["Nothing today.", "Let me look.\n\nNo open tasks."]);

  // Rendering depends only on the stored rows.
  assert.deepEqual(buildAnthropicMessages(history), claude);
});

test("the loop records which model wrote each row and whose key paid, and the cap ignores members' own keys", async () => {
  const db = await createSchemaDatabase();
  try {
    const { answerMessage } = await load("src/lib/assistant/agent.js");
    const store = await load("src/lib/assistant/store.js");
    const members = await load("src/lib/members.js");
    const { getModel } = await load("src/lib/ai/models.js");
    const haiku = getModel("anthropic:claude-haiku-5-5");
    const glm = getModel("openrouter:z-ai/glm-5.3-flash");
    const userId = await members.createMember(db, { email: "ada@example.com", fullName: "Ada", password: "long-enough-1" });
    const conversation = await store.createConversation(db, { userId, title: "switch", model: haiku });

    const scripted = (turns, seen) => ({
      async *streamTurn(args) {
        seen.push({ apiKey: args.apiKey, rows: args.history.length });
        const turn = turns.shift();
        if (turn.text) yield { type: "text", text: turn.text };
        yield { type: "turn", turn };
      },
    });
    const run = async (provider, model, extra) => {
      const history = await store.loadHistory(db, conversation.id);
      for await (const event of answerMessage({
        db, provider, model, conversationId: conversation.id, history, userId, timeZone: "UTC", now: NOW,
        text: "hi", listEvents: async () => [], ...extra,
      })) {
        assert.ok(event);
      }
    };

    const seen = [];
    await run(scripted([{ text: "From Claude", toolCalls: [], payload: { content: [{ type: "text", text: "From Claude" }] }, stopReason: "end", usage: usage(1000, 50) }], seen), haiku, {});
    await store.setConversationModel(db, conversation.id, glm);
    await run(scripted([{ text: "From GLM", toolCalls: [], payload: { message: { role: "assistant", content: "From GLM" } }, stopReason: "end", usage: usage(900, 40, 0.25) }], seen), glm, { apiKey: "sk-or-member", keySource: "member" });

    assert.deepEqual(seen, [{ apiKey: null, rows: 1 }, { apiKey: "sk-or-member", rows: 3 }]);
    const rows = await store.loadHistory(db, conversation.id);
    assert.deepEqual(rows.map((row) => [row.kind, row.provider, row.model]), [
      ["input", null, null],
      ["model", "anthropic", "claude-haiku-5-5"],
      ["input", null, null],
      ["model", "openrouter", "z-ai/glm-5.3-flash"],
    ]);
    assert.deepEqual(store.displayMessages(rows).filter((message) => message.role === "assistant").map((message) => message.model), ["Claude Haiku 5.5", "GLM 5.3 Flash"]);
    assert.equal((await store.getConversation(db, userId, conversation.id)).model, "z-ai/glm-5.3-flash");

    const usageRows = (await db.query("SELECT key_source, cost_usd FROM ai_usage ORDER BY created_at, key_source")).rows;
    assert.deepEqual(usageRows.map((row) => row.key_source).sort(), ["member", "workspace"]);
    assert.ok(usageRows.some((row) => row.key_source === "member" && Math.abs(Number(row.cost_usd) - 0.25) < 1e-9), "the provider's reported charge is used");
    const spend = await store.monthlySpendUsd(db, NOW);
    assert.ok(spend > 0 && spend < 0.01, "only workspace-key spend counts toward the cap");

    const { usageSummary } = await load("src/lib/assistant/usage.js");
    const summary = await usageSummary(db, { now: NOW, budgetUsd: 10 });
    assert.equal(summary.calls, 1);
    assert.deepEqual(summary.ownKeys, { calls: 1, costUsd: 0.25 });
    assert.ok(Math.abs(summary.members[0].ownKeyCostUsd - 0.25) < 1e-9);
    assert.deepEqual(summary.models.map((row) => [row.label, row.keySource]).sort(), [["Claude Haiku 5.5", "workspace"], ["GLM 5.3 Flash", "member"]]);
  } finally {
    await db.close();
  }
});

test("members' keys are encrypted, private to them, and shown only as a hint", async () => {
  const db = await createSchemaDatabase();
  try {
    const keys = await load("src/lib/assistant/keys.js");
    const members = await load("src/lib/members.js");
    const ada = await members.createMember(db, { email: "ada@example.com", fullName: "Ada", password: "long-enough-1" });
    const ben = await members.createMember(db, { email: "ben@example.com", fullName: "Ben", password: "long-enough-1" });
    const secret = "sk-ant-api03-SECRETSECRETSECRET-wxyz";

    const saved = await keys.saveKey(db, ada, "anthropic", secret);
    assert.equal(saved.key_hint, "sk-ant-…wxyz");
    const stored = (await db.query("SELECT encrypted_key FROM ai_provider_keys WHERE user_id = $1", [ada])).rows[0].encrypted_key;
    assert.ok(stored.startsWith("enc:v1:") && !stored.includes("SECRET"));
    assert.equal(await keys.loadKey(db, ada, "anthropic"), secret);
    assert.equal(await keys.loadKey(db, ben, "anthropic"), null, "one member can't load another's key");
    assert.deepEqual((await keys.listKeys(db, ada)).map((row) => Object.keys(row).sort()), [["created_at", "key_hint", "provider", "updated_at"]]);

    await keys.saveKey(db, ada, "anthropic", "sk-ant-api03-REPLACEMENTKEY-abcd");
    assert.equal((await keys.listKeys(db, ada)).length, 1, "saving again replaces the key");
    assert.equal(await keys.deleteKey(db, ben, "anthropic"), false);
    assert.equal(await keys.deleteKey(db, ada, "anthropic"), true);

    assert.throws(() => keys.cleanApiKey("short"), /doesn't look like an API key/);
    assert.throws(() => keys.cleanApiKey("enc:v1:aaaaaaaaaaaaaaaaaaaaaaaa"), /doesn't look like/);
    assert.throws(() => keys.cleanApiKey("sk-or-has whitespace-0123456789"), /doesn't look like/);
    assert.throws(() => keys.requireProvider("someone-else"), /Unknown provider/);
    await assert.rejects(db.query("INSERT INTO ai_provider_keys (user_id, provider, encrypted_key, key_hint) VALUES ($1, 'openrouter', 'plaintext', 'x')", [ada]), "plaintext keys are rejected by the database");
  } finally {
    await db.close();
  }
});

test("model access: the workspace key needs an admin, own keys need nobody, and only offered models appear", async () => {
  const db = await createSchemaDatabase();
  try {
    const members = await load("src/lib/members.js");
    const keys = await load("src/lib/assistant/keys.js");
    const access = await load("src/lib/assistant/access.js");
    const modelAdmin = await load("src/lib/assistant/modelAdmin.js");
    const { getModel } = await load("src/lib/ai/models.js");
    const { resolveWorkspaceModels } = await load("src/lib/ai/models.js");
    const workspaceModels = resolveWorkspaceModels({});
    const workspace = { models: workspaceModels, defaultKey: workspaceModels[0].key, provider: "anthropic", configured: true };
    const admin = await members.createMember(db, { email: "admin@example.com", fullName: "Admin", password: "long-enough-1", role: "admin" });
    const userId = await members.createMember(db, { email: "m@example.com", fullName: "M", password: "long-enough-1" });
    const user = async () => (await db.query("SELECT id, ai_assistant_enabled_at, ai_model FROM users WHERE id = $1", [userId])).rows[0];

    // No approval and no key: nothing.
    assert.deepEqual((await access.availableModels(db, await user(), workspace)).options, []);
    await rejectsWith(access.resolveModelChoice(db, await user(), null, workspace), 403, /Add your own API key/);

    // Approved: the workspace models, Haiku first and the default.
    await members.updateMember(db, userId, { assistantEnabled: true }, { actorId: admin });
    let options = (await access.availableModels(db, await user(), workspace)).options;
    assert.deepEqual(options.map((option) => [option.key, option.keySource]), [
      ["anthropic:claude-haiku-5-5", "workspace"],
      ["anthropic:claude-sonnet-5-5", "workspace"],
    ]);
    assert.equal(access.defaultModelKey(await user(), options, workspace.defaultKey), "anthropic:claude-haiku-5-5");
    assert.equal((await access.resolveModelChoice(db, await user(), "anthropic:claude-sonnet-5-5", workspace)).keySource, "workspace");
    // An admin can stop offering Sonnet; the default stays.
    await db.query("INSERT INTO ai_model_settings (model_key, enabled) VALUES ('anthropic:claude-sonnet-5-5', FALSE)");
    options = (await access.availableModels(db, await user(), workspace)).options;
    assert.deepEqual(options.map((option) => option.key), ["anthropic:claude-haiku-5-5"]);
    await db.query("DELETE FROM ai_model_settings");
    await rejectsWith(access.resolveModelChoice(db, await user(), "anthropic:claude-opus-5-5", workspace), 403, /isn't available/);
    assert.deepEqual(await access.resolveModelChoice(db, await user(), null, workspace).then((choice) => [choice.model.key, choice.keySource, choice.apiKey]), ["anthropic:claude-haiku-5-5", "workspace", null]);
    // No workspace key on the server: no workspace option.
    assert.deepEqual((await access.availableModels(db, await user(), { ...workspace, configured: false })).options, []);
    // Free models are never the automatic default when something else is available.
    assert.equal(access.defaultModelKey({}, [{ key: "a", free: true }, { key: "b", free: false }]), "b");

    // An OpenRouter key: OpenRouter models appear only once an admin offers them.
    await keys.saveKey(db, userId, "openrouter", "sk-or-v1-membersopenrouterkey-0001");
    options = (await access.availableModels(db, await user(), workspace)).options;
    assert.deepEqual(options.map((option) => option.key), ["anthropic:claude-haiku-5-5", "anthropic:claude-sonnet-5-5"]);
    await rejectsWith(modelAdmin.setModelEnabled(db, "openrouter:z-ai/glm-5.3-flash", true, { actorId: admin }), 409, /Run a check/);
    await modelAdmin.recordModelCheck(db, "openrouter:z-ai/glm-5.3-flash", { passed: true, detail: "Passed" }, { actorId: admin });
    await modelAdmin.setModelEnabled(db, "openrouter:z-ai/glm-5.3-flash", true, { actorId: admin });
    options = (await access.availableModels(db, await user(), workspace)).options;
    assert.deepEqual(options.map((option) => [option.key, option.keySource]), [
      ["anthropic:claude-haiku-5-5", "workspace"],
      ["anthropic:claude-sonnet-5-5", "workspace"],
      ["openrouter:z-ai/glm-5.3-flash", "member"],
    ]);
    const choice = await access.resolveModelChoice(db, await user(), "openrouter:z-ai/glm-5.3-flash", workspace);
    assert.equal(choice.apiKey, "sk-or-v1-membersopenrouterkey-0001");
    assert.equal(choice.keySource, "member");

    // A failing re-check stops offering it.
    await modelAdmin.recordModelCheck(db, "openrouter:z-ai/glm-5.3-flash", { passed: false, detail: "Failed" }, { actorId: admin });
    assert.equal((await access.availableModels(db, await user(), workspace)).options.length, 2);

    // Their own Anthropic key pays for Claude, even with workspace access, and opens the other Claude models.
    await keys.saveKey(db, userId, "anthropic", "sk-ant-api03-membersanthropickey-0002");
    options = (await access.availableModels(db, await user(), workspace)).options;
    assert.deepEqual(options.map((option) => [option.key, option.keySource]), [
      ["anthropic:claude-haiku-5-5", "member"],
      ["anthropic:claude-sonnet-5-5", "member"],
      ["anthropic:claude-opus-5-5", "member"],
    ]);
    // Without approval, own keys still work.
    await members.updateMember(db, userId, { assistantEnabled: false }, { actorId: admin });
    assert.equal((await access.availableModels(db, await user(), workspace)).options.length, 3);

    // The picker remembers the last choice when it's still available.
    await db.query("UPDATE users SET ai_model = 'anthropic:claude-opus-5-5' WHERE id = $1", [userId]);
    assert.equal(access.defaultModelKey(await user(), options), "anthropic:claude-opus-5-5");
    assert.equal(access.defaultModelKey({ ai_model: "gone:model" }, options), "anthropic:claude-haiku-5-5");

    // A passing first check keeps a default-on model on; a failing one turns it off.
    await modelAdmin.recordModelCheck(db, "anthropic:claude-sonnet-5-5", { passed: true, detail: "Passed" }, { actorId: admin });
    const statuses = await modelAdmin.listModelStatuses(db);
    assert.equal(statuses.find((status) => status.key === "anthropic:claude-sonnet-5-5").enabled, true);
    await modelAdmin.recordModelCheck(db, "anthropic:claude-opus-5-5", { passed: false, detail: "Failed" }, { actorId: admin });
    assert.equal((await modelAdmin.listModelStatuses(db)).find((status) => status.key === "anthropic:claude-opus-5-5").enabled, false);
  } finally {
    await db.close();
  }
});

test("the model check passes a model that looks the day up and answers from it, and fails one that doesn't", async () => {
  const { runModelCheck } = await load("src/lib/assistant/modelCheck.js");
  const { getModel } = await load("src/lib/ai/models.js");
  const model = getModel("openrouter:z-ai/glm-5.3-flash");
  const provider = (turns) => ({
    async *streamTurn(args) {
      const turn = typeof turns[0] === "function" ? turns.shift()(args) : turns.shift();
      yield { type: "turn", turn };
    },
  });
  const toolTurn = (input) => ({ text: "", toolCalls: [{ id: "c1", name: "get_agenda", input }], payload: { message: { role: "assistant", content: null } }, stopReason: "tool_calls", usage: usage(1, 1, 0.001) });
  const answer = (text) => ({ text, toolCalls: [], payload: { message: { role: "assistant", content: text } }, stopReason: "end", usage: usage(1, 1, 0.001) });

  let sawResults = null;
  const good = await runModelCheck({
    provider: provider([
      toolTurn({ start_date: "2026-10-22" }),
      (args) => { sawResults = args.history.at(-1).payload.results[0].output; return answer("You have the **Design review** at 11:00 and need to send the Q4 invoice."); },
    ]),
    model,
    apiKey: "sk-or-test",
  });
  assert.equal(good.passed, true, good.detail);
  assert.equal(sawResults.tasks_due[0].title, "Send the Q4 invoice");
  assert.ok(Math.abs(good.costUsd - 0.002) < 1e-9);

  const guessed = await runModelCheck({ provider: provider([answer("You have a design review and an invoice.")]), model });
  assert.equal(guessed.passed, false);
  assert.match(guessed.detail, /didn't look up the agenda/);

  const wrongDay = await runModelCheck({ provider: provider([toolTurn({ start_date: "2026-10-21" }), answer("Nothing much.")]), model });
  assert.equal(wrongDay.passed, false);

  const looping = await runModelCheck({ provider: provider([toolTurn({ start_date: "2026-10-22" }), toolTurn({ start_date: "2026-10-22" }), toolTurn({ start_date: "2026-10-22" }), toolTurn({ start_date: "2026-10-22" })]), model });
  assert.equal(looping.passed, false);
  assert.match(looping.detail, /kept calling tools/);
});

test("the registry lists only tool-capable OpenRouter models, free ones marked, none offered by default", async () => {
  const { listModels, PROVIDERS } = await load("src/lib/ai/models.js");
  const openRouter = listModels().filter((model) => model.provider === "openrouter");
  assert.ok(openRouter.length >= 5);
  for (const model of openRouter) {
    assert.equal(model.defaultEnabled, false, `${model.key} must pass a check before it's offered`);
    if (!model.free) assert.ok(model.agenticIndex >= 40, `${model.key} is below the tool-use bar`);
    assert.equal(model.free, model.id.endsWith(":free"));
  }
  assert.deepEqual(openRouter.filter((model) => model.free).map((model) => model.id).sort(), [
    "minimax/minimax-m3.1-flash:free",
    "nvidia/nemotron-3-ultra-550b-a55b:free",
    "nvidia/nemotron-3.5-super-vl:free",
    "thinkingmachines/inkling:free",
    "xingchen-agi/xing4.0-29b-a4b:free",
  ]);
  assert.deepEqual(Object.keys(PROVIDERS).sort(), ["anthropic", "openrouter"]);
});

test("the migration backfills each stored response with its conversation's model", async () => {
  const db = await createSchemaDatabase({ before: "20261022_provider_keys_and_model_choice.sql" });
  try {
    const user = (await db.query("INSERT INTO users (email, password_hash, full_name) VALUES ('a@b.co', 'h', 'A') RETURNING id")).rows[0].id;
    const chat = (await db.query("INSERT INTO ai_chats (user_id, title, provider, model) VALUES ($1, 't', 'anthropic', 'claude-haiku-5-5') RETURNING id", [user])).rows[0].id;
    await db.query("INSERT INTO ai_messages (chat_id, role, kind, content) VALUES ($1, 'user', 'input', 'q'), ($1, 'assistant', 'model', 'a')", [chat]);
    await db.query("INSERT INTO ai_usage (user_id, provider, model) VALUES ($1, 'anthropic', 'claude-haiku-5-5')", [user]);
    await db.exec(read("migrations/20261022_provider_keys_and_model_choice.sql"));
    const rows = (await db.query("SELECT kind, provider, model FROM ai_messages ORDER BY seq")).rows;
    assert.deepEqual(rows, [{ kind: "input", provider: null, model: null }, { kind: "model", provider: "anthropic", model: "claude-haiku-5-5" }]);
    assert.equal((await db.query("SELECT key_source FROM ai_usage")).rows[0].key_source, "workspace");
  } finally {
    await db.close();
  }
});

test("key and model routes are wired to the right guards", () => {
  for (const route of ["src/app/api/admin/models/route.js", "src/app/api/admin/models/check/route.js"]) {
    const source = read(route);
    const handlers = source.match(/export const (GET|POST|PATCH|PUT|DELETE) = /g) || [];
    const guarded = source.match(/export const (GET|POST|PATCH|PUT|DELETE) = withAdmin\(/g) || [];
    assert.equal(guarded.length, handlers.length, `${route} must be admin-only`);
  }
  const saveRoute = read("src/app/api/assistant/keys/[provider]/route.js");
  // A key is saved only after the provider accepts it, and never logged.
  assert.ok(saveRoute.indexOf("validateKey(apiKey)") < saveRoute.indexOf("saveKey(assistantDb"));
  assert.doesNotMatch(saveRoute, /log(Info|Error)\([^)]*apiKey/);
  assert.match(read("src/lib/assistant/agent.js"), /costUsd: turn\.usage\.costUsd \?\? estimateCostUsd/);
});

test("streamed OpenRouter replies are assembled: tool calls in pieces, merged reasoning, mid-stream errors", async () => {
  const { createOpenRouterProvider, createStreamAccumulator, turnFromOpenRouterResponse, OpenRouterError } = await load("src/lib/ai/providers/openrouter.js");
  const { getModel } = await load("src/lib/ai/models.js");
  const model = getModel("openrouter:google/gemini-3.8-flash");
  const tools = [{ name: "get_agenda", description: "d", parameters: { type: "object", properties: {} } }];
  const history = [{ kind: "input", content: "today?", payload: { context: "C" } }];

  const accumulator = createStreamAccumulator();
  const chunks = [
    { choices: [{ delta: { role: "assistant", reasoning_details: [{ type: "reasoning.text", text: "Think", index: 0, format: "google-gemini-v1" }] } }] },
    { choices: [{ delta: { reasoning_details: [{ type: "reasoning.text", text: "ing.", index: 0, signature: "sig" }] } }] },
    { choices: [{ delta: { tool_calls: [{ index: 0, id: "call_1", type: "function", function: { name: "get_agenda", arguments: "{\"start_" } }] } }] },
    { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: "date\":\"2026-10-22\"}" } }] } }] },
    { choices: [{ delta: {}, finish_reason: "tool_calls" }], usage: { prompt_tokens: 50, completion_tokens: 9, cost: 0.00002 } },
  ];
  for (const chunk of chunks) assert.equal(accumulator.add(chunk), "");
  const turn = turnFromOpenRouterResponse(accumulator.response());
  assert.equal(turn.stopReason, "tool_calls");
  assert.deepEqual(turn.toolCalls, [{ id: "call_1", name: "get_agenda", input: { start_date: "2026-10-22" } }]);
  assert.deepEqual(turn.payload.message.reasoning_details, [{ type: "reasoning.text", text: "Thinking.", index: 0, format: "google-gemini-v1", signature: "sig" }]);
  assert.equal(turn.usage.costUsd, 0.00002);

  // Placeholder reasoning is never replayed.
  const redacted = createStreamAccumulator();
  redacted.add({ choices: [{ delta: { content: "Hi", reasoning_details: [{ type: "reasoning.encrypted", data: "[REDACTED]" }] }, finish_reason: "stop" }] });
  assert.equal("reasoning_details" in turnFromOpenRouterResponse(redacted.response()).payload.message, false);

  // An error after some text arrives with a 200 status and ends the reply.
  const provider = createOpenRouterProvider({
    fetchImpl: async () => sseResponse([
      { choices: [{ delta: { content: "Partial" } }] },
      { error: { code: 502, message: "Upstream failed" }, choices: [{ delta: {}, finish_reason: "error" }] },
    ], { pieceSize: 3 }),
  });
  const seen = [];
  await assert.rejects(async () => {
    for await (const event of provider.streamTurn({ model, system: "R", tools, history, apiKey: "sk-or-x" })) seen.push(event);
  }, (error) => error instanceof OpenRouterError && error.status === 502 && /Upstream failed/.test(error.message));
  assert.deepEqual(seen, [{ type: "text", text: "Partial" }]);

  // A non-200 before streaming is a plain JSON error.
  const refused = createOpenRouterProvider({ fetchImpl: async () => jsonResponse(429, { error: { code: 429, message: "Rate limit exceeded: free-models-per-day" } }) });
  await assert.rejects(async () => {
    for await (const event of refused.streamTurn({ model, system: "R", tools, history, apiKey: "sk-or-x" })) assert.ok(event);
  }, (error) => error.status === 429);
});

test("today's free-model allowance comes from the key endpoint", async () => {
  const { createOpenRouterProvider } = await load("src/lib/ai/providers/openrouter.js");
  const { freeLimitMessage } = await load("src/lib/assistant/freeLimit.js");
  const provider = createOpenRouterProvider({
    fetchImpl: async () => jsonResponse(200, { data: { is_free_tier: true, free_model_daily_requests: { used: 48, limit: 50, remaining: 2 } } }),
  });
  assert.deepEqual(await provider.freeQuota("sk-or-x"), { used: 48, limit: 50, remaining: 2 });
  const broken = createOpenRouterProvider({ fetchImpl: async () => { throw new Error("offline"); } });
  assert.equal(await broken.freeQuota("sk-or-x"), null);
  const message = freeLimitMessage({ limit: 50 }, new Date("2026-10-22T21:30:00Z"));
  assert.match(message, /all 50 of today's free OpenRouter requests/);
  assert.match(message, /in about 3 hours/);
});

test("the workspace key offers Haiku and Sonnet by default, with Haiku first", async () => {
  const { resolveWorkspaceModels } = await load("src/lib/ai/models.js");
  assert.deepEqual(resolveWorkspaceModels({}).map((model) => model.key), ["anthropic:claude-haiku-5-5", "anthropic:claude-sonnet-5-5"]);
  assert.deepEqual(
    resolveWorkspaceModels({ AI_MODEL: "anthropic:claude-sonnet-5-5", AI_WORKSPACE_MODELS: "anthropic:claude-haiku-5-5, anthropic:claude-opus-5-5" }).map((model) => model.key),
    ["anthropic:claude-sonnet-5-5", "anthropic:claude-haiku-5-5", "anthropic:claude-opus-5-5"]
  );
  assert.throws(() => resolveWorkspaceModels({ AI_WORKSPACE_MODELS: "anthropic:claude-nope" }), /not a known model/);
  assert.throws(() => resolveWorkspaceModels({ AI_WORKSPACE_MODELS: "openrouter:z-ai/glm-5.3-flash" }), /workspace key is for anthropic/);
});

test("a message that fails before any reply is removed again; one that fails later is kept", async () => {
  const db = await createSchemaDatabase();
  try {
    const { answerMessage } = await load("src/lib/assistant/agent.js");
    const store = await load("src/lib/assistant/store.js");
    const members = await load("src/lib/members.js");
    const { getModel } = await load("src/lib/ai/models.js");
    const model = getModel("openrouter:thinkingmachines/inkling:free");
    const userId = await members.createMember(db, { email: "a@example.com", fullName: "A", password: "long-enough-1" });
    const conversation = await store.createConversation(db, { userId, title: "t", model });
    const run = async (provider) => {
      for await (const event of answerMessage({
        db, provider, model, conversationId: conversation.id, history: await store.loadHistory(db, conversation.id),
        userId, timeZone: "UTC", now: NOW, text: "today?", listEvents: async () => [], apiKey: "k", keySource: "member",
      })) {
        assert.ok(event);
      }
    };
    const limited = Object.assign(new Error("free-models-per-day"), { status: 429 });

    await assert.rejects(run({ async *streamTurn() { throw limited; } }), (error) => error.nothingStored === true);
    assert.equal(await store.isConversationEmpty(db, conversation.id), true, "the unanswered message was removed");

    const toolThenFail = [
      { text: "", toolCalls: [{ id: "c1", name: "list_projects", input: {} }], payload: { message: { role: "assistant", content: null, tool_calls: [] } }, stopReason: "tool_calls", usage: usage(1, 1, 0) },
    ];
    await assert.rejects(run({
      async *streamTurn() {
        const turn = toolThenFail.shift();
        if (!turn) throw Object.assign(new Error("free-models-per-day"), { status: 429 });
        yield { type: "turn", turn };
      },
    }), (error) => !error.nothingStored);
    assert.deepEqual((await store.loadHistory(db, conversation.id)).map((row) => row.kind), ["input", "model", "tool_results"]);

    // A client that leaves while the reply is paused also takes the unanswered message back.
    const second = await store.createConversation(db, { userId, title: "t2", model });
    const generator = answerMessage({
      db, provider: { async *streamTurn() { yield { type: "text", text: "Hal" }; await new Promise(() => {}); } }, model,
      conversationId: second.id, history: [], userId, timeZone: "UTC", now: NOW, text: "hi", listEvents: async () => [],
    });
    assert.deepEqual((await generator.next()).value, { type: "text", text: "Hal" });
    await generator.return();
    assert.equal(await store.isConversationEmpty(db, second.id), true);
  } finally {
    await db.close();
  }
});

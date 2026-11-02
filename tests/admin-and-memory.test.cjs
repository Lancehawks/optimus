const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { createSchemaDatabase } = require("./helpers/schema-database.cjs");

const root = path.resolve(__dirname, "..");
const load = (relativePath) => import(path.join(root, relativePath));
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const NOW = new Date("2026-10-22T09:30:00Z");

async function rejectsWith(promise, status, pattern) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.name, "Error");
    assert.equal(error.status, status, error.message);
    if (pattern) assert.match(error.message, pattern);
    return true;
  });
}

async function addSession(db, userId) {
  await db.query(
    "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 day')",
    [userId, require("node:crypto").randomBytes(32).toString("hex")]
  );
}

test("admins add members with a hashed password, a normalised email and recorded assistant access", async () => {
  const db = await createSchemaDatabase();
  try {
    const members = await load("src/lib/members.js");
    const { verifyPassword } = await load("src/lib/passwords.js");

    const adminId = await members.createMember(db, {
      email: "  Contact@Lancehawks.com ",
      fullName: "Siddharth  Admin",
      password: "alpha@1511",
      role: "admin",
    });
    const stored = (await db.query("SELECT email, full_name, role, timezone, password_hash, ai_assistant_enabled_at FROM users WHERE id = $1", [adminId])).rows[0];
    assert.equal(stored.email, "contact@lancehawks.com");
    assert.equal(stored.timezone, "Asia/Kolkata", "members created without a timezone start on IST");
    assert.equal(stored.full_name, "Siddharth Admin");
    assert.equal(stored.role, "admin");
    assert.notEqual(stored.password_hash, "alpha@1511");
    assert.equal(await verifyPassword("alpha@1511", stored.password_hash), true);
    assert.equal(stored.ai_assistant_enabled_at, null);

    const memberId = await members.createMember(db, {
      email: "member@example.com",
      fullName: "Mo Member",
      password: "long-enough-1",
      timezone: "Asia/Kolkata",
      assistantEnabled: true,
    }, { actorId: adminId });
    const member = await members.getMember(db, memberId, NOW);
    assert.equal(member.role, "member");
    assert.equal(member.timezone, "Asia/Kolkata");
    assert.ok(member.ai_assistant_enabled_at);
    assert.equal(member.ai_assistant_enabled_by, "Siddharth Admin");

    await rejectsWith(members.createMember(db, { email: "CONTACT@lancehawks.com", fullName: "Dup", password: "long-enough-1" }), 409, /already exists/);
    await rejectsWith(members.createMember(db, { email: "nope", fullName: "X", password: "long-enough-1" }), 400, /valid email/);
    await rejectsWith(members.createMember(db, { email: "a@b.co", fullName: "X", password: "short" }), 400, /at least 8/);
    await rejectsWith(members.createMember(db, { email: "a@b.co", fullName: "X", password: "long-enough-1", role: "owner" }), 400, /member or admin/);
    await rejectsWith(members.createMember(db, { email: "a@b.co", fullName: "X", password: "long-enough-1", timezone: "Mars/Base" }), 400, /timezone/);
  } finally {
    await db.close();
  }
});

test("admins see account details, counts and usage, never workspace content", async () => {
  const db = await createSchemaDatabase();
  try {
    const members = await load("src/lib/members.js");
    const adminId = await members.createMember(db, { email: "admin@example.com", fullName: "Ada Admin", password: "long-enough-1", role: "admin" });
    const memberId = await members.createMember(db, { email: "member@example.com", fullName: "Mo Member", password: "long-enough-1" });
    await db.query("INSERT INTO tasks (user_id, title) VALUES ($1, 'Secret task title')", [memberId]);
    await db.query("INSERT INTO notes (user_id, title, content) VALUES ($1, 'Private note', '<p>diary</p>')", [memberId]);
    await addSession(db, memberId);
    await db.query(
      "INSERT INTO ai_usage (user_id, provider, model, input_tokens, output_tokens, cost_usd, created_at) VALUES ($1, 'anthropic', 'claude-haiku-5-5', 1000, 100, 0.00015, $2), ($1, 'anthropic', 'claude-haiku-5-5', 1000, 100, 0.00015, '2026-09-30T23:00:00Z')",
      [memberId, NOW.toISOString()]
    );

    const list = await members.listMembers(db, NOW);
    assert.deepEqual(list.map((row) => row.full_name), ["Ada Admin", "Mo Member"]);
    const row = list.find((entry) => entry.id === memberId);
    assert.equal(row.ai_calls_this_month, 1, "only this month's usage counts");
    assert.ok(Math.abs(row.ai_cost_this_month - 0.00015) < 1e-9);
    assert.ok(row.last_sign_in_at);

    const detail = await members.getMember(db, memberId, NOW);
    assert.deepEqual(detail.activity, { tasks: 1, notes: 1, projects: 0, events: 0, active_sessions: 1, conversations: 0 });
    assert.ok(Math.abs(detail.ai_cost_all_time - 0.0003) < 1e-9);
    const serialized = JSON.stringify([list, detail]);
    for (const secret of ["Secret task title", "Private note", "diary", "password_hash"]) {
      assert.ok(!serialized.includes(secret), `admin views must not include ${secret}`);
    }
    assert.equal(await members.getMember(db, "00000000-0000-4000-8000-000000000000", NOW), null);
    assert.ok(adminId);
  } finally {
    await db.close();
  }
});

test("member updates keep at least one admin, sign suspended members out and reset passwords safely", async () => {
  const db = await createSchemaDatabase();
  try {
    const members = await load("src/lib/members.js");
    const { verifyPassword } = await load("src/lib/passwords.js");
    const ada = await members.createMember(db, { email: "ada@example.com", fullName: "Ada", password: "long-enough-1", role: "admin" });
    const ben = await members.createMember(db, { email: "ben@example.com", fullName: "Ben", password: "long-enough-1" });
    const cy = await members.createMember(db, { email: "cy@example.com", fullName: "Cy", password: "long-enough-1", role: "admin" });

    // Nobody locks themselves out.
    await rejectsWith(members.updateMember(db, ada, { role: "member" }, { actorId: ada }), 409, /your own admin role/);
    await rejectsWith(members.updateMember(db, ada, { isActive: false }, { actorId: ada }), 409, /suspend yourself/);

    // With two admins, one can demote the other; then the last one is protected.
    await members.updateMember(db, cy, { role: "member" }, { actorId: ada });
    await rejectsWith(members.updateMember(db, ada, { role: "member" }, { actorId: ben }), 409, /at least one active admin/);
    await rejectsWith(members.updateMember(db, ada, { isActive: false }, { actorId: ben }), 409, /at least one active admin/);

    // Suspending signs the member out everywhere; reactivating restores access.
    await addSession(db, ben);
    await members.updateMember(db, ben, { isActive: false }, { actorId: ada });
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM sessions WHERE user_id = $1", [ben])).rows[0].n, 0);
    assert.equal((await members.getMember(db, ben)).is_active, false);
    await members.updateMember(db, ben, { isActive: true }, { actorId: ada });

    // A new password replaces the hash, signs out sessions and voids reset links.
    await addSession(db, ben);
    await db.query("INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 hour')", [ben, "b".repeat(64)]);
    await members.updateMember(db, ben, { password: "brand-new-pass" }, { actorId: ada });
    const hash = (await db.query("SELECT password_hash FROM users WHERE id = $1", [ben])).rows[0].password_hash;
    assert.equal(await verifyPassword("brand-new-pass", hash), true);
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM sessions WHERE user_id = $1", [ben])).rows[0].n, 0);
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM password_resets WHERE user_id = $1", [ben])).rows[0].n, 0);

    // Assistant access records who turned it on, keeps that through a repeat, and clears when turned off.
    await members.updateMember(db, ben, { assistantEnabled: true }, { actorId: ada });
    await members.updateMember(db, cy, { role: "admin" }, { actorId: ada });
    await members.updateMember(db, ben, { assistantEnabled: true, fullName: "Ben Member" }, { actorId: cy });
    let detail = await members.getMember(db, ben);
    assert.equal(detail.ai_assistant_enabled_by, "Ada");
    assert.equal(detail.full_name, "Ben Member");
    await members.updateMember(db, ben, { assistantEnabled: false }, { actorId: cy });
    detail = await members.getMember(db, ben);
    assert.equal(detail.ai_assistant_enabled_at, null);
    assert.equal(detail.ai_assistant_enabled_by, null);

    await rejectsWith(members.updateMember(db, ben, { email: "ADA@example.com" }, { actorId: ada }), 409, /already exists/);
    await members.updateMember(db, ben, { email: "Ben.New@Example.com" }, { actorId: ada });
    assert.equal((await members.getMember(db, ben)).email, "ben.new@example.com");
    await rejectsWith(members.updateMember(db, "00000000-0000-4000-8000-000000000000", { fullName: "X" }, { actorId: ada }), 404);
    assert.deepEqual(members.changedFields({ fullName: "x", password: undefined, isActive: false }), ["fullName", "isActive"]);
  } finally {
    await db.close();
  }
});

test("sign-in keeps working when the code runs ahead of its migration", async () => {
  const { toSessionUser, userRecordSql } = await load("src/lib/userRecord.js");
  // A database from before the assistant and admin migrations.
  const db = await createSchemaDatabase({ before: "20261021_assistant_opt_in.sql" });
  try {
    await db.query("INSERT INTO users (email, password_hash, full_name) VALUES ('old@example.com', 'hash', 'Old Schema')");
    const result = await db.query(`SELECT ${userRecordSql("u")} FROM users u WHERE email = 'old@example.com'`);
    const user = toSessionUser(result.rows[0].account);
    assert.equal(user.role, "member");
    assert.equal(user.ai_assistant_enabled_at, null);
    assert.equal("password_hash" in result.rows[0].account, false, "the hash never leaves the database");
  } finally {
    await db.close();
  }

  assert.equal(toSessionUser({ id: "1", role: "superuser" }).role, "member", "unknown roles are not admin");
  const auth = read("src/lib/auth.js");
  const getAuthUser = auth.slice(auth.indexOf("export async function getAuthUser"), auth.indexOf("export function getTokenFromRequest"));
  assert.match(getAuthUser, /userRecordSql\("u"\)/);
  for (const route of ["src/app/api/auth/login/route.js", "src/app/api/auth/signup/route.js", "src/app/api/auth/profile/route.js"]) {
    assert.match(read(route), /userRecordSql\("users"\)/, `${route} reads the user through userRecordSql`);
  }
});

test("the admin migration withdraws assistant access members granted themselves", async () => {
  const db = await createSchemaDatabase({ before: "20261022_member_admin_and_memory.sql" });
  try {
    await db.query("INSERT INTO users (email, password_hash, full_name, ai_assistant_enabled_at) VALUES ('self@example.com', 'h', 'Self', NOW())");
    await db.exec(read("migrations/20261022_member_admin_and_memory.sql"));
    const row = (await db.query("SELECT role, ai_assistant_enabled_at FROM users WHERE email = 'self@example.com'")).rows[0];
    assert.deepEqual(row, { role: "member", ai_assistant_enabled_at: null });
    await assert.rejects(db.query("UPDATE users SET role = 'owner'"));
  } finally {
    await db.close();
  }
});

test("memory belongs to its member, has limits, and is copied into new conversations", async () => {
  const db = await createSchemaDatabase();
  try {
    const members = await load("src/lib/members.js");
    const memory = await load("src/lib/assistant/memory.js");
    const ada = await members.createMember(db, { email: "ada@example.com", fullName: "Ada", password: "long-enough-1" });
    const ben = await members.createMember(db, { email: "ben@example.com", fullName: "Ben", password: "long-enough-1" });

    const first = await memory.addMemory(db, ada, "  I run a two-person design studio.  ");
    await memory.addMemory(db, ada, "Plan my week on Monday mornings;\nkeep answers short.");
    assert.equal(first.content, "I run a two-person design studio.");
    await rejectsWith(memory.addMemory(db, ada, "   "), 400, /Write something/);
    await rejectsWith(memory.addMemory(db, ada, "x".repeat(501)), 400, /under 500/);
    await rejectsWith(memory.updateMemory(db, ben, first.id, "hijack"), 404);
    await rejectsWith(memory.deleteMemory(db, ben, first.id), 404);
    assert.deepEqual(await memory.listMemories(db, ben), []);

    const updated = await memory.updateMemory(db, ada, first.id, "I run a three-person design studio.");
    assert.equal(updated.content, "I run a three-person design studio.");
    const snapshot = memory.memorySnapshot(await memory.listMemories(db, ada));
    assert.equal(snapshot, "- I run a three-person design studio.\n- Plan my week on Monday mornings; keep answers short.");
    assert.equal(memory.memorySnapshot([]), null);

    for (let index = (await memory.listMemories(db, ada)).length; index < memory.MEMORY_ITEMS_MAX; index += 1) {
      await memory.addMemory(db, ada, `note ${index}`);
    }
    await rejectsWith(memory.addMemory(db, ada, "one too many"), 409, /up to 50/);
    await memory.deleteMemory(db, ada, first.id);
    assert.equal((await memory.listMemories(db, ada)).length, memory.MEMORY_ITEMS_MAX - 1);

    await db.query("DELETE FROM users WHERE id = $1", [ada]);
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM assistant_memories")).rows[0].n, 0, "memory goes with the account");
  } finally {
    await db.close();
  }
});

test("a conversation's memory reaches the model after the cached instructions and never changes mid-conversation", async () => {
  const db = await createSchemaDatabase();
  try {
    const { buildAnthropicRequest } = await load("src/lib/ai/providers/anthropic.js");
    const { assistantMemoryBlock } = await load("src/lib/assistant/prompt.js");
    const { answerMessage } = await load("src/lib/assistant/agent.js");
    const store = await load("src/lib/assistant/store.js");
    const memory = await load("src/lib/assistant/memory.js");
    const members = await load("src/lib/members.js");
    const { getModel } = await load("src/lib/ai/models.js");
    const model = getModel("anthropic:claude-haiku-5-5");

    const block = assistantMemoryBlock("- I prefer bullet lists.");
    const request = buildAnthropicRequest({ model, system: "RULES", memory: block, tools: [], history: [] });
    assert.deepEqual(request.system, [
      { type: "text", text: "RULES", cache_control: { type: "ephemeral" } },
      { type: "text", text: block },
    ]);
    assert.equal(buildAnthropicRequest({ model, system: "RULES", tools: [], history: [] }).system.length, 1);
    assert.equal(assistantMemoryBlock(null), null);

    const userId = await members.createMember(db, { email: "ada@example.com", fullName: "Ada", password: "long-enough-1" });
    await memory.addMemory(db, userId, "I prefer bullet lists.");
    const conversation = await store.createConversation(db, {
      userId,
      title: "hi",
      model,
      memory: memory.memorySnapshot(await memory.listMemories(db, userId)),
    });
    // Editing memory later doesn't touch the conversation's copy.
    await memory.addMemory(db, userId, "Added later.");
    const loaded = await store.getConversation(db, userId, conversation.id);
    assert.equal(loaded.memory, "- I prefer bullet lists.");

    const seen = [];
    const provider = {
      async *streamTurn(args) {
        seen.push(args.memory);
        yield { type: "turn", turn: { text: "Hi", toolCalls: [], payload: { content: [{ type: "text", text: "Hi" }] }, stopReason: "end", usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 } } };
      },
    };
    for await (const event of answerMessage({
      db, provider, model, conversationId: conversation.id, memory: loaded.memory, history: [],
      userId, timeZone: "UTC", now: NOW, text: "hello", listEvents: async () => [],
    })) {
      assert.ok(event);
    }
    assert.deepEqual(seen, [assistantMemoryBlock("- I prefer bullet lists.")]);
  } finally {
    await db.close();
  }
});

test("usage summary covers the month, each member and the last 30 days", async () => {
  const db = await createSchemaDatabase();
  try {
    const members = await load("src/lib/members.js");
    const { usageSummary } = await load("src/lib/assistant/usage.js");
    const ada = await members.createMember(db, { email: "ada@example.com", fullName: "Ada", password: "long-enough-1" });
    const gone = await members.createMember(db, { email: "gone@example.com", fullName: "Gone", password: "long-enough-1" });
    const insert = (userId, cost, at, input = 100, output = 10) => db.query(
      "INSERT INTO ai_usage (user_id, provider, model, input_tokens, output_tokens, cache_read_tokens, cost_usd, created_at) VALUES ($1, 'anthropic', 'claude-haiku-5-5', $2, $3, 50, $4, $5)",
      [userId, input, output, cost, at]
    );
    await insert(ada, 0.002, "2026-10-22T08:00:00Z");
    await insert(ada, 0.001, "2026-10-01T08:00:00Z");
    await insert(gone, 0.004, "2026-10-05T08:00:00Z");
    await insert(ada, 0.5, "2026-09-25T08:00:00Z");
    await db.query("DELETE FROM users WHERE id = $1", [gone]);

    const summary = await usageSummary(db, { now: NOW, budgetUsd: 10 });
    assert.equal(summary.month, "2026-10");
    assert.equal(summary.budgetUsd, 10);
    assert.equal(summary.calls, 3);
    assert.ok(Math.abs(summary.spentUsd - 0.007) < 1e-9);
    assert.equal(summary.inputTokens, 450, "input counts cached tokens too");
    assert.equal(summary.outputTokens, 30);
    assert.deepEqual(summary.members.map((row) => [row.name, row.calls]), [["Former member", 1], ["Ada", 2]]);
    assert.equal(summary.daily.length, 30);
    assert.equal(summary.daily.at(-1).day, "2026-10-22");
    assert.equal(summary.daily[0].day, "2026-09-23");
    assert.ok(Math.abs(summary.daily.find((day) => day.day === "2026-09-25").cost - 0.5) < 1e-9);
    assert.deepEqual(summary.models.map((row) => row.model), ["claude-haiku-5-5"]);
  } finally {
    await db.close();
  }
});

test("admin routes are admin-only and members can't grant themselves the assistant", () => {
  const routes = [
    "src/app/api/admin/members/route.js",
    "src/app/api/admin/members/[id]/route.js",
    "src/app/api/admin/usage/route.js",
  ];
  for (const route of routes) {
    const source = read(route);
    const handlers = source.match(/export const (GET|POST|PATCH|PUT|DELETE) = /g) || [];
    const guarded = source.match(/export const (GET|POST|PATCH|PUT|DELETE) = withAdmin\(/g) || [];
    assert.ok(handlers.length > 0);
    assert.equal(guarded.length, handlers.length, `${route} must wrap every handler in withAdmin`);
  }
  assert.match(read("src/lib/apiUtils.js"), /request\.user\.role !== "admin"\) return apiError\("Not found", 404\)/);
  const settings = read("src/app/api/assistant/settings/route.js");
  assert.doesNotMatch(settings, /export const (PUT|POST|PATCH)/);
  assert.doesNotMatch(read("src/app/api/auth/profile/route.js"), /\brole\b|ai_assistant_enabled/);
  assert.match(read("src/app/(dashboard)/admin/page.js"), /isAdmin\(user\)/);
  assert.match(read("src/proxy.js"), /"\/admin"/);

  // The last active admin can't delete their own account either.
  const deletion = read("src/lib/accountDeletion.js");
  assert.match(deletion, /role = 'admin' AND is_active = TRUE ORDER BY id FOR UPDATE/);
  assert.match(deletion, /reason: "last_admin"/);
  assert.match(read("src/app/api/auth/account/route.js"), /last_admin: "You're the only admin/);
});

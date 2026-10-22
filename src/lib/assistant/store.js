// Persistence for the assistant. `db` is anything with query(text, params)
// and transaction(callback), so routes pass the app pool and tests pass PGlite.

export const MAX_INPUTS_PER_CONVERSATION = 30;
export const DEFAULT_MONTHLY_BUDGET_USD = 10;
const TITLE_LENGTH = 60;

const ROLE_FOR_KIND = { input: "user", model: "assistant", tool_results: "user" };

export function readMonthlyBudgetUsd(env = process.env) {
  const raw = env.AI_MONTHLY_BUDGET_USD?.trim();
  if (!raw) return DEFAULT_MONTHLY_BUDGET_USD;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_MONTHLY_BUDGET_USD;
}

export function conversationTitle(text) {
  const line = String(text || "").replace(/\s+/g, " ").trim();
  if (!line) return "New conversation";
  return line.length > TITLE_LENGTH ? `${line.slice(0, TITLE_LENGTH - 1).trimEnd()}…` : line;
}

// Who turned the assistant on for this member, for the Settings page. Only
// admins change it (lib/members.js).
export async function getAssistantAccess(db, userId) {
  const result = await db.query(
    `SELECT u.ai_assistant_enabled_at, enabler.full_name AS enabled_by
     FROM users u
     LEFT JOIN users enabler ON enabler.id = u.ai_assistant_enabled_by
     WHERE u.id = $1`,
    [userId]
  );
  const row = result.rows[0];
  return { enabledAt: row?.ai_assistant_enabled_at || null, enabledBy: row?.enabled_by || null };
}

export async function listConversations(db, userId, { limit = 30 } = {}) {
  const result = await db.query(
    `SELECT id, title, updated_at FROM ai_chats
     WHERE user_id = $1
     ORDER BY updated_at DESC, id
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

export async function createConversation(db, { userId, title, model, memory = null }) {
  const result = await db.query(
    `INSERT INTO ai_chats (user_id, title, provider, model, memory)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, title, provider, model, memory, updated_at`,
    [userId, conversationTitle(title), model.provider, model.id, memory]
  );
  return result.rows[0];
}

export async function getConversation(db, userId, chatId) {
  const result = await db.query(
    "SELECT id, title, provider, model, memory, updated_at FROM ai_chats WHERE id = $1 AND user_id = $2",
    [chatId, userId]
  );
  return result.rows[0] || null;
}

export async function loadHistory(db, chatId) {
  const result = await db.query(
    "SELECT seq, kind, content, payload, created_at FROM ai_messages WHERE chat_id = $1 ORDER BY seq",
    [chatId]
  );
  return result.rows.map((row) => ({ ...row, seq: Number(row.seq) }));
}

// Rows are only ever appended, in one transaction per step, so a model
// response is never stored without the results of the tools it called.
export async function appendMessages(db, chatId, rows) {
  await db.transaction(async (client) => {
    for (const row of rows) {
      await client.query(
        `INSERT INTO ai_messages (chat_id, role, kind, content, payload)
         VALUES ($1, $2, $3, $4, $5::json)`,
        [chatId, ROLE_FOR_KIND[row.kind], row.kind, row.content || "", row.payload ? JSON.stringify(row.payload) : null]
      );
    }
    await client.query("UPDATE ai_chats SET updated_at = NOW() WHERE id = $1", [chatId]);
  });
}

export async function deleteConversation(db, userId, chatId) {
  const result = await db.query(
    "DELETE FROM ai_chats WHERE id = $1 AND user_id = $2 RETURNING id",
    [chatId, userId]
  );
  return result.rows.length > 0;
}

export async function deleteAllConversations(db, userId) {
  const result = await db.query("DELETE FROM ai_chats WHERE user_id = $1", [userId]);
  return result.rowCount ?? result.affectedRows ?? 0;
}

export async function recordUsage(db, { userId, chatId, model, usage, costUsd }) {
  await db.query(
    `INSERT INTO ai_usage
       (user_id, chat_id, provider, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_usd)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      userId,
      chatId,
      model.provider,
      model.id,
      usage.inputTokens || 0,
      usage.outputTokens || 0,
      usage.cacheReadTokens || 0,
      usage.cacheWriteTokens || 0,
      costUsd.toFixed(6),
    ]
  );
}

export function monthStartUtc(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function nextMonthStartUtc(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

// Workspace-wide: the cap protects the one API account every member shares.
export async function monthlySpendUsd(db, now = new Date()) {
  const result = await db.query(
    "SELECT COALESCE(SUM(cost_usd), 0) AS total FROM ai_usage WHERE created_at >= $1",
    [monthStartUtc(now).toISOString()]
  );
  return Number(result.rows[0]?.total || 0);
}

export function countInputs(history) {
  return history.filter((row) => row.kind === "input").length;
}

// What the panel shows: each message, and the text of the replies that
// followed it until the next message.
export function displayMessages(history) {
  const messages = [];
  let reply = null;
  for (const row of history) {
    if (row.kind === "input") {
      reply = null;
      messages.push({ id: `m${row.seq}`, role: "user", text: row.content, createdAt: row.created_at });
    } else if (row.kind === "model" && row.content) {
      if (!reply) {
        reply = { id: `m${row.seq}`, role: "assistant", text: row.content, createdAt: row.created_at };
        messages.push(reply);
      } else {
        reply.text = `${reply.text}\n\n${row.content}`;
      }
    }
  }
  return messages;
}

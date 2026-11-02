import assert from "node:assert/strict";
import crypto from "node:crypto";
import process from "node:process";
import pg from "pg";
import { normalizeDatabaseUrl } from "../src/lib/databaseUrl.js";
import { createNextRecurringTask } from "../src/lib/taskRecurrence.js";

if (process.env.ALLOW_DATABASE_TESTS !== "true") {
  throw new Error("Refusing to write database fixtures without ALLOW_DATABASE_TESTS=true.");
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

const pool = new pg.Pool({ connectionString: normalizeDatabaseUrl(process.env.DATABASE_URL), max: 4 });
const suffix = crypto.randomUUID();
let userId;

async function completeRecurringTask(taskId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query("SELECT * FROM tasks WHERE id = $1 FOR UPDATE", [taskId]);
    const task = locked.rows[0];
    if (task.status !== "done") {
      const updated = await client.query(
        "UPDATE tasks SET status = 'done', updated_at = NOW() WHERE id = $1 RETURNING *",
        [taskId]
      );
      await createNextRecurringTask(client, updated.rows[0]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function saveWhiteboardVersion(whiteboardId, expectedVersion, marker) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query(
      "SELECT content_version FROM whiteboards WHERE id = $1 FOR UPDATE",
      [whiteboardId]
    );
    if (Number(locked.rows[0].content_version) !== expectedVersion) {
      await client.query("ROLLBACK");
      return false;
    }
    await client.query(
      `UPDATE whiteboards
       SET excalidraw_data = $2::jsonb, content_version = content_version + 1
       WHERE id = $1`,
      [whiteboardId, JSON.stringify({ marker })]
    );
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

try {
  const user = await pool.query(
    `INSERT INTO users (email, password_hash, full_name)
     VALUES ($1, $2, 'Database Integration Test') RETURNING id`,
    [`db-integration-${suffix}@example.test`, "not-a-login-hash"]
  );
  userId = user.rows[0].id;

  const task = await pool.query(
    `INSERT INTO tasks (user_id, title, status, recurrence_rule, due_date)
     VALUES ($1, 'Concurrent recurring task', 'todo', 'daily', '2026-07-22T10:00:00Z')
     RETURNING id`,
    [userId]
  );
  await Promise.all([
    completeRecurringTask(task.rows[0].id),
    completeRecurringTask(task.rows[0].id),
  ]);
  const occurrences = await pool.query(
    "SELECT COUNT(*)::int AS count FROM tasks WHERE recurrence_source_task_id = $1",
    [task.rows[0].id]
  );
  assert.equal(occurrences.rows[0].count, 1, "concurrent completion must create one occurrence");

  const board = await pool.query(
    `INSERT INTO whiteboards (user_id, title, excalidraw_data)
     VALUES ($1, 'Concurrent whiteboard', '{}'::jsonb) RETURNING id, content_version`,
    [userId]
  );
  const saveResults = await Promise.all([
    saveWhiteboardVersion(board.rows[0].id, Number(board.rows[0].content_version), "first"),
    saveWhiteboardVersion(board.rows[0].id, Number(board.rows[0].content_version), "second"),
  ]);
  assert.deepEqual(saveResults.sort(), [false, true], "one stale whiteboard write must be rejected");

  const indexes = await pool.query(
    `SELECT indexname FROM pg_indexes
     WHERE schemaname = current_schema()
       AND indexname = ANY($1::text[])`,
    [["idx_tasks_recurrence_source_unique", "idx_tasks_search_title_trgm", "idx_notes_search_content_trgm"]]
  );
  assert.equal(indexes.rowCount, 3, "required reliability/search indexes must exist");

  process.stdout.write(`${JSON.stringify({ status: "ok", recurrenceOccurrences: 1, staleWhiteboardWriteRejected: true })}\n`);
} finally {
  if (userId) await pool.query("DELETE FROM users WHERE id = $1", [userId]);
  await pool.end();
}

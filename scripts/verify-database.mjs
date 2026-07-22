import process from "node:process";
import pg from "pg";
import { normalizeDatabaseUrl } from "../src/lib/databaseUrl.js";

const connectionString = process.env.VERIFY_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error("VERIFY_DATABASE_URL or DATABASE_URL is required.");

const client = new pg.Client({
  connectionString: normalizeDatabaseUrl(connectionString, { forceTls: process.env.DATABASE_SSL === "require" }),
});
await client.connect();

try {
  await client.query("BEGIN READ ONLY");
  const requiredTables = [
    "users", "sessions", "projects", "tasks", "notes", "calendars", "events",
    "project_members", "milestones", "schema_migrations", "rate_limit_buckets",
  ];
  const tables = await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1::text[])",
    [requiredTables]
  );
  const present = new Set(tables.rows.map((row) => row.tablename));
  const missing = requiredTables.filter((table) => !present.has(table));
  if (missing.length) throw new Error(`Missing required tables: ${missing.join(", ")}`);

  const ownershipColumns = await client.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND (
        (table_name = 'milestones' AND column_name = 'created_by')
        OR (table_name = 'project_members' AND column_name = 'role')
      )
  `);
  const ownershipColumnSet = new Set(
    ownershipColumns.rows.map((row) => `${row.table_name}.${row.column_name}`)
  );
  if (!ownershipColumnSet.has("milestones.created_by")) {
    throw new Error("Missing milestone creator ownership column");
  }
  if (ownershipColumnSet.has("project_members.role")) {
    throw new Error("Legacy project access roles are still installed");
  }

  const checks = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM sessions WHERE token_hash IS NULL OR length(token_hash) <> 64)::int AS invalid_sessions,
      (SELECT COUNT(*) FROM password_resets WHERE token_hash IS NULL OR length(token_hash) <> 64)::int AS invalid_resets,
      (SELECT COUNT(*) FROM (
         SELECT user_id FROM calendars WHERE is_default = TRUE GROUP BY user_id HAVING COUNT(*) > 1
       ) duplicates)::int AS duplicate_default_calendars,
      (SELECT COUNT(*) FROM tasks t LEFT JOIN users u ON u.id = t.user_id WHERE u.id IS NULL)::int AS orphan_tasks,
      (SELECT COUNT(*) FROM events e LEFT JOIN calendars c ON c.id = e.calendar_id WHERE c.id IS NULL)::int AS orphan_events
  `);
  const failures = Object.entries(checks.rows[0]).filter(([, count]) => Number(count) > 0);
  if (failures.length) {
    throw new Error(`Integrity checks failed: ${failures.map(([name, count]) => `${name}=${count}`).join(", ")}`);
  }

  const summary = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM users)::int AS users,
      (SELECT COUNT(*) FROM projects)::int AS projects,
      (SELECT COUNT(*) FROM tasks)::int AS tasks,
      (SELECT COUNT(*) FROM notes)::int AS notes,
      (SELECT COUNT(*) FROM events)::int AS events,
      (SELECT COUNT(*) FROM schema_migrations)::int AS migrations
  `);
  await client.query("COMMIT");
  process.stdout.write(`${JSON.stringify({ status: "ok", ...summary.rows[0] })}\n`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}

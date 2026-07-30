import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import pg from "pg";
import { normalizeDatabaseUrl } from "../src/lib/databaseUrl.js";

const connectionString = process.env.VERIFY_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error("VERIFY_DATABASE_URL or DATABASE_URL is required.");

const root = process.cwd();
const migrationsDirectory = path.join(root, "migrations");
const baseline = await fs.readFile(path.join(root, "database.sql"), "utf8");
const requiredTables = [...baseline.matchAll(/CREATE TABLE(?: IF NOT EXISTS)?\s+(\w+)/gi)]
  .map((match) => match[1]);
requiredTables.push(
  "schema_migrations",
  "push_devices",
  "push_notification_deliveries",
  "google_oauth_flows"
);
const migrationFiles = (await fs.readdir(migrationsDirectory))
  .filter((name) => name.endsWith(".sql"))
  .sort((a, b) => a.localeCompare(b));
const currentMigrations = new Map();
for (const name of migrationFiles) {
  const contents = await fs.readFile(path.join(migrationsDirectory, name), "utf8");
  currentMigrations.set(name, crypto.createHash("sha256").update(contents).digest("hex"));
}
const retiredMigrations = new Map(
  JSON.parse(await fs.readFile(path.join(migrationsDirectory, "retired.json"), "utf8"))
    .map((entry) => [entry.name, entry.checksum])
);

const client = new pg.Client({
  connectionString: normalizeDatabaseUrl(connectionString, { forceTls: process.env.DATABASE_SSL === "require" }),
});
await client.connect();

try {
  await client.query("BEGIN READ ONLY");
  const migrationRows = await client.query("SELECT name, checksum FROM schema_migrations");
  const appliedMigrations = new Map(migrationRows.rows.map((row) => [row.name, row.checksum]));
  for (const [name, appliedChecksum] of appliedMigrations) {
    if (name === "00000000_database_baseline.sql") continue;
    const expectedChecksum = currentMigrations.get(name) || retiredMigrations.get(name);
    if (!expectedChecksum) throw new Error(`Unknown applied migration: ${name}`);
    if (expectedChecksum !== appliedChecksum) throw new Error(`Migration checksum mismatch: ${name}`);
  }
  const pendingMigrations = [...currentMigrations.keys()].filter((name) => !appliedMigrations.has(name));
  if (pendingMigrations.length) {
    throw new Error(`Pending migrations: ${pendingMigrations.join(", ")}`);
  }

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

  const accountDeletionForeignKey = await client.query(`
    SELECT
      column_info.is_nullable,
      constraint_info.confdeltype
    FROM information_schema.columns column_info
    LEFT JOIN pg_constraint constraint_info
      ON constraint_info.conrelid = 'project_activity'::regclass
     AND constraint_info.contype = 'f'
     AND constraint_info.conname = 'project_activity_actor_user_id_fkey'
    WHERE column_info.table_schema = current_schema()
      AND column_info.table_name = 'project_activity'
      AND column_info.column_name = 'actor_user_id'
  `);
  if (
    accountDeletionForeignKey.rows[0]?.is_nullable !== "YES"
    || accountDeletionForeignKey.rows[0]?.confdeltype !== "n"
  ) {
    throw new Error(
      "Project activity actors must be nullable with ON DELETE SET NULL"
    );
  }

  const checks = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM sessions WHERE token_hash IS NULL OR length(token_hash) <> 64)::int AS invalid_sessions,
      (SELECT COUNT(*) FROM password_resets WHERE token_hash IS NULL OR length(token_hash) <> 64)::int AS invalid_resets,
      (SELECT COUNT(*) FROM push_devices
        WHERE token_hash IS NULL
           OR length(token_hash) <> 64
           OR token_ciphertext NOT LIKE 'enc:v1:%')::int AS invalid_push_tokens,
      (SELECT COUNT(*)
       FROM push_devices device
       LEFT JOIN sessions auth_session ON auth_session.id = device.session_id
       WHERE auth_session.id IS NULL
          OR auth_session.user_id <> device.user_id)::int AS mismatched_push_sessions,
      (SELECT COUNT(*) FROM google_oauth_flows
        WHERE state_hash IS NULL
           OR length(state_hash) <> 64
           OR code_verifier_ciphertext NOT LIKE 'enc:v1:%')::int AS invalid_google_oauth_flows,
      (SELECT COUNT(*)
       FROM google_oauth_flows flow
       JOIN sessions auth_session ON auth_session.id = flow.session_id
       WHERE auth_session.user_id <> flow.user_id)::int AS mismatched_google_oauth_sessions,
      (SELECT COUNT(*)
       FROM push_notification_deliveries delivery
       JOIN notifications notification ON notification.id = delivery.notification_id
       WHERE notification.user_id <> delivery.user_id)::int AS mismatched_push_notifications,
      (SELECT COUNT(*)
       FROM push_notification_deliveries delivery
       JOIN push_devices device ON device.id = delivery.push_device_id
       WHERE device.user_id <> delivery.user_id)::int AS mismatched_push_devices,
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

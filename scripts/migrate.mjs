import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import pg from "pg";
import { normalizeDatabaseUrl } from "../src/lib/databaseUrl.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run database migrations.");
}

const root = process.cwd();
const migrationsDirectory = path.join(root, "migrations");
const baselinePath = path.join(root, "database.sql");
const retiredMigrationsPath = path.join(migrationsDirectory, "retired.json");
const pool = new pg.Pool({
  connectionString: normalizeDatabaseUrl(databaseUrl, { forceTls: process.env.DATABASE_SSL === "require" }),
  max: 1,
  connectionTimeoutMillis: 10_000,
});

function checksum(contents) {
  return crypto.createHash("sha256").update(contents).digest("hex");
}

function withoutOuterTransaction(contents) {
  return contents
    .replace(/^\s*BEGIN;\s*$/gim, "")
    .replace(/^\s*COMMIT;\s*$/gim, "");
}

const client = await pool.connect();

try {
  // One migrator at a time, even when several application instances start.
  await client.query("SELECT pg_advisory_lock(hashtext('optimus_schema_migrations'))");
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      checksum VARCHAR(64) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const usersTable = await client.query("SELECT to_regclass('public.users') AS name");
  if (!usersTable.rows[0].name) {
    const baseline = await fs.readFile(baselinePath, "utf8");
    process.stdout.write("Applying database baseline...\n");
    await client.query("BEGIN");
    try {
      await client.query(baseline);
      await client.query(
        `INSERT INTO schema_migrations (name, checksum)
         VALUES ('00000000_database_baseline.sql', $1)
         ON CONFLICT (name) DO NOTHING`,
        [checksum(baseline)]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  const files = (await fs.readdir(migrationsDirectory))
    .filter((name) => name.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  const applied = await client.query("SELECT name, checksum FROM schema_migrations");
  const appliedByName = new Map(applied.rows.map((row) => [row.name, row.checksum]));
  const retiredEntries = JSON.parse(await fs.readFile(retiredMigrationsPath, "utf8"));
  const retiredByName = new Map(retiredEntries.map((entry) => [entry.name, entry]));
  const currentNames = new Set(files);

  for (const [name, appliedChecksum] of appliedByName) {
    if (name === "00000000_database_baseline.sql") continue;
    if (currentNames.has(name)) continue;
    const retired = retiredByName.get(name);
    if (!retired) {
      throw new Error(`Database contains unknown migration ${name}. Add it to migrations/retired.json only after review.`);
    }
    if (retired.checksum !== appliedChecksum) {
      throw new Error(`Retired migration ${name} has an unexpected checksum.`);
    }
  }

  for (const name of files) {
    const sql = await fs.readFile(path.join(migrationsDirectory, name), "utf8");
    const fileChecksum = checksum(sql);
    const previousChecksum = appliedByName.get(name);

    if (previousChecksum) {
      if (previousChecksum !== fileChecksum) {
        throw new Error(`Migration ${name} changed after it was applied.`);
      }
      continue;
    }

    process.stdout.write(`Applying ${name}...\n`);
    // Historical files include their own outer BEGIN/COMMIT. The runner strips
    // only those standalone markers so the schema change and its ledger row
    // commit atomically.
    await client.query("BEGIN");
    try {
      await client.query(withoutOuterTransaction(sql));
      await client.query(
        "INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)",
        [name, fileChecksum]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  process.stdout.write("Database is up to date.\n");
} finally {
  try {
    await client.query("SELECT pg_advisory_unlock(hashtext('optimus_schema_migrations'))");
  } finally {
    client.release();
    await pool.end();
  }
}

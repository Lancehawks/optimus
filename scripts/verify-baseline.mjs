import fs from "node:fs/promises";
import process from "node:process";
import pg from "pg";
import { normalizeDatabaseUrl } from "../src/lib/databaseUrl.js";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

const client = new pg.Client({
  connectionString: normalizeDatabaseUrl(process.env.DATABASE_URL, { forceTls: process.env.DATABASE_SSL === "require" }),
});
const schema = `optimus_baseline_check_${process.pid}`;
await client.connect();

try {
  const sql = await fs.readFile(new URL("../database.sql", import.meta.url), "utf8");
  const migrationsUrl = new URL("../migrations/", import.meta.url);
  await client.query("BEGIN");
  await client.query(`CREATE SCHEMA ${schema}`);
  await client.query(`SET LOCAL search_path TO ${schema}, public`);
  await client.query(sql);
  const migrationNames = (await fs.readdir(migrationsUrl))
    .filter((name) => name.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));
  for (const name of migrationNames) {
    const migration = await fs.readFile(new URL(name, migrationsUrl), "utf8");
    const transactionalBody = migration
      .replace(/^\s*BEGIN;\s*$/gim, "")
      .replace(/^\s*COMMIT;\s*$/gim, "");
    await client.query(transactionalBody);
  }
  const tables = await client.query(
    "SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_schema = $1",
    [schema]
  );
  if (tables.rows[0].count < 20) throw new Error("Baseline produced an incomplete schema.");
  await client.query("ROLLBACK");
  process.stdout.write(`Fresh baseline and migrations validated (${tables.rows[0].count} tables).\n`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}

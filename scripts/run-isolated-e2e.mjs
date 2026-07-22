import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import pg from "pg";
import { normalizeDatabaseUrl } from "../src/lib/databaseUrl.js";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

const schema = `optimus_e2e_${process.pid}_${crypto.randomBytes(4).toString("hex")}`;
if (!/^optimus_e2e_\d+_[a-f0-9]{8}$/.test(schema)) throw new Error("Unsafe temporary schema name.");

const root = process.cwd();
const client = new pg.Client({
  connectionString: normalizeDatabaseUrl(process.env.DATABASE_URL, {
    forceTls: process.env.DATABASE_SSL === "require",
  }),
});
await client.connect();

function withoutOuterTransaction(contents) {
  return contents
    .replace(/^\s*BEGIN;\s*$/gim, "")
    .replace(/^\s*COMMIT;\s*$/gim, "");
}

function runCommand(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: root,
      env,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) reject(new Error(`Playwright exited from signal ${signal}.`));
      else resolve(code || 0);
    });
  });
}

function runPlaywright(databaseUrl) {
  const port = 32_000 + (process.pid % 1000);
  return runCommand(
    [path.join(root, "node_modules", "@playwright", "test", "cli.js"), "test"],
    {
      ...process.env,
      CI: "1",
      DATABASE_URL: databaseUrl,
      E2E_BASE_URL: `http://127.0.0.1:${port}`,
    }
  );
}

let exitCode = 1;
try {
  const baseline = await fs.readFile(path.join(root, "database.sql"), "utf8");
  const migrationsDirectory = path.join(root, "migrations");
  const migrations = (await fs.readdir(migrationsDirectory))
    .filter((name) => name.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  await client.query("BEGIN");
  await client.query(`CREATE SCHEMA "${schema}"`);
  await client.query(`SET LOCAL search_path TO "${schema}", public`);
  await client.query(baseline);
  for (const name of migrations) {
    const sql = await fs.readFile(path.join(migrationsDirectory, name), "utf8");
    await client.query(withoutOuterTransaction(sql));
  }
  await client.query("COMMIT");

  const isolatedUrl = new URL(process.env.DATABASE_URL);
  // Neon poolers reject PostgreSQL startup options; the matching direct
  // endpoint supports the per-session search_path needed for isolation.
  isolatedUrl.hostname = isolatedUrl.hostname.replace("-pooler.", ".");
  isolatedUrl.searchParams.set("options", `-c search_path=${schema},public`);
  const databaseTestExit = await runCommand(
    [path.join(root, "tests", "database-integration.mjs")],
    {
      ...process.env,
      ALLOW_DATABASE_TESTS: "true",
      DATABASE_URL: isolatedUrl.toString(),
    }
  );
  if (databaseTestExit !== 0) throw new Error(`Database integration tests exited with ${databaseTestExit}.`);
  exitCode = await runPlaywright(isolatedUrl.toString());
} catch (error) {
  try { await client.query("ROLLBACK"); } catch {}
  throw error;
} finally {
  // The exact, validated test schema is the only destructive target.
  await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await client.end();
}

process.exitCode = exitCode;
